"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { offeringScope } from "@/lib/scope";
import { missingAssessmentMarks } from "@/lib/assessment-release";
import { notifyAcademic } from "@/lib/academic-email";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
export async function publishAssessmentResults(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "HOD"]), id = String(form.get("assessmentId") ?? "");
  try {
    const result = await db.$transaction(async tx => {
      const a = await tx.assessment.findFirst({ where: { id, offering: offeringScope(user) }, include: { marks: true, offering: { include: { subject: true, batch: { include: { students: { where: { status: { in: ["ACTIVE", "DETAINED"] } }, select: { id: true, entrySemester: true } } } } } } } });
      if (!a) return { error: "Assessment not found or outside your course permissions." };
      if (a.type === "END_SEM") return { error: "Use Publish final results for the end-semester grade card." };
      if (a.publishedAt) return { ok: true, message: "These assessment marks are already published." };
      if (a.offering.resultsPublished) return { error: "Final results are locked. Ask Admin to withdraw them before changing publication." };
      const ids = a.offering.batch.students.filter(s => s.entrySemester <= a.offering.subject.semester).map(s => s.id);
      if (!ids.length) return { error: "No enrolled students are available for this assessment." };
      const missing = missingAssessmentMarks(ids, a.marks, a.maxMarks);
      if (missing) return { error: `${missing} students need a valid mark or AB for ${a.name}. Save those marks before publishing.` };
      await tx.assessment.update({ where: { id }, data: { publishedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: user.id, action: "PUBLISH_ASSESSMENT", entity: "Assessment", entityId: id, details: `Released ${a.name} for ${ids.length} students; final grades and term status unchanged.` } });
      return { ok: true, offeringId: a.offeringId, changed: true, message: `${a.name} marks published. Students and linked parents will be notified. Final grades and SGPA/CGPA are unchanged.` };
    }, { isolationLevel: "Serializable", timeout: 15000 });
    if ("changed" in result && result.changed) {
      notifyAcademic({ type: "assessment-results", id });
      revalidatePath(`/exams/${result.offeringId}`);revalidatePath("/results");
    }
    return result;
  } catch { return { error: "Could not publish this assessment. No changes were saved; please retry." }; }
}
export async function withdrawAssessmentResults(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]), id = String(form.get("assessmentId") ?? "");
  try {
    const result = await db.$transaction(async tx => {
      const a = await tx.assessment.findUnique({ where: { id }, include: { offering: { include: { subject: true } } } });
      if (!a?.publishedAt || a.type === "END_SEM") return { error: "This internal assessment has no published marks to withdraw." };
      if (a.offering.resultsPublished) return { error: "Withdraw final results first before editing a published assessment." };
      const students = await tx.student.findMany({ where: { batchId: a.offering.batchId, status: { in: ["ACTIVE", "DETAINED"] }, entrySemester: { lte: a.offering.subject.semester } }, select: { id: true } });
      await tx.assessment.update({ where: { id }, data: { publishedAt: null } });
      await tx.auditLog.create({ data: { userId: user.id, action: "WITHDRAW_ASSESSMENT", entity: "Assessment", entityId: id, details: `Withdrew ${a.name} for review.` } });
      return { ok: true, offeringId: a.offeringId, studentIds: students.map(s => s.id), name: a.name };
    }, { isolationLevel: "Serializable", timeout: 15000 });
    if ("error" in result) return result;
    notifyAcademic({ type: "student-update", id: `assessment-withdraw:${id}:${Date.now()}`, studentIds: result.studentIds, message: `${result.name} marks were withdrawn for review. They will appear again after republication.` });
    revalidatePath(`/exams/${result.offeringId}`);revalidatePath("/results");
    return { ok: true, message: `${result.name} withdrawn. Its marks are editable again; other assessments are unchanged.` };
  } catch { return { error: "Could not withdraw this assessment. Please refresh and retry." }; }
}
