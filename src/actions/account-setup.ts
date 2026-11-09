"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notifyAcademic } from "@/lib/academic-email";
import { sendAccountSetup } from "@/lib/account-setup";
import { checkEmailChallenge, consumeEmailChallenge, issueEmailChallenge, maskEmail, VerificationError } from "@/lib/email-verification";
import { passwordChangedNow, passwordProblem, sha256 } from "@/lib/security";
import type { ActionState } from "@/lib/action-state";

async function invitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return db.accountSetupToken.findFirst({ where: { tokenHash: sha256(token), usedAt: null, expiresAt: { gt: new Date() }, user: { isActive: true, mustChangePassword: true } }, include: { user: true } });
}
export async function setupInformation(token: string) {
  const row = await invitation(token);
  return row ? { username: row.user.email, maskedEmail: maskEmail(row.user.email) } : null;
}
export async function requestSetupCode(_: ActionState, form: FormData): Promise<ActionState> {
  const row = await invitation(String(form.get("token") ?? ""));
  if (!row) return { error: "This setup invitation is invalid, expired or already used. Ask the college to resend it." };
  try {
    const challengeId = await issueEmailChallenge(row.userId, "SETUP", sha256(row.tokenHash + ":" + row.user.email), row.user.email);
    return { ok: true, challengeId, message: `A six-digit code was emailed to ${maskEmail(row.user.email)}. Enter it with your chosen password.` };
  } catch (e) { return { error: e instanceof VerificationError ? e.message : "The verification request could not be completed. Try again." }; }
}
export async function completeAccountSetup(_: ActionState, form: FormData): Promise<ActionState> {
  const token = String(form.get("token") ?? ""), password = String(form.get("password") ?? "");
  const row = await invitation(token);
  if (!row) return { error: "This setup invitation is invalid, expired or already used." };
  if (password !== form.get("confirm")) return { error: "Passwords do not match." };
  const problem = passwordProblem(password, [row.user.email.split("@")[0], row.user.name.split(" ")[0]]);
  if (problem) return { error: problem };
  const hash = await bcrypt.hash(password, 10);
  const result = await db.$transaction(async tx => {
    const current = await tx.accountSetupToken.findFirst({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() }, user: { isActive: true, mustChangePassword: true, email: row.user.email } } });
    if (!current) return { error: "This invitation is no longer valid." };
    const valid = await checkEmailChallenge(tx, { id: String(form.get("challengeId") ?? ""), userId: row.userId, purpose: "SETUP", payloadHash: sha256(row.tokenHash + ":" + row.user.email), targetEmail: row.user.email, code: String(form.get("code") ?? "") });
    if (!valid) return { error: "The email code is incorrect, expired or exhausted. Request a fresh code." };
    await consumeEmailChallenge(tx, String(form.get("challengeId")));
    const consumed = await tx.accountSetupToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw new Error("Invitation already used");
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash: hash, mustChangePassword: false, emailVerifiedAt: new Date(), passwordChangedAt: passwordChangedNow(), failedLogins: 0, lockedUntil: null } });
    await tx.accountSetupToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.loginCode.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: row.userId, action: "ACCOUNT_PASSWORD_SETUP", entity: "User", entityId: row.userId, details: "First password chosen after email verification." } });
    return { ok: true };
  }, { isolationLevel: "Serializable" });
  if (result.error) return result;
  notifyAcademic({ type: "security", id: row.userId, action: "Your account password setup is complete.", version: row.id });
  redirect("/login?reset=1");
}
export async function resendAccountSetup(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const student = await db.student.findUnique({ where: { id: String(form.get("studentId")) }, select: { userId: true } });
  if (!student) return { error: "Student not found." };
  const status = await sendAccountSetup(student.userId);
  if (status !== "SENT") return { error: status === "SKIPPED" ? "This student already set a password or the account is disabled." : status === "RATE_LIMITED" ? "Three invitations were already requested this hour. Try again later." : "The invitation could not be sent. Check the email address and SMTP delivery log." };
  await db.auditLog.create({ data: { userId: me.id, action: "RESEND_ACCOUNT_SETUP", entity: "User", entityId: student.userId } });
  return { ok: true, message: "A new password setup invitation was sent to the student's login email." };
}
