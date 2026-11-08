"use server";
import { notifyAcademic } from "@/lib/academic-email";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { forgetCurrentTerm } from "@/lib/scope";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";

const fail = (e: unknown, what: string): ActionState => {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { error: `A ${what} with the same unique details already exists.` };
    if (e.code === "P2003" || e.code === "P2014") return { error: `This ${what} is in use by other records and cannot be removed.` };
  }
  console.error(e);
  return { error: `Could not save ${what}.` };
};
const invalid = (e: z.ZodError): ActionState => ({ fieldErrors: z.flattenError(e).fieldErrors as ActionState["fieldErrors"], error: "Please fix the highlighted fields." });
const id = z.string().optional().transform((v) => v || undefined);

/** HODs may only touch records inside their own department. */
async function assertProgramAccess(user: CurrentUser, programId: string) {
  if (user.role === "ADMIN") return;
  const p = await db.program.findUnique({ where: { id: programId } });
  if (!p || p.departmentId !== user.departmentId) throw new Error("Not allowed for this programme");
}

// ── Departments ──
const DeptSchema = z.object({ id, code: z.string().trim().min(2).max(10).transform((v) => v.toUpperCase()), name: z.string().trim().min(3), hodId: id });
export async function saveDepartment(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const p = DeptSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return invalid(p.error);
  const { id: deptId, hodId, ...data } = p.data;
  try {
    const dept = await db.$transaction(async (tx) => {
      const d = deptId ? await tx.department.update({ where: { id: deptId }, data: { ...data, hodId: hodId ?? null } }) : await tx.department.create({ data: { ...data, hodId } });
      if (hodId) {
        // The appointed HOD gets the HOD role; a replaced HOD reverts to faculty.
        const fac = await tx.faculty.findUniqueOrThrow({ where: { id: hodId } });
        await tx.user.update({ where: { id: fac.userId }, data: { role: "HOD" } });
        await tx.user.updateMany({ where: { role: "HOD", faculty: { departmentId: d.id, id: { not: hodId } } }, data: { role: "FACULTY" } });
      }
      return d;
    });
    await audit(me.id, deptId ? "UPDATE" : "CREATE", "Department", dept.id, dept.code);
  } catch (e) { return fail(e, "department"); }
  revalidatePath("/academics");
  return { ok: true, message: "Department saved." };
}

// ── Programmes ──
const ProgramSchema = z.object({
  id, code: z.string().trim().min(2).transform((v) => v.toUpperCase()), name: z.string().trim().min(3),
  level: z.enum(["DIPLOMA", "UG", "PG"]), durationYears: z.coerce.number().int().min(1).max(6),
  intake: z.coerce.number().int().min(1).max(1000), departmentId: z.string().min(1, "Select department"),
});
export async function saveProgram(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const p = ProgramSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return invalid(p.error);
  const { id: pid, ...data } = p.data;
  try {
    const row = { ...data, totalSemesters: data.durationYears * 2 };
    const prog = pid ? await db.program.update({ where: { id: pid }, data: row }) : await db.program.create({ data: row });
    await audit(me.id, pid ? "UPDATE" : "CREATE", "Program", prog.id, prog.code);
  } catch (e) { return fail(e, "programme"); }
  revalidatePath("/academics/programs");
  return { ok: true, message: "Programme saved." };
}

// ── Batches ──
const BatchSchema = z.object({
  programId: z.string().min(1, "Select programme"), admissionYear: z.coerce.number().int().min(2000).max(2100),
  section: z.string().trim().min(1).max(3).transform((v) => v.toUpperCase()), currentSemester: z.coerce.number().int().min(1).max(12),
});
export async function createBatch(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const p = BatchSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return invalid(p.error);
  try {
    await assertProgramAccess(me, p.data.programId);
    const b = await db.batch.create({ data: p.data });
    await audit(me.id, "CREATE", "Batch", b.id);
  } catch (e) { return fail(e, "batch"); }
  revalidatePath("/academics/batches");
  return { ok: true, message: "Batch created." };
}

/**
 * Promotion after review: the students ticked "detain" are held back, everyone else moves up.
 * A detained student is marked DETAINED and joins the next junior batch of the same programme
 * (the one admitted a year later), if there is one, so they repeat the year with that class.
 * A final-semester batch graduates instead, and its students become alumni.
 */
export async function promoteReviewed(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const batch = await db.batch.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, include: { program: true } });
  const students = await db.student.findMany({ where: { batchId: batch.id, status: { in: ["ACTIVE", "DETAINED"] } }, select: { id: true } });
  const inBatch = new Set(students.map((s) => s.id));
  const detain = [...new Set(fd.getAll("detain").map(String))].filter((id) => inBatch.has(id));
  const move = students.map((s) => s.id).filter((id) => !detain.includes(id));
  const final = batch.currentSemester >= batch.program.totalSemesters;
  const junior = await db.batch.findFirst({ where: { programId: batch.programId, admissionYear: batch.admissionYear + 1 }, orderBy: [{ section: batch.section === "A" ? "asc" : "desc" }] });

  await db.$transaction(async (tx) => {
    if (detain.length) await tx.student.updateMany({ where: { id: { in: detain } }, data: { status: "DETAINED", ...(junior && { batchId: junior.id }) } });
    if (final) {
      await tx.student.updateMany({ where: { id: { in: move } }, data: { status: "GRADUATED" } });
      await tx.alumniProfile.createMany({ data: move.map((id) => ({ studentId: id, graduationYear: batch.admissionYear + batch.program.durationYears })), skipDuplicates: true });
    } else {
      await tx.student.updateMany({ where: { id: { in: move } }, data: { status: "ACTIVE" } });
      await tx.batch.update({ where: { id: batch.id }, data: { currentSemester: batch.currentSemester + 1 } });
    }
  });
  await audit(me.id, final ? "GRADUATE" : "PROMOTE", "Batch", batch.id, `${move.length} ${final ? "graduated" : `to sem ${batch.currentSemester + 1}`}, ${detain.length} detained`);
  notifyAcademic({ type: "student-update", id: `promotion:${batch.id}:${batch.currentSemester}`, studentIds: move, message: final ? "Your student record has been marked as graduated." : `Your batch has been promoted to semester ${batch.currentSemester + 1}.` });
  if (detain.length) notifyAcademic({ type: "student-update", id: `detention:${batch.id}:${batch.currentSemester}`, studentIds: detain, message: "Your progression review is complete. Contact the department and check your current academic status in the portal." });
  revalidatePath("/academics/batches");
  redirect(`/academics/batches?done=${encodeURIComponent(`${move.length} ${final ? "graduated" : "promoted"}${detain.length ? `, ${detain.length} detained${junior ? " and moved to the junior batch" : ""}` : ""}`)}`);
}

/** Moves a batch to the next semester; final-semester batches graduate their active students. */
export async function promoteBatch(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const batch = await db.batch.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, include: { program: true } });
  if (batch.currentSemester >= batch.program.totalSemesters) {
    const n = await db.student.updateMany({ where: { batchId: batch.id, status: "ACTIVE" }, data: { status: "GRADUATED" } });
    const grads = await db.student.findMany({ where: { batchId: batch.id, status: "GRADUATED" }, select: { id: true } });
    await db.alumniProfile.createMany({ data: grads.map((g) => ({ studentId: g.id, graduationYear: batch.admissionYear + batch.program.durationYears })), skipDuplicates: true });
    await audit(me.id, "GRADUATE", "Batch", batch.id, `${n.count} students`);
    notifyAcademic({ type: "student-update", id: `graduation:${batch.id}`, studentIds: grads.map(s => s.id), message: "Your student record has been marked as graduated." });
    revalidatePath("/academics/batches");
    return { ok: true, message: `${n.count} students marked as graduated.` };
  }
  await db.batch.update({ where: { id: batch.id }, data: { currentSemester: batch.currentSemester + 1 } });
  await audit(me.id, "PROMOTE", "Batch", batch.id, `→ sem ${batch.currentSemester + 1}`);
  const promoted = await db.student.findMany({ where: { batchId: batch.id, status: "ACTIVE" }, select: { id: true } });
  notifyAcademic({ type: "student-update", id: `promotion:${batch.id}:${batch.currentSemester}`, studentIds: promoted.map(s => s.id), message: `Your batch has been promoted to semester ${batch.currentSemester + 1}.` });
  revalidatePath("/academics/batches");
  return { ok: true, message: "Batch promoted." };
}

// ── Terms ──
const TermSchema = z.object({ id, name: z.string().trim().min(3), startDate: z.string().min(1), endDate: z.string().min(1) })
  .refine((d) => d.endDate > d.startDate, { path: ["endDate"], message: "End must be after start" });
export async function saveTerm(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const p = TermSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return invalid(p.error);
  const data = { name: p.data.name, startDate: new Date(`${p.data.startDate}T00:00:00Z`), endDate: new Date(`${p.data.endDate}T00:00:00Z`) };
  try {
    const t = p.data.id ? await db.term.update({ where: { id: p.data.id }, data }) : await db.term.create({ data });
    await audit(me.id, "SAVE", "Term", t.id, t.name);
  } catch (e) { return fail(e, "term"); }
  forgetCurrentTerm();
  revalidatePath("/academics/terms");
  return { ok: true, message: "Term saved." };
}
export async function setCurrentTerm(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const tid = String(fd.get("id"));
  await db.$transaction([db.term.updateMany({ data: { isCurrent: false } }), db.term.update({ where: { id: tid }, data: { isCurrent: true } })]);
  await audit(me.id, "SET_CURRENT", "Term", tid);
  forgetCurrentTerm();
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Subjects ──
const SubjectSchema = z.object({
  id, code: z.string().trim().min(3).transform((v) => v.toUpperCase()), name: z.string().trim().min(3),
  programId: z.string().min(1, "Select programme"), semester: z.coerce.number().int().min(1).max(12),
  credits: z.coerce.number().min(0).max(30), lectureHrs: z.coerce.number().int().min(0).max(10),
  tutorialHrs: z.coerce.number().int().min(0).max(10), practicalHrs: z.coerce.number().int().min(0).max(20),
  type: z.enum(["THEORY", "LAB", "PROJECT", "ELECTIVE", "AUDIT"]),
  internalMax: z.coerce.number().int().min(0).max(200), externalMax: z.coerce.number().int().min(0).max(200),
});
export async function saveSubject(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const p = SubjectSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return invalid(p.error);
  const { id: sid, ...data } = p.data;
  try {
    await assertProgramAccess(me, data.programId);
    const s = sid ? await db.subject.update({ where: { id: sid }, data }) : await db.subject.create({ data });
    await audit(me.id, sid ? "UPDATE" : "CREATE", "Subject", s.id, s.code);
  } catch (e) { return fail(e, "subject"); }
  revalidatePath("/academics/subjects");
  return { ok: true, message: "Subject saved." };
}

// ── Course allocation ──
export async function allocateFaculty(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const offeringId = String(fd.get("offeringId"));
  const facultyId = String(fd.get("facultyId") || "") || null;
  const o = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId }, include: { batch: true } });
  try {
    await assertProgramAccess(me, o.batch.programId);
    await db.courseOffering.update({ where: { id: offeringId }, data: { facultyId } });
    await audit(me.id, "ALLOCATE", "CourseOffering", offeringId, facultyId ?? "unassigned");
    if (facultyId) notifyAcademic({ type: "course-allocation", id: offeringId });
  } catch (e) { return fail(e, "allocation"); }
  revalidatePath("/academics/allocation");
  return { ok: true, message: "Faculty allocated." };
}

/** Creates offerings for every subject of the batch's current semester in the given term. */
export async function generateOfferings(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const batch = await db.batch.findUniqueOrThrow({ where: { id: String(fd.get("batchId")) } });
  const termId = String(fd.get("termId"));
  try {
    await assertProgramAccess(me, batch.programId);
    const subjects = await db.subject.findMany({ where: { programId: batch.programId, semester: batch.currentSemester } });
    if (!subjects.length) return { error: `No subjects defined for semester ${batch.currentSemester} of this programme.` };
    const r = await db.courseOffering.createMany({ data: subjects.map((s) => ({ subjectId: s.id, batchId: batch.id, termId })), skipDuplicates: true });
    await audit(me.id, "GENERATE", "CourseOffering", batch.id, `${r.count} offerings`);
    revalidatePath("/academics/allocation");
    return { ok: true, message: `${r.count} new course offerings created for semester ${batch.currentSemester}.` };
  } catch (e) { return fail(e, "offering"); }
}

// ── Generic delete ──
const DELETABLE = { department: "Department", program: "Program", batch: "Batch", term: "Term", subject: "Subject", courseOffering: "CourseOffering" } as const;
export async function deleteRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const model = String(fd.get("model")) as keyof typeof DELETABLE;
  const rid = String(fd.get("id"));
  if (!(model in DELETABLE)) return { error: "Unknown record type" };
  if (model === "courseOffering") {
    const o = await db.courseOffering.findUnique({ where: { id: rid }, include: { _count: { select: { sessions: true, assessments: true } } } });
    if (o && (o._count.sessions || o._count.assessments)) return { error: "Has attendance or marks — cannot delete." };
  }
  try {
    await (db[model] as unknown as { delete: (a: { where: { id: string } }) => Promise<unknown> }).delete({ where: { id: rid } });
    await audit(me.id, "DELETE", DELETABLE[model], rid);
  } catch (e) { return fail(e, DELETABLE[model].toLowerCase()); }
  revalidatePath("/academics", "layout");
  return { ok: true };
}
