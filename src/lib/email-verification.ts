import "server-only";
import { timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { mailConfigured, sendMail } from "./mail";
import { CODE_MAX_TRIES, CODE_MINUTES, newCode, sha256 } from "./security";

export class VerificationError extends Error {}
export const maskEmail = (email: string) => { const [name, domain] = email.split("@"); return `${name.slice(0, 2)}•••@${domain}`; };
export const verificationHash = (purpose: string, userId: string, payloadHash: string, email: string, code: string) => sha256(JSON.stringify([purpose, userId, payloadHash, email.toLowerCase(), code]));

type ChallengeTransaction = { emailChallenge: typeof db.emailChallenge };

/** Codes are purpose/payload/recipient-bound, hashed, rate-limited and never returned to the browser. */
export async function issueEmailChallenge(userId: string, purpose: string, payloadHash: string, targetEmail: string) {
  if (!mailConfigured()) throw new VerificationError("Email verification is not configured. Contact the administrator to configure SMTP.");
  const email = targetEmail.trim().toLowerCase(), code = newCode(), now = new Date();
  const row = await db.$transaction(async tx => {
    const recent = await tx.emailChallenge.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 10 * 60000) } } });
    if (recent >= 8) throw new VerificationError("Too many verification codes requested. Wait ten minutes and try again.");
    const last = await tx.emailChallenge.findFirst({ where: { userId, purpose, targetEmail: email }, orderBy: { createdAt: "desc" } });
    if (last && last.createdAt.getTime() > now.getTime() - 60000) throw new VerificationError("Please wait one minute before requesting another code.");
    await tx.emailChallenge.updateMany({ where: { userId, purpose, targetEmail: email, usedAt: null }, data: { usedAt: now } });
    return tx.emailChallenge.create({ data: { userId, purpose, targetEmail: email, payloadHash, codeHash: verificationHash(purpose, userId, payloadHash, email, code), expiresAt: new Date(now.getTime() + CODE_MINUTES * 60000) } });
  }, { isolationLevel: "Serializable" });
  const status = await sendMail({ to: email, category: "security", subject: purpose === "SETUP" ? "Your password setup verification code" : "Verify your account changes", text: `Use this code to ${purpose === "SETUP" ? "set your account password" : "confirm the changes you requested"}. It expires in ${CODE_MINUTES} minutes and works once. Never share it. If you did not request this, contact the administrator.`, code, logText: "An email verification code was requested. The code and change payload are not stored in the email log." });
  if (status !== "SENT") {
    await db.emailChallenge.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    throw new VerificationError("The verification email could not be sent. Check the email address or contact the administrator.");
  }
  return row.id;
}

/** Call inside the mutation transaction. Wrong attempts must COMMIT, so return errors rather than throwing. */
export async function checkEmailChallenge(tx: ChallengeTransaction, input: { id: string; userId: string; purpose: string; payloadHash: string; targetEmail: string; code: string }) {
  const reserved = await tx.emailChallenge.updateMany({ where: { id: input.id, userId: input.userId, purpose: input.purpose, payloadHash: input.payloadHash, targetEmail: input.targetEmail.toLowerCase(), usedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: CODE_MAX_TRIES } }, data: { attempts: { increment: 1 } } });
  if (reserved.count !== 1 || !/^\d{6}$/.test(input.code)) return false;
  const row = await tx.emailChallenge.findUniqueOrThrow({ where: { id: input.id } });
  const hash = verificationHash(input.purpose, input.userId, input.payloadHash, input.targetEmail, input.code);
  return row.codeHash.length === hash.length && timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(hash));
}

export async function consumeEmailChallenge(tx: ChallengeTransaction, id: string) {
  const result = await tx.emailChallenge.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });
  if (result.count !== 1) throw new VerificationError("This verification code has already been used. Request a new one.");
}
