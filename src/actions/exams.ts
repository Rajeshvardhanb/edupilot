"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notify";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertOffering, currentTerm } from "@/lib/scope";
import { backlogSubjects } from "@/lib/eligibility";
import { getInstitution } from "@/lib/institution";
import type { ActionState } from "@/lib/action-state";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

// ───────── Exam schedule, rooms, seating ─────────
export async function saveExam(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const term = await currentTerm();
  const subjectId = String(fd.get("subjectId")), date = String(fd.get("date"));
  const session = z.enum(["FN", "AN"]).parse(fd.get("session"));
  const kind = z.enum(["END_SEM", "MID_1", "MID_2"]).catch("END_SEM").parse(fd.get("kind"));
  if (!term || !subjectId || !isoRe.test(date)) return { error: "Choose a subject and date." };
  if (day(date) < term.startDate || day(date) > term.endDate) return { error: "Date is outside the current term." };
  // A batch cannot sit two papers in the same session.
  const batches = (await db.courseOffering.findMany({ where: { termId: term.id, subjectId }, select: { batchId: true } })).map((o) => o.batchId);
  const clash = await db.examSchedule.findFirst({
    where: { termId: term.id, date: day(date), session, subjectId: { not: subjectId }, subject: { offerings: { some: { termId: term.id, batchId: { in: batches } } } } },
    include: { subject: true },
  });
  if (clash) return { error: `Clash: the same batch has ${clash.subject.name} in that session.` };
  await db.examSchedule.upsert({ where: { termId_subjectId_kind: { termId: term.id, subjectId, kind } }, create: { termId: term.id, subjectId, kind, date: day(date), session }, update: { date: day(date), session } });
  await audit(me.id, "SCHEDULE", "Exam", subjectId, `${date} ${session}`);
  revalidatePath("/exams/schedule");
  return { ok: true, message: "Exam scheduled." };
}

export async function deleteExam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  await db.examSchedule.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/exams/schedule");
  return { ok: true, message: "Exam removed from the schedule." };
}

export async function saveRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const name = String(fd.get("name") ?? "").trim(), capacity = Number(fd.get("capacity"));
  if (!name || !(capacity > 0 && capacity <= 500)) return { error: "Enter a room name and a capacity between 1 and 500." };
  await db.examRoom.upsert({ where: { name }, create: { name, capacity }, update: { capacity } });
  revalidatePath("/exams/schedule");
  return { ok: true, message: "Room saved." };
}

/**
 * Seats every student sitting on a given date + session. Students from different papers are
 * interleaved (roll-number order within each paper) so neighbours write different exams.
 */
export async function generateSeating(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const term = await currentTerm();
  const [date, session] = String(fd.get("slot") ?? "").split("|");
  if (!term || !isoRe.test(date ?? "")) return { error: "Choose an exam session." };
  const exams = await db.examSchedule.findMany({ where: { termId: term.id, date: day(date), session } });
  if (!exams.length) return { error: "No exams on that date and session." };
  const rooms = await db.examRoom.findMany({ orderBy: { name: "asc" } });
  const queues: { examId: string; studentId: string }[][] = [];
  for (const ex of exams) {
    const offerings = await db.courseOffering.findMany({ where: { termId: term.id, subjectId: ex.subjectId }, select: { batchId: true, subject: { select: { semester: true } } } });
    const students = await db.student.findMany({ where: { batchId: { in: offerings.map((o) => o.batchId) }, status: "ACTIVE", entrySemester: { lte: offerings[0]?.subject.semester ?? 1 } }, orderBy: { rollNo: "asc" }, select: { id: true } });
    queues.push(students.map((s) => ({ examId: ex.id, studentId: s.id })));
  }
  const order: { examId: string; studentId: string }[] = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) for (const q of queues) if (i < q.length) order.push(q[i]);
  const capacity = rooms.reduce((s, r) => s + r.capacity, 0);
  if (order.length > capacity) return { error: `${order.length} students but only ${capacity} seats. Add rooms first.` };

  const rows: Prisma.SeatAllocationCreateManyInput[] = [];
  let r = 0, seat = 1;
  for (const o of order) {
    if (seat > rooms[r].capacity) { r++; seat = 1; }
    rows.push({ ...o, roomId: rooms[r].id, seatNo: seat++ });
  }
  await db.$transaction([db.seatAllocation.deleteMany({ where: { examId: { in: exams.map((e) => e.id) } } }), db.seatAllocation.createMany({ data: rows })]);
  await audit(me.id, "SEATING", "Exam", undefined, `${date} ${session}: ${rows.length} seats`);
  revalidatePath("/exams/schedule");
  return { ok: true, message: `${rows.length} students seated across ${r + 1} room(s).` };
}

// ───────── Invigilation duty ─────────
/**
 * Puts one teacher in each hall for an exam session. Halls with seated students are covered (all halls
 * if seating has not been generated yet). Teachers on approved leave that day are skipped, and those
 * with the fewest duties so far this term are chosen first, so the load is shared evenly.
 */
export async function assignInvigilators(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const term = await currentTerm();
  const [date, session] = String(fd.get("slot") ?? "").split("|");
  if (!term || !isoRe.test(date ?? "") || !["FN", "AN"].includes(session)) return { error: "Choose an exam session." };
  const exams = await db.examSchedule.findMany({ where: { termId: term.id, date: day(date), session }, select: { id: true } });
  if (!exams.length) return { error: "No exams on that date and session." };
  const seated = await db.seatAllocation.findMany({ where: { examId: { in: exams.map((e) => e.id) } }, distinct: ["roomId"], select: { roomId: true } });
  const rooms = await db.examRoom.findMany({ where: seated.length ? { id: { in: seated.map((s) => s.roomId) } } : {}, orderBy: { name: "asc" } });
  if (!rooms.length) return { error: "Add exam halls first." };

  const onLeave = await db.staffLeave.findMany({ where: { status: "APPROVED", fromDate: { lte: day(date) }, toDate: { gte: day(date) } }, select: { userId: true } });
  const faculty = await db.faculty.findMany({ where: { user: { isActive: true, id: { notIn: onLeave.map((l) => l.userId) } } }, select: { id: true, employeeId: true, userId: true } });
  const load = new Map((await db.invigilationDuty.groupBy({ by: ["facultyId"], where: { date: { gte: term.startDate, lte: term.endDate }, NOT: { date: day(date), session } }, _count: true })).map((g) => [g.facultyId, g._count]));
  const pool = faculty.sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.employeeId.localeCompare(b.employeeId));
  if (pool.length < rooms.length) return { error: `${rooms.length} halls need a teacher but only ${pool.length} are available that day.` };

  const picked = rooms.map((r, i) => ({ date: day(date), session, roomId: r.id, facultyId: pool[i].id }));
  await db.$transaction([db.invigilationDuty.deleteMany({ where: { date: day(date), session } }), db.invigilationDuty.createMany({ data: picked })]);
  await audit(me.id, "INVIGILATION", "Exam", undefined, `${date} ${session}: ${picked.length} halls`);
  await notifyUsers(rooms.map((_, i) => pool[i].userId), { title: `Invigilation duty on ${date} (${session === "FN" ? "forenoon" : "afternoon"})`, body: "You have been assigned to supervise an exam hall. The hall is shown on the exam schedule.", href: "/exams/schedule", email: true });
  revalidatePath("/exams/schedule");
  return { ok: true, message: `${picked.length} hall(s) covered. The teachers have been notified.` };
}

export async function removeInvigilator(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  await db.invigilationDuty.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/exams/schedule");
  return { ok: true };
}

// ───────── Supplementary registration ─────────
export async function registerSupplementary(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const term = await currentTerm();
  if (!term) return { error: "No current term." };
  const backlogs = await backlogSubjects(me.studentId!);
  const allowed = new Map(backlogs.map((b) => [b.offering.subjectId, b.offering.subject]));
  const already = new Set((await db.supplementaryRegistration.findMany({ where: { studentId: me.studentId!, termId: term.id } })).map((r) => r.subjectId));
  const picked = fd.getAll("subjectId").map(String).filter((id) => allowed.has(id) && !already.has(id));
  if (!picked.length) return { error: "Select at least one backlog subject." };
  const inst = await getInstitution();
  const amount = picked.length * inst.supplementaryFee;
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const last = await db.feeInvoice.findFirst({ where: { invoiceNo: { startsWith: `SUP-${year}-` } }, orderBy: { invoiceNo: "desc" } });
      const no = `SUP-${year}-${String((last ? Number(last.invoiceNo.slice(-5)) : 0) + 1).padStart(5, "0")}`;
      await db.$transaction(async (tx) => {
        const inv = await tx.feeInvoice.create({ data: { invoiceNo: no, studentId: me.studentId!, title: `Supplementary exam fee — ${picked.map((id) => allowed.get(id)!.code).join(", ")}`, amount, dueDate: new Date(Date.now() + 10 * 864e5) } });
        await tx.supplementaryRegistration.createMany({ data: picked.map((subjectId) => ({ studentId: me.studentId!, subjectId, termId: term.id, invoiceId: inv.id })) });
      });
      await audit(me.id, "REGISTER", "Supplementary", undefined, `${picked.length} subjects`);
      revalidatePath("/exams/supplementary");
      return { ok: true, message: `Registered for ${picked.length} subject(s). A fee invoice of ₹${amount} has been raised.` };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return { error: "Could not register, please try again." };
}

// ───────── Electives ─────────
export async function openElective(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  const term = await currentTerm();
  const subjectId = String(fd.get("subjectId")), seatLimit = Number(fd.get("seatLimit"));
  if (!term || !subjectId || !(seatLimit > 0)) return { error: "Choose a subject and a seat limit." };
  await db.electiveOption.upsert({ where: { termId_subjectId: { termId: term.id, subjectId } }, create: { termId: term.id, subjectId, seatLimit }, update: { seatLimit } });
  revalidatePath("/exams/electives");
  return { ok: true, message: "Elective opened for selection." };
}

export async function closeElective(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  await db.electiveOption.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/exams/electives");
  return { ok: true, message: "Elective closed." };
}

export async function chooseElective(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const student = await db.student.findUniqueOrThrow({ where: { id: me.studentId! }, include: { batch: true } });
  const option = await db.electiveOption.findUnique({ where: { id: String(fd.get("optionId")) }, include: { subject: true, _count: { select: { choices: true } } } });
  if (!option || option.subject.programId !== student.batch.programId) return { error: "This elective is not offered to your programme." };
  const existing = await db.electiveChoice.findUnique({ where: { studentId_semester: { studentId: student.id, semester: option.subject.semester } } });
  if (existing?.optionId === option.id) return { ok: true, message: "Already selected." };
  if (option._count.choices >= option.seatLimit) return { error: "This elective is full." };
  await db.electiveChoice.upsert({
    where: { studentId_semester: { studentId: student.id, semester: option.subject.semester } },
    create: { studentId: student.id, optionId: option.id, semester: option.subject.semester },
    update: { optionId: option.id },
  });
  revalidatePath("/exams/electives");
  return { ok: true, message: `You are enrolled in ${option.subject.name}.` };
}

// ───────── Course outcomes (CO-PO) ─────────
export async function saveOutcome(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const offeringId = String(fd.get("offeringId"));
  try { await assertOffering(me, offeringId); } catch (e) { return { error: (e as Error).message }; }
  const offering = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
  const code = String(fd.get("code") ?? "").trim().toUpperCase(), description = String(fd.get("description") ?? "").trim();
  if (!/^CO\d{1,2}$/.test(code) || description.length < 5) return { error: "Use a code like CO1 and describe the outcome." };
  // "1:3, 2:2" → { "1": 3, "2": 2 }
  const poMap: Record<string, number> = {};
  for (const part of String(fd.get("poMap") ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const m = /^(?:PO)?(\d{1,2})\s*[:=]\s*([123])$/i.exec(part);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { error: `“${part}” is not valid. Use PO number:strength, e.g. 1:3, 2:2.` };
    poMap[m[1]] = Number(m[2]);
  }
  await db.courseOutcome.upsert({ where: { subjectId_code: { subjectId: offering.subjectId, code } }, create: { subjectId: offering.subjectId, code, description, poMap }, update: { description, poMap } });
  revalidatePath(`/exams/outcomes/${offeringId}`);
  return { ok: true, message: `${code} saved.` };
}

export async function deleteOutcome(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD", "FACULTY"]);
  await db.courseOutcome.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/exams/outcomes", "layout");
  return { ok: true, message: "Outcome removed." };
}

export async function mapAssessments(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const offeringId = String(fd.get("offeringId"));
  try { await assertOffering(me, offeringId); } catch (e) { return { error: (e as Error).message }; }
  const assessments = new Set((await db.assessment.findMany({ where: { offeringId }, select: { id: true } })).map((a) => a.id));
  const pairs = fd.getAll("map").map((v) => String(v).split("|")).filter(([a]) => assessments.has(a)).map(([assessmentId, outcomeId]) => ({ assessmentId, outcomeId }));
  await db.$transaction([db.assessmentOutcome.deleteMany({ where: { assessmentId: { in: [...assessments] } } }), db.assessmentOutcome.createMany({ data: pairs })]);
  revalidatePath(`/exams/outcomes/${offeringId}`);
  return { ok: true, message: "Mapping saved." };
}

// ───────── Course feedback (anonymous) ─────────
export async function submitFeedback(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const student = await db.student.findUniqueOrThrow({ where: { id: me.studentId! } });
  const offeringId = String(fd.get("offeringId"));
  const offering = await db.courseOffering.findFirst({ where: { id: offeringId, batchId: student.batchId } });
  if (!offering) return { error: "Course not found." };
  const ratings = [0, 1, 2, 3, 4].map((i) => Number(fd.get(`q${i}`)));
  if (ratings.some((r) => !(r >= 1 && r <= 5))) return { error: "Please rate all five questions." };
  try {
    // The marker stops double submission; the response itself stores no student id.
    await db.$transaction([
      db.feedbackMarker.create({ data: { offeringId, studentId: student.id } }),
      db.feedbackResponse.create({ data: { offeringId, ratings, comment: String(fd.get("comment") ?? "").trim().slice(0, 1000) || null } }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "You have already given feedback for this course." };
    throw e;
  }
  revalidatePath("/feedback");
  return { ok: true, message: "Thank you — your feedback was recorded anonymously." };
}
