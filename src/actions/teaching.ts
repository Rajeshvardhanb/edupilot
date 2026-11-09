"use server";
import { notifyAcademic } from "@/lib/academic-email";

import type { ActionState } from "@/lib/action-state";
import { recordAttendance } from "@/lib/attendance-core";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DAYS } from "@/lib/format";
import { offeringResults } from "@/lib/results";
import { assertOffering,currentTerm,programScope } from "@/lib/scope";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ───────── Timetable ─────────

export async function saveTimetable(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const batchId = String(fd.get("batchId"));
  const term = await currentTerm();
  if (!term) return { error: "No current term configured." };
  const batch = await db.batch.findFirst({ where: { id: batchId, program: programScope(me) } });
  if (!batch) return { error: "Batch not found." };

  const offerings = await db.courseOffering.findMany({ where: { batchId, termId: term.id }, include: { subject: true } });
  const valid = new Map(offerings.map((o) => [o.id, o]));
  const entries: { dayOfWeek: number; period: number; offeringId: string; room: string | null }[] = [];
  for (const [k, v] of fd) {
    const m = /^slot_(\d)_(\d)$/.exec(k);
    if (!m || !v || !valid.has(String(v))) continue;
    const [d, p] = [Number(m[1]), Number(m[2])];
    entries.push({ dayOfWeek: d, period: p, offeringId: String(v), room: String(fd.get(`room_${d}_${p}`) || "") || null });
  }

  // Faculty clash: the same teacher in another batch's slot at the same time.
  const others = await db.timetableSlot.findMany({
    where: { batchId: { not: batchId }, offering: { termId: term.id, facultyId: { not: null } } },
    include: { offering: { include: { faculty: { include: { user: true } }, batch: { include: { program: true } } } } },
  });
  const busy = new Map(others.map((s) => [`${s.offering.facultyId}:${s.dayOfWeek}:${s.period}`, s]));
  const clashes = entries.flatMap((e) => {
    const fid = valid.get(e.offeringId)!.facultyId;
    const hit = fid && busy.get(`${fid}:${e.dayOfWeek}:${e.period}`);
    return hit ? [`${DAYS[e.dayOfWeek]} P${e.period}: ${hit.offering.faculty!.user.name} already teaches ${hit.offering.batch.program.code} ${hit.offering.batch.admissionYear}-${hit.offering.batch.section}`] : [];
  });
  if (clashes.length) return { error: `Faculty clash — ${clashes.slice(0, 4).join("; ")}${clashes.length > 4 ? " …" : ""}` };

  await db.$transaction([
    db.timetableSlot.deleteMany({ where: { batchId, offering: { termId: term.id } } }),
    db.timetableSlot.createMany({ data: entries.map((e) => ({ ...e, batchId })) }),
  ]);
  await audit(me.id, "SAVE", "Timetable", batchId, `${entries.length} slots`);
  notifyAcademic({ type: "timetable", id: batchId });
  revalidatePath("/timetable");
  return { ok: true, message: `Timetable saved (${entries.length} periods).` };
}

// ───────── Attendance ─────────

export async function saveAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const offeringId = String(fd.get("offeringId"));
  const marks = Object.fromEntries([...fd].filter(([k]) => k.startsWith("s_")).map(([k, v]) => [k.slice(2), String(v)]));
  const result = await recordAttendance(me, { offeringId, date: String(fd.get("date")), period: Number(fd.get("period")), topic: String(fd.get("topic") ?? "").trim().slice(0, 200), marks });
  if (result.ok) {
    revalidatePath(`/attendance/${offeringId}`);
    notifyAcademic({ type: "attendance", id: offeringId, date: String(fd.get("date")) });
  }
  return result;
}

export async function deleteSession(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const s = await db.attendanceSession.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  await assertOffering(me, s.offeringId);
  await db.attendanceSession.delete({ where: { id: s.id } });
  await audit(me.id, "DELETE", "AttendanceSession", s.id);
  revalidatePath(`/attendance/${s.offeringId}`);
  return { ok: true };
}

// ───────── Assessments & marks ─────────

const AssessmentSchema = z.object({
  offeringId: z.string().min(1),
  name: z.string().trim().min(2),
  type: z.enum(["MID_TERM", "ASSIGNMENT", "QUIZ", "LAB_INTERNAL", "END_SEM"]),
  maxMarks: z.coerce.number().positive().max(500),
  date: z.string().optional().transform((v) => (v ? new Date(`${v}T00:00:00Z`) : undefined)),
});

async function assertEditable(offeringId: string) {
  const o = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
  if (o.resultsPublished) throw new Error("Results are published — unpublish before changing marks.");
}

export async function createAssessment(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const p = AssessmentSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    await assertOffering(me, p.data.offeringId);
    await assertEditable(p.data.offeringId);
  } catch (e) { return { error: (e as Error).message }; }
  if (p.data.type === "END_SEM" && (await db.assessment.count({ where: { offeringId: p.data.offeringId, type: "END_SEM" } })))
    return { error: "An end-semester exam already exists for this course." };
  const a = await db.assessment.create({ data: p.data });
  await audit(me.id, "CREATE", "Assessment", a.id, a.name);
  revalidatePath(`/exams/${p.data.offeringId}`);
  return { ok: true, message: "Assessment added." };
}

export async function deleteAssessment(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const a = await db.assessment.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  try {
    await assertOffering(me, a.offeringId);
    await assertEditable(a.offeringId);
  } catch (e) { return { error: (e as Error).message }; }
  await db.assessment.delete({ where: { id: a.id } });
  await audit(me.id, "DELETE", "Assessment", a.id, a.name);
  revalidatePath(`/exams/${a.offeringId}`);
  return { ok: true };
}

export async function saveMarks(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const offeringId = String(fd.get("offeringId"));
  try {
    await assertOffering(me, offeringId);
    await assertEditable(offeringId);
  } catch (e) { return { error: (e as Error).message }; }

  const assessments = new Map((await db.assessment.findMany({ where: { offeringId } })).map((a) => [a.id, a]));
  const offering = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
  const enrolled = new Set((await db.student.findMany({ where: { batchId: offering.batchId }, select: { id: true } })).map((s) => s.id));

  const upserts: { assessmentId: string; studentId: string; marks: number | null; isAbsent: boolean }[] = [];
  const errors: string[] = [];
  for (const [k, v] of fd) {
    const m = /^m_([^_]+)_(.+)$/.exec(k);
    if (!m) continue;
    const [, aid, sid] = m;
    const a = assessments.get(aid);
    if (!a || !enrolled.has(sid)) continue;
    const raw = String(v).trim().toUpperCase();
    if (raw === "") continue;
    if (raw === "AB") { upserts.push({ assessmentId: aid, studentId: sid, marks: null, isAbsent: true }); continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > a.maxMarks) { errors.push(`${a.name}: "${raw}" is not between 0 and ${a.maxMarks}`); continue; }
    upserts.push({ assessmentId: aid, studentId: sid, marks: n, isAbsent: false });
  }
  if (upserts.length === 0 && errors.length === 0) return { error: "No marks were entered. Add an assessment and enter student marks first." };
  if (errors.length) return { error: `Nothing saved. ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ""}` };

  await db.$transaction(
    upserts.map((u) =>
      db.mark.upsert({
        where: { assessmentId_studentId: { assessmentId: u.assessmentId, studentId: u.studentId } },
        create: u,
        update: { marks: u.marks, isAbsent: u.isAbsent },
      }),
    ),
  );
  await audit(me.id, "SAVE", "Marks", offeringId, `${upserts.length} entries`);
  revalidatePath(`/exams/${offeringId}`);
  return { ok: true, message: `${upserts.length} marks saved.` };
}

/** Freezes computed results into SubjectResult (drives SGPA/CGPA, backlogs, placement eligibility). */
export async function publishResults(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const offeringId = String(fd.get("offeringId"));
  try { await assertOffering(me, offeringId); } catch (e) { return { error: (e as Error).message }; }
  const { offering, rows: allRows } = await offeringResults(offeringId);
  // Lateral entrants did not take earlier-semester courses; match the preview's enrollment rule.
  const rows = allRows.filter(({ student }) => student.entrySemester <= offering.subject.semester);
  if (offering.resultsPublished) return { ok: true, message: "These results are already published." };
  if (!rows.length) return { error: "No enrolled students are available for this course. Select the correct batch." };
  if (!offering.assessments.some((a) => a.type === "END_SEM")) return { error: "Add the end-semester exam and its marks before publishing." };
  const incomplete = rows.filter((r) => !r.result.complete).length;
  if (incomplete) return { error: `${incomplete} students have missing marks. Enter marks (or AB) for everyone first.` };

  await db.$transaction([
    db.subjectResult.deleteMany({ where: { offeringId } }),
    db.subjectResult.createMany({
      data: rows.map(({ student, result: r }) => ({
        offeringId, studentId: student.id, internal: r.internal, external: r.external, total: r.total,
        grade: r.grade, gradePoint: r.gradePoint, credits: offering.subject.credits, passed: r.passed,
      })),
    }),
    db.courseOffering.update({ where: { id: offeringId }, data: { resultsPublished: true } }),
  ]);
  await audit(me.id, "PUBLISH", "Results", offeringId, `${rows.length} students`);
  notifyAcademic({ type: "results", id: offeringId });

  revalidatePath(`/exams/${offeringId}`);
  return { ok: true, message: `Results published for ${rows.length} students.` };
}

export async function unpublishResults(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const offeringId = String(fd.get("offeringId"));
  const affected = await db.subjectResult.findMany({ where: { offeringId }, select: { studentId: true } });
  await db.$transaction([
    db.subjectResult.deleteMany({ where: { offeringId } }),
    db.courseOffering.update({ where: { id: offeringId }, data: { resultsPublished: false } }),
  ]);
  await audit(me.id, "UNPUBLISH", "Results", offeringId);
  notifyAcademic({ type: "student-update", id: `withdraw:${offeringId}:${Date.now()}`, studentIds: affected.map(r => r.studentId), message: "A previously published course result was withdrawn for review. Check the portal for the latest publication status." });
  revalidatePath(`/exams/${offeringId}`);
  return { ok: true, message: "Results withdrawn; marks are editable again." };
}
