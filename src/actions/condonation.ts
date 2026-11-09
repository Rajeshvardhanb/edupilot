"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { currentTerm, studentScope } from "@/lib/scope";
import { hallTicketStatus } from "@/lib/eligibility";
import { getRules } from "@/lib/rules";
import { notifyAcademic } from "@/lib/academic-email";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
export async function reviewCondonation(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "HOD"]);
  if (user.role === "HOD" && !user.departmentId) return { error: "No department is assigned to your account." };
  const studentId = String(form.get("studentId") ?? ""), reason = String(form.get("reason") ?? "").trim(), decision = String(form.get("decision") ?? "");
  if (!["APPROVED", "REJECTED", "REVOKED"].includes(decision) || reason.length < 5 || reason.length > 1000) return { error: "Select a decision and provide a reason between 5 and 1,000 characters." };
  const student = await db.student.findFirst({ where: { AND: [{ id: studentId, status: "ACTIVE", user: { isActive: true } }, studentScope(user)] }, select: { id: true } });
  if (!student) return { error: "This student is unavailable or outside your department." };
  const term = await currentTerm();
  if (!term) return { error: "Configure the current academic term first." };
  const status = (await hallTicketStatus([studentId], term.id)).get(studentId), rules = await getRules();
  if (!status || status.attendance < rules.attendanceCondonable || status.attendance >= rules.attendanceRequired) return { error: `Condonation applies only to attendance from ${rules.attendanceCondonable}% to below ${rules.attendanceRequired}%. Correct the attendance record if necessary.` };
  const row = await db.$transaction(async tx => {
    const data = { status: decision, reason, reviewedById: user.id, reviewedAt: new Date() };
    const r = await tx.attendanceCondonation.upsert({ where: { studentId_termId: { studentId, termId: term.id } }, create: { studentId, termId: term.id, ...data }, update: data });
    await tx.auditLog.create({ data: { userId: user.id, action: `CONDONATION_${decision}`, entity: "AttendanceCondonation", entityId: r.id, details: JSON.stringify({ studentId, termId: term.id, reason }) } });
    return r;
  });
  notifyAcademic({ type: "condonation-decision", id: row.id });
  revalidatePath("/exams/hall-tickets", "layout");
  return { ok: true, message: decision === "APPROVED" ? "Attendance condonation approved for this term. The student can now download the hall ticket." : "Decision recorded. The hall ticket remains subject to current attendance eligibility." };
}
