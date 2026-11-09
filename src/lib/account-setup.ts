import "server-only";
import { db } from "./db";
import { appUrl, sendMail } from "./mail";
import { newToken, sha256 } from "./security";

export const SETUP_HOURS = 24;
/** A dedicated first-password invitation. No temporary password is emailed or stored in logs. */
export async function sendAccountSetup(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.isActive || !user.mustChangePassword) return "SKIPPED" as const;
  const recent = await db.accountSetupToken.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
  if (recent >= 3) return "RATE_LIMITED" as const;
  const token = newToken();
  await db.$transaction(async tx => {
    await tx.accountSetupToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.accountSetupToken.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SETUP_HOURS * 3600000) } });
  });
  return sendMail({ to: user.email, category: "account", subject: "Your student management account is ready", text: `Hello ${user.name},\n\nYour college portal account has been created.\n\nYour login username: ${user.email}\n\n1. Open the Set up my password link below.\n2. Request the six-digit email verification code on that page.\n3. Enter that code and choose your own password.\n4. Sign in using the username above and your new password.\n\nThe setup link works once and expires in ${SETUP_HOURS} hours. You do not need the Forgot password flow for your first login. If it expires, ask the administrator or office staff to resend your setup invitation.`, link: { label: "Set up my password", url: appUrl(`/setup-password?token=${token}`) }, details: [{ label: "Login username", value: user.email }], logText: `Account setup invitation for username ${user.email}. The private setup link is omitted.` });
}
