"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { graceNeeded, regrade } from "@/lib/grading";
import { notifyRoles, notifyStudents } from "@/lib/notify";
import { getRules } from "@/lib/rules";
import { assertOffering } from "@/lib/scope";
import type { ActionState } from "@/lib/action-state";

/** A student asks for an end-semester paper to be re-checked. One request per subject. */
export async function requestRevaluation(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const resultId = String(fd.get("resultId")), reason = String(fd.get("reason") ?? "").trim().slice(0, 1000);
  if (reason.length < 10) return { error: "Say briefly why you think the marks should be checked (at least 10 characters)." };
  const r = await db.subjectResult.findFirst({ where: { id: resultId, studentId: me.studentId!, offering: { resultsPublished: true } }, include: { offering: { include: { subject: true, batch: { include: { program: true } } } } } });
  if (!r) return { error: "That result was not found." };
  if (r.offering.subject.externalMax === 0) return { error: "This subject has no end-semester paper to re-check." };
  if (await db.revaluationRequest.findUnique({ where: { studentId_offeringId: { studentId: r.studentId, offeringId: r.offeringId } } })) return { error: "You have already asked for this subject to be re-checked." };
  await db.revaluationRequest.create({ data: { studentId: r.studentId, offeringId: r.offeringId, reason, oldExternal: r.external, oldTotal: r.total, oldGrade: r.grade } });
  await notifyRoles(["HOD"], { title: `Revaluation requested: ${r.offering.subject.name}`, body: `${me.name}: ${reason.slice(0, 200)}`, href: "/exams/revaluation" }, r.offering.batch.program.departmentId);
  await notifyRoles(["ADMIN"], { title: `Revaluation requested: ${r.offering.subject.name}`, body: `${me.name}: ${reason.slice(0, 200)}`, href: "/exams/revaluation" });
  revalidatePath("/exams/revaluation");
  return { ok: true, message: "Request sent. You will be notified of the outcome." };
}

/**
 * The examiner's decision. With new end-semester marks the published result is updated (grade, pass or
 * fail, and therefore SGPA, CGPA and backlogs); leaving the marks as they were records "no change".
 */
export async function decideRevaluation(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const req = await db.revaluationRequest.findUnique({ where: { id: String(fd.get("id")) }, include: { offering: { include: { subject: true } } } });
  if (!req || req.status !== "PENDING") return { error: "That request is no longer waiting." };
  try { await assertOffering(me, req.offeringId); } catch (e) { return { error: (e as Error).message }; }
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
  const subject = req.offering.subject;
  const done = (title: string, body: string) => notifyStudents([req.studentId], { title, body, href: "/exams/revaluation", email: true });

  if (fd.get("decision") === "reject") {
    await db.revaluationRequest.update({ where: { id: req.id }, data: { status: "REJECTED", note, decidedById: me.id, decidedAt: new Date() } });
    await done(`Revaluation not taken up: ${subject.name}`, note ?? "Your request was not accepted.");
    revalidatePath("/exams/revaluation");
    return { ok: true, message: "Request rejected." };
  }
  const external = Number(fd.get("newExternal"));
  if (!Number.isFinite(external) || external < 0 || external > subject.externalMax) return { error: `Enter the re-checked end-semester marks, from 0 to ${subject.externalMax}.` };
  const result = await db.subjectResult.findUnique({ where: { offeringId_studentId: { offeringId: req.offeringId, studentId: req.studentId } } });
  if (!result) return { error: "The published result for this subject no longer exists." };
  const changed = Math.abs(external - result.external) >= 0.05;
  const g = regrade(subject, result.internal, external, await getRules());
  await db.$transaction([
    ...(changed ? [db.subjectResult.update({ where: { id: result.id }, data: { external, total: g.total, grade: g.grade, gradePoint: g.gradePoint, passed: g.passed, grace: 0 } })] : []),
    db.revaluationRequest.update({ where: { id: req.id }, data: { status: changed ? "REVISED" : "NO_CHANGE", newExternal: external, newTotal: g.total, newGrade: g.grade, note, decidedById: me.id, decidedAt: new Date() } }),
  ]);
  await audit(me.id, "REVALUATION", "SubjectResult", result.id, changed ? `${subject.code}: ${result.external} → ${external}, ${result.grade} → ${g.grade}` : `${subject.code}: no change`);
  await done(`Revaluation result: ${subject.name}`, changed ? `Your end-semester marks changed from ${result.external} to ${external}. Your grade is now ${g.grade}.` : "The paper was re-checked and the marks stand as they were.");
  revalidatePath("/exams/revaluation");
  return { ok: true, message: changed ? `Result updated: ${result.grade} → ${g.grade}.` : "Recorded as no change." };
}

/**
 * Moderation: students who failed a published course by a few marks are given just enough end-semester
 * marks to pass, up to the limit entered. Each one is recorded on the result (the `grace` column).
 */
export async function applyGrace(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const offeringId = String(fd.get("offeringId")), max = Math.round(Number(fd.get("max")));
  if (!(max >= 1 && max <= 10)) return { error: "Grace marks must be between 1 and 10." };
  const offering = await db.courseOffering.findFirst({ where: { id: offeringId, resultsPublished: true }, include: { subject: true, results: { where: { passed: false } } } });
  if (!offering) return { error: "Choose a course whose results are published." };
  const rules = await getRules();
  const updates = offering.results.flatMap((r) => {
    // Grace already given is taken back first, so applying a different limit does not stack.
    const base = r.external - r.grace;
    const need = graceNeeded(offering.subject, r.internal, base, max, rules);
    if (!need) return [];
    const g = regrade(offering.subject, r.internal, base + need, rules);
    return [{ id: r.id, studentId: r.studentId, data: { external: base + need, total: g.total, grade: g.grade, gradePoint: g.gradePoint, passed: g.passed, grace: need } }];
  });
  if (!updates.length) return { error: `Nobody who failed ${offering.subject.name} is within ${max} mark${max === 1 ? "" : "s"} of passing.` };
  await db.$transaction(updates.map((u) => db.subjectResult.update({ where: { id: u.id }, data: u.data })));
  await audit(me.id, "GRACE", "Results", offeringId, `${updates.length} students, up to ${max} marks`);
  await notifyStudents(updates.map((u) => u.studentId), { title: `Result updated: ${offering.subject.name}`, body: "Your result for this subject has been revised. Open your grade card to see it.", href: "/results", email: true });
  revalidatePath("/exams/revaluation");
  return { ok: true, message: `${updates.length} student${updates.length === 1 ? "" : "s"} passed with grace marks (up to ${max}).` };
}
