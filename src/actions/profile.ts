"use server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountProfileSchema, personalProfileSchema } from "@/lib/profile-validation";
import { checkEmailChallenge, consumeEmailChallenge, issueEmailChallenge, maskEmail, VerificationError } from "@/lib/email-verification";
import { demoEmailBootstrap, profileChangeHash, profileNeedsVerification } from "@/lib/profile-protection";
import { notifyAcademic } from "@/lib/academic-email";
import type { ActionState } from "@/lib/action-state";

function parse(form: FormData, student: boolean) {
  const values = Object.fromEntries(form);
  const account = accountProfileSchema.safeParse(values);
  const personal = student ? personalProfileSchema.safeParse(values) : null;
  if (!account.success) return { error: account.error.issues[0].message };
  if (personal && !personal.success) return { error: personal.error.issues[0].message };
  return { account: account.data, personal: personal?.success ? personal.data : null };
}
export async function requestProfileCode(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const input = parse(form, me.role === "STUDENT");
  if (input.error || !input.account) return { error: input.error };
  const current = await db.user.findUniqueOrThrow({ where: { id: me.id }, include: { student: true } });
  if (!profileNeedsVerification(current, input.account, input.personal)) return { ok: true, message: "Only biography, skills or links changed. You can save without an email code." };
  const emailChanged = current.email !== input.account.email;
  if (emailChanged && !(await bcrypt.compare(String(form.get("currentPassword") ?? ""), current.passwordHash))) return { error: "Enter your current password to change your login email." };
  if (!current.emailVerifiedAt && current.email.endsWith("@edupilot.edu") && !emailChanged) return { error: "Change your demo login email to a working email address first. Enter your current password, request the code and verify the new address." };
  const payload = profileChangeHash(me.id, current.updatedAt, input.account, input.personal);
  const bootstrap = demoEmailBootstrap(current, input.account.email);
  try {
    const target = bootstrap ? input.account.email : current.email;
    const challengeId = await issueEmailChallenge(me.id, "PROFILE", payload, target);
    const newEmailChallengeId = emailChanged && !bootstrap ? await issueEmailChallenge(me.id, "PROFILE_NEW_EMAIL", payload, input.account.email) : undefined;
    return { ok: true, challengeId, newEmailChallengeId, message: `Enter the code sent to ${maskEmail(target)}${newEmailChallengeId ? ` and the second code sent to ${maskEmail(input.account.email)}` : ""}, then save. Codes apply only to these exact changes.` };
  } catch (e) { return { error: e instanceof VerificationError ? e.message : "Verification email could not be prepared. Please try again." }; }
}
export async function updateMyProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const input = parse(form, me.role === "STUDENT");
  if (input.error || !input.account) return { error: input.error };
  if (me.role === "STUDENT" && !me.studentId) return { error: "No student record is linked to your account." };
  const account = input.account, personal = input.personal;
  let major = false;
  try {
    const result = await db.$transaction(async tx => {
      const current = await tx.user.findUniqueOrThrow({ where: { id: me.id }, include: { student: true } });
      const changedEmail = current.email !== account.email;
      if (changedEmail && !(await bcrypt.compare(String(form.get("currentPassword") ?? ""), current.passwordHash))) return { error: "Enter your current password to change your login email." };
      major = profileNeedsVerification(current, account, personal);
      if (major) {
        const bootstrap = demoEmailBootstrap(current, account.email);
        const payloadHash = profileChangeHash(me.id, current.updatedAt, account, personal);
        const valid = await checkEmailChallenge(tx, { id: String(form.get("challengeId") ?? ""), userId: me.id, purpose: "PROFILE", payloadHash, targetEmail: bootstrap ? account.email : current.email, code: String(form.get("verificationCode") ?? "") });
        if (!valid) return { error: "Request and enter a valid email OTP for these changes. If you edited details after requesting it, request a new code." };
        if (changedEmail && !bootstrap) {
          const validNew = await checkEmailChallenge(tx, { id: String(form.get("newEmailChallengeId") ?? ""), userId: me.id, purpose: "PROFILE_NEW_EMAIL", payloadHash, targetEmail: account.email, code: String(form.get("newEmailCode") ?? "") });
          if (!validNew) return { error: "The code for the new email is incorrect or expired." };
          await consumeEmailChallenge(tx, String(form.get("newEmailChallengeId")));
        }
        await consumeEmailChallenge(tx, String(form.get("challengeId")));
      }
      await tx.user.update({ where: { id: me.id }, data: { ...account, ...(major ? { emailVerifiedAt: new Date() } : {}) } });
      if (personal && me.studentId) await tx.student.update({ where: { id: me.studentId, userId: me.id }, data: personal });
      if (changedEmail) {
        await tx.passwordResetToken.updateMany({ where: { userId: me.id, usedAt: null }, data: { usedAt: new Date() } });
        await tx.loginCode.updateMany({ where: { userId: me.id, usedAt: null }, data: { usedAt: new Date() } });
        await tx.accountSetupToken.updateMany({ where: { userId: me.id, usedAt: null }, data: { usedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { userId: me.id, action: "UPDATE_PROFILE", entity: "User", entityId: me.id, details: major ? "Sensitive profile details updated after email OTP verification" : "Updated biography, skills or profile links" } });
      return { ok: true };
    }, { isolationLevel: "Serializable" });
    if (result.error) return result;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "That email address is already registered." };
    return { error: e instanceof VerificationError ? e.message : "Could not save your profile. Please try again." };
  }
  if (major) notifyAcademic({ type: "security", id: me.id, action: "Your sensitive profile details were updated after email verification.", version: String(Date.now()) });
  revalidatePath("/", "layout");
  return { ok: true, message: "Your profile has been updated. If you changed your email, use the new email as your login username." };
}
