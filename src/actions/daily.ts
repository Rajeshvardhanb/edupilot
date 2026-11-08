"use server";
import { notifyAcademic } from "@/lib/academic-email";

import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertOffering,studentScope } from "@/lib/scope";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const isoRe = /^\d{4}-\d{2}-\d{2}$/;
const first = (e: z.ZodError): ActionState => ({ error: e.issues[0].message });

// ───────── Academic calendar ─────────
const EventSchema = z.object({
  title: z.string().trim().min(2, "Title is required"),
  type: z.enum(["HOLIDAY", "EXAM", "EVENT"]),
  date: z.string().regex(isoRe, "Pick a date"),
  endDate: z.string().optional(),
  description: z.string().trim().optional(),
});
export async function saveEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const p = EventSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return first(p.error);
  const end = p.data.endDate && isoRe.test(p.data.endDate) ? day(p.data.endDate) : null;
  if (end && end < day(p.data.date)) return { error: "End date is before the start date." };
  const e = await db.calendarEvent.create({ data: { title: p.data.title, type: p.data.type, date: day(p.data.date), endDate: end, description: p.data.description || null } });
  await audit(me.id, "CREATE", "CalendarEvent", e.id, e.title);
  revalidatePath("/calendar");
  return { ok: true, message: "Added to the calendar." };
}
export async function deleteEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const id = String(fd.get("id"));
  await db.calendarEvent.delete({ where: { id } });
  await audit(me.id, "DELETE", "CalendarEvent", id);
  revalidatePath("/calendar");
  return { ok: true, message: "Event removed." };
}

// ───────── Leave & on-duty ─────────
const LeaveSchema = z.object({
  type: z.enum(["LEAVE", "MEDICAL", "ON_DUTY"]),
  fromDate: z.string().regex(isoRe, "Pick a start date"),
  toDate: z.string().regex(isoRe, "Pick an end date"),
  reason: z.string().trim().min(5, "Give a reason"),
});
export async function applyLeave(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const p = LeaveSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return first(p.error);
  const from = day(p.data.fromDate), to = day(p.data.toDate);
  if (to < from) return { error: "End date is before the start date." };
  if ((to.getTime() - from.getTime()) / 864e5 > 30) return { error: "A single request can cover at most 30 days." };
  const request = await db.leaveRequest.create({ data: { studentId: me.studentId!, type: p.data.type, fromDate: from, toDate: to, reason: p.data.reason } });
  notifyAcademic({ type: "leave-request", id: request.id });
  revalidatePath("/leave");
  return { ok: true, message: "Request submitted for approval." };
}

/** Approving an on-duty request converts that student's absences in the range to On-duty. */
export async function reviewLeave(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const decision = z.enum(["APPROVED", "REJECTED"]).parse(fd.get("decision"));
  const req = await db.leaveRequest.findFirst({ where: { id: String(fd.get("id")), student: studentScope(me) } });
  if (!req) return { error: "Request not found." };
  if (req.status !== "PENDING") return { error: "This request was already reviewed." };
  let converted = 0;
  await db.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id: req.id }, data: { status: decision, reviewedById: me.id, reviewNote: String(fd.get("note") ?? "") || null } });
    if (decision === "APPROVED" && req.type === "ON_DUTY") {
      converted = (await tx.attendanceRecord.updateMany({
        where: { studentId: req.studentId, status: "ABSENT", session: { date: { gte: req.fromDate, lte: req.toDate } } },
        data: { status: "ON_DUTY" },
      })).count;
    }
  });
  await audit(me.id, decision, "LeaveRequest", req.id, converted ? `${converted} absences → on duty` : undefined);
  notifyAcademic({ type: "leave-decision", id: req.id });
  revalidatePath("/leave");
  return { ok: true, message: decision === "APPROVED" ? `Approved.${converted ? ` ${converted} absences changed to On-duty.` : ""}` : "Rejected." };
}

// ───────── Study material & assignments ─────────
const MAX_FILE = 5_000_000;
async function readFile(fd: FormData, name = "file") {
  const f = fd.get(name);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > MAX_FILE) throw new Error("File must be under 5 MB.");
  return { file: new Uint8Array(await f.arrayBuffer()), fileName: f.name.slice(0, 180), fileType: f.type || "application/octet-stream" };
}
const linkOk = (v: string) => !v || /^https?:\/\//i.test(v);

export async function saveMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const offeringId = String(fd.get("offeringId"));
  const kind = z.enum(["NOTE", "ASSIGNMENT"]).parse(fd.get("kind"));
  const title = String(fd.get("title") ?? "").trim();
  const link = String(fd.get("link") ?? "").trim();
  const due = String(fd.get("dueDate") ?? "");
  if (title.length < 2) return { error: "Title is required." };
  if (!linkOk(link)) return { error: "Link must start with http:// or https://" };
  try {
    await assertOffering(me, offeringId);
    const file = await readFile(fd);
    if (kind === "NOTE" && !file && !link) return { error: "Attach a file or add a link." };
    const m = await db.material.create({
      data: {
        offeringId, kind, title, description: String(fd.get("description") ?? "").trim() || null, link: link || null,
        dueDate: kind === "ASSIGNMENT" && isoRe.test(due) ? day(due) : null,
        maxMarks: kind === "ASSIGNMENT" && Number(fd.get("maxMarks")) > 0 ? Number(fd.get("maxMarks")) : null, ...(file ?? {}),
      },
    });
    await audit(me.id, "CREATE", "Material", m.id, title);
    notifyAcademic({ type: "material", id: m.id });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath(`/materials/${offeringId}`);
  return { ok: true, message: kind === "NOTE" ? "Material shared with the class." : "Assignment published." };
}

export async function deleteMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const m = await db.material.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, select: { id: true, offeringId: true, title: true } });
  try { await assertOffering(me, m.offeringId); } catch (e) { return { error: (e as Error).message }; }
  await db.material.delete({ where: { id: m.id } });
  await audit(me.id, "DELETE", "Material", m.id, m.title);
  revalidatePath(`/materials/${m.offeringId}`);
  return { ok: true, message: "Removed." };
}

export async function submitAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const student = await db.student.findUniqueOrThrow({ where: { id: me.studentId! } });
  const m = await db.material.findFirst({ where: { id: String(fd.get("materialId")), kind: "ASSIGNMENT", offering: { batchId: student.batchId } }, select: { id: true } });
  if (!m) return { error: "Assignment not found." };
  const link = String(fd.get("link") ?? "").trim();
  const note = String(fd.get("note") ?? "").trim();
  if (!linkOk(link)) return { error: "Link must start with http:// or https://" };
  try {
    const file = await readFile(fd);
    if (!file && !link && !note) return { error: "Attach a file, add a link, or write your answer." };
    const data = { note: note || null, link: link || null, submittedAt: new Date(), ...(file ?? {}) };
    const existing = await db.submission.findUnique({ where: { materialId_studentId: { materialId: m.id, studentId: student.id } }, select: { marks: true } });
    if (existing?.marks != null) return { error: "This assignment has already been graded." };
    const submitted = await db.submission.upsert({ where: { materialId_studentId: { materialId: m.id, studentId: student.id } }, create: { materialId: m.id, studentId: student.id, ...data }, update: data });
    notifyAcademic({ type: "submission", id: submitted.id });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/materials");
  return { ok: true, message: "Submitted." };
}

export async function gradeSubmission(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const sub = await db.submission.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, select: { id: true, material: { select: { offeringId: true, maxMarks: true } } } });
  try { await assertOffering(me, sub.material.offeringId); } catch (e) { return { error: (e as Error).message }; }
  const marks = Number(fd.get("marks"));
  const max = sub.material.maxMarks ?? 100;
  if (!Number.isFinite(marks) || marks < 0 || marks > max) return { error: `Marks must be between 0 and ${max}.` };
  await db.submission.update({ where: { id: sub.id }, data: { marks, feedback: String(fd.get("feedback") ?? "").trim() || null }, select: { student: { select: { userId: true } }, material: { select: { title: true } } } });
  notifyAcademic({ type: "graded", id: sub.id });
  revalidatePath(`/materials/${sub.material.offeringId}`);
  return { ok: true, message: "Graded." };
}

// ───────── Syllabus & coverage ─────────
/** One topic per line; a line like "Unit 2" (or "Unit 2: Title") starts a new unit. */
export async function addTopics(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const offeringId = String(fd.get("offeringId"));
  try { await assertOffering(me, offeringId); } catch (e) { return { error: (e as Error).message }; }
  const offering = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
  const last = await db.syllabusTopic.findFirst({ where: { subjectId: offering.subjectId }, orderBy: { position: "desc" } });
  let unit = last?.unit ?? 1, pos = (last?.position ?? 0) + 1;
  const rows: { subjectId: string; unit: number; title: string; position: number }[] = [];
  for (const line of String(fd.get("topics") ?? "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const u = /^unit\s+(\d+)\s*[:\-–]?\s*(.*)$/i.exec(line);
    if (u) { unit = Number(u[1]); if (!u[2]) continue; rows.push({ subjectId: offering.subjectId, unit, title: u[2], position: pos++ }); continue; }
    rows.push({ subjectId: offering.subjectId, unit, title: line.slice(0, 190), position: pos++ });
  }
  if (!rows.length) return { error: "Enter at least one topic." };
  await db.syllabusTopic.createMany({ data: rows });
  await audit(me.id, "CREATE", "SyllabusTopic", offering.subjectId, `${rows.length} topics`);
  revalidatePath(`/syllabus/${offeringId}`);
  return { ok: true, message: `${rows.length} topics added.` };
}

export async function toggleCoverage(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const offeringId = String(fd.get("offeringId")), topicId = String(fd.get("topicId"));
  try { await assertOffering(me, offeringId); } catch (e) { return { error: (e as Error).message }; }
  const existing = await db.topicCoverage.findUnique({ where: { offeringId_topicId: { offeringId, topicId } } });
  if (existing) await db.topicCoverage.delete({ where: { id: existing.id } });
  else await db.topicCoverage.create({ data: { offeringId, topicId, coveredOn: new Date(new Date().toISOString().slice(0, 10)) } });
  revalidatePath(`/syllabus/${offeringId}`);
  return { ok: true };
}

export async function deleteTopic(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  await db.syllabusTopic.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/syllabus", "layout");
  return { ok: true, message: "Topic removed." };
}

// ───────── Substitute classes ─────────
export async function assignSubstitute(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const [offeringId, periodRaw] = String(fd.get("slot") ?? "").split("|");
  const facultyId = String(fd.get("facultyId")), date = String(fd.get("date"));
  const period = Number(periodRaw);
  if (!isoRe.test(date) || !offeringId || !facultyId || !(period >= 1 && period <= 10)) return { error: "Choose a date, class, period and substitute." };
  try { await assertOffering(me, offeringId); } catch (e) { return { error: (e as Error).message }; }
  const d = day(date);
  const offering = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
  if (offering.facultyId === facultyId) return { error: "That is the regular teacher for this class." };
  // The substitute must be free in that period (own timetable and other substitutions).
  const busy = await db.timetableSlot.findFirst({ where: { dayOfWeek: d.getUTCDay(), period, offering: { facultyId, termId: offering.termId } } });
  const alsoCovering = await db.substitution.findFirst({ where: { facultyId, date: d, period } });
  if (busy || alsoCovering) return { error: "This faculty member already has a class in that period." };
  const substitute = await db.substitution.upsert({
    where: { offeringId_date_period: { offeringId, date: d, period } },
    create: { offeringId, date: d, period, facultyId, reason: String(fd.get("reason") ?? "").trim() || null },
    update: { facultyId, reason: String(fd.get("reason") ?? "").trim() || null },
  });
  await audit(me.id, "SUBSTITUTE", "CourseOffering", offeringId, `${date} P${period}`);
  notifyAcademic({ type: "substitution", id: substitute.id });
  revalidatePath("/attendance/substitutions");
  return { ok: true, message: "Substitute assigned. They can now take attendance for this class." };
}

export async function removeSubstitute(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  await db.substitution.delete({ where: { id: String(fd.get("id")) } });
  revalidatePath("/attendance/substitutions");
  return { ok: true, message: "Substitution removed." };
}
