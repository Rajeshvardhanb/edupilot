// Non-destructive identity update for the original demo class. Dry run unless --apply is given.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";

/**
 * @param {{rollNo: string, name: string, email: string}[]} identities
 * @param {{id: string, userId: string, rollNo: string, user: {name: string, email: string, role: string}, batch: {program: {code: string}, admissionYear: number, section: string}}[]} records
 */
export function identityPlan(identities, records) {
  if (identities.length !== 21 || new Set(identities.map(s => s.rollNo)).size !== 21)
    throw new Error("Expected the 21 unique identities supplied by the client.");
  return identities.map((identity, index) => {
    const legacyRoll = `24BTCSE${String(index + 1).padStart(3, "0")}`;
    const matches = records.filter(s => [legacyRoll, identity.rollNo].includes(s.rollNo));
    if (matches.length !== 1) throw new Error(`Missing or conflicting record for ${identity.rollNo}; stopped without guessing.`);
    const row = matches[0];
    const allowedEmails = [identity.email, "student@edupilot.edu", `${legacyRoll.toLowerCase()}@student.edupilot.edu`, `${identity.rollNo.toLowerCase()}@student.edupilot.edu`];
    if (row.user.role !== "STUDENT" || row.batch.program.code !== "BTCSE" || row.batch.admissionYear !== 2024 || row.batch.section !== "A" || !allowedEmails.includes(row.user.email))
      throw new Error(`Record ${row.rollNo} does not match the original demo class; stopped.`);
    const email = identity.email;
    return { id: row.id, userId: row.userId, oldRollNo: row.rollNo, oldName: row.user.name, oldEmail: row.user.email, rollNo: identity.rollNo, name: identity.name, email,
      changed: row.rollNo !== identity.rollNo || row.user.name !== identity.name || row.user.email !== email };
  });
}

async function main() {
  try { loadEnvFile(".env"); } catch { /* DATABASE_URL may be supplied by the operator */ }
  const require = createRequire(resolve("package.json"));
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  const identities = JSON.parse(readFileSync(new URL("../college-data.json", import.meta.url), "utf8")).students;
  const rolls = identities.flatMap((s, i) => [s.rollNo, `24BTCSE${String(i + 1).padStart(3, "0")}`]);
  const apply = process.argv.includes("--apply");
  try {
    const result = await db.$transaction(async tx => {
      const rows = await tx.student.findMany({ where: { rollNo: { in: rolls } }, include: { user: { select: { name: true, email: true, role: true } }, batch: { include: { program: { select: { code: true } } } } } });
      const plan = identityPlan(identities, rows);
      for (const item of plan) {
        const owner = await tx.user.findUnique({ where: { email: item.email }, select: { id: true } });
        if (owner && owner.id !== item.userId) throw new Error(`Email collision for ${item.rollNo}; stopped.`);
      }
      const count = async () => ({ students: await tx.student.count(), users: await tx.user.count(), marks: await tx.mark.count(), attendance: await tx.attendanceRecord.count(), results: await tx.subjectResult.count() });
      const before = await count();
      const changed = plan.filter(p => p.changed);
      if (!apply || !changed.length) return { mode: apply ? "already-current" : "dry-run", changed: changed.length, matched: plan.length, counts: before, identities: plan.map(p => ({ from: p.oldRollNo, rollNo: p.rollNo, name: p.name })) };
      const dir = process.env.STUDENT_SYNC_BACKUP_DIR || join("backups", `student-identities-${new Date().toISOString().replaceAll(":", "-")}`);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      writeFileSync(join(dir, "student-identities.before.json"), JSON.stringify({ createdAt: new Date().toISOString(), before, plan }, null, 2), { mode: 0o600, flag: "wx" });
      for (const item of changed) {
        const userChange = await tx.user.updateMany({ where: { id: item.userId, name: item.oldName, email: item.oldEmail }, data: { name: item.name, email: item.email } });
        const studentChange = await tx.student.updateMany({ where: { id: item.id, rollNo: item.oldRollNo }, data: { rollNo: item.rollNo } });
        if (userChange.count !== 1 || studentChange.count !== 1) throw new Error("A record changed during the update; rolling back.");
      }
      const after = await count();
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Academic record counts changed; rolling back.");
      for (const item of plan) {
        const row = await tx.student.findUniqueOrThrow({ where: { id: item.id }, include: { user: true } });
        if (row.rollNo !== item.rollNo || row.user.name !== item.name || row.userId !== item.userId || row.user.email !== item.email)
          throw new Error("Identity verification failed; rolling back.");
      }
      await tx.auditLog.create({ data: { action: "SYNC_STUDENT_IDENTITIES", entity: "Student", details: `Applied ${changed.length} client-supplied names/roll numbers to demo records. Existing academic/contact data remains illustrative. No records deleted or notifications sent.` } });
      return { mode: "applied", changed: changed.length, matched: plan.length, counts: after, identityBackup: join(dir, "student-identities.before.json"), academicRecordsPreserved: true, emailsSent: 0 };
    }, { timeout: 30000 });
    console.log(JSON.stringify(result, null, 2));
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { console.error("Student identity sync stopped. No partial transaction was committed. Check database access, identity mapping and backup path; no credentials have been logged."); process.exitCode = 1; });
}
