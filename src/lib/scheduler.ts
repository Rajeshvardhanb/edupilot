import { execFile } from "node:child_process";
import "server-only";
import { db } from "./db";

/** Daily security cleanup and optional backup. Scheduled business reports are removed. */
export async function runDailyJobs() {
  const today = new Date(new Date().toISOString().slice(0, 10));
  if (await db.auditLog.findFirst({ where: { action: "DAILY_JOBS", createdAt: { gte: today } }, select: { id: true } })) return false;
  const old = new Date(Date.now() - 30 * 864e5);
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: old } } });
  await db.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } });
  await db.emailChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.accountSetupToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.loginCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if (process.env.AUTO_BACKUP === "1") {
    await new Promise<void>((resolve, reject) => {
      execFile(process.execPath, ["scripts/backup.mjs"], { timeout: 10 * 60_000 }, (error) => error ? reject(error) : resolve());
    });
  }
  await db.auditLog.create({ data: { action: "DAILY_JOBS", entity: "System", details: "Security cleanup and configured backup completed" } });
  return true;
}
