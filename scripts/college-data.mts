import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import { collegeDataSchema, type CollegeData } from "../src/lib/college-data-schema";

type Options = { apply?: boolean; newAccountPassword?: string; backupRoot?: string };
const differs = (before: object, after: object) => Object.entries(after).some(([key, value]) => before[key as keyof typeof before] !== value);

/** Never reseeds, deletes people, resets existing passwords or sends email. */
export async function syncCollegeData(db: PrismaClient, input: unknown, options: Options = {}) {
  const data: CollegeData = collegeDataSchema.parse(input);
  return db.$transaction(async tx => {
    const departments = await tx.department.findMany();
    const faculty = await tx.faculty.findMany({ include: { user: true, department: true } });
    const students = await tx.student.findMany({ where: { rollNo: { in: data.students.map(s => s.rollNo) } }, include: { user: true } });
    const accountUsers = await tx.user.findMany({ where: { email: { in: data.accounts.flatMap(a => [a.matchEmail, a.email]) } } });
    const heads = new Set(data.departments.map(d => d.hodEmployeeId).filter(Boolean));

    const accountPlan = data.accounts.map(account => {
      const matches = accountUsers.filter(u => u.email === account.matchEmail || u.email === account.email);
      if (matches.length !== 1 || matches[0].role !== account.role)
        throw new Error(`Account ${account.key}: missing, ambiguous, or role differs. Import does not create or promote administrator/office/parent accounts.`);
      const before = matches[0];
      const desired = { name: account.name, email: account.email, ...(account.phone !== undefined ? { phone: account.phone } : {}) };
      return { before, desired, changed: differs(before, desired) };
    });
    const facultyPlan = data.faculty.map(person => {
      const before = faculty.find(f => f.employeeId === person.employeeId);
      if (before && (!["FACULTY", "HOD"].includes(before.user.role) || before.department.code !== person.departmentCode))
        throw new Error(`Faculty ${person.employeeId}: role or department differs. Review the mapping before importing.`);
      const department = data.departments.find(d => d.code === person.departmentCode)!;
      const role = department.hodEmployeeId ? (heads.has(person.employeeId) ? "HOD" as const : "FACULTY" as const) : before?.user.role ?? "FACULTY" as const;
      const user = { name: person.name, email: person.email, role, ...(person.phone !== undefined ? { phone: person.phone } : {}) };
      const profile = { designation: person.designation, qualification: person.qualification };
      return { person, before, user, profile, changed: !before || differs(before.user, user) || differs(before, profile) };
    });
    const studentPlan = data.students.map(person => {
      const before = students.find(s => s.rollNo === person.rollNo);
      if (!before || before.user.role !== "STUDENT" || before.archivedAt)
        throw new Error(`Student ${person.rollNo}: missing, archived, or wrong role. Register new students in the application first.`);
      const user = { name: person.name, email: person.email, ...(person.phone !== undefined ? { phone: person.phone } : {}) };
      const profile = Object.fromEntries(["address", "guardianName", "guardianPhone", "guardianEmail"].flatMap(key => {
        const value = person[key as keyof typeof person];
        return value === undefined ? [] : [[key, value]];
      }));
      return { before, user, profile, changed: differs(before.user, user) || differs(before, profile) };
    });

    // Check ownership globally before making any writes; email swaps/collisions require explicit resolution.
    const targets = [
      ...accountPlan.map(p => ({ userId: p.before.id, email: p.desired.email })),
      ...facultyPlan.map(p => ({ userId: p.before?.userId, email: p.user.email })),
      ...studentPlan.map(p => ({ userId: p.before.userId, email: p.user.email })),
    ];
    if (new Set(targets.filter(t => t.userId).map(t => t.userId)).size !== targets.filter(t => t.userId).length)
      throw new Error("The file maps more than one identity to the same database user.");
    const owners = await tx.user.findMany({ where: { email: { in: targets.map(t => t.email) } }, select: { id: true, email: true } });
    for (const target of targets) {
      if (owners.some(u => u.email === target.email && u.id !== target.userId))
        throw new Error(`Login email is already owned by another account: ${target.email}.`);
    }
    const departmentPlan = data.departments.map(department => {
      const before = departments.find(d => d.code === department.code);
      const head = faculty.find(f => f.employeeId === department.hodEmployeeId);
      if (department.hodEmployeeId && before?.hodId && before.hodId !== head?.id && !facultyPlan.some(f => f.before?.id === before.hodId))
        throw new Error(`Department ${department.code}: the previous HOD is outside this file. Include their faculty record before changing the head.`);
      return { department, before, changed: !before || before.name !== department.name || Boolean(department.hodEmployeeId && before.hodId !== head?.id) };
    });
    const institution = await tx.institution.findUnique({ where: { id: 1 } });
    const summary = {
      mode: options.apply ? "applied" : "preview",
      collegeChanged: !institution || differs(institution, data.college),
      departmentsChanged: departmentPlan.filter(p => p.changed).length,
      accountsChanged: accountPlan.filter(p => p.changed).length,
      facultyChanged: facultyPlan.filter(p => p.changed && p.before).length,
      facultyCreated: facultyPlan.filter(p => !p.before).length,
      studentsChanged: studentPlan.filter(p => p.changed).length,
      facultyListed: data.faculty.length, studentsListed: data.students.length,
      changedEmployeeIds: facultyPlan.filter(p => p.changed).map(p => p.person.employeeId),
      changedStudentRolls: studentPlan.filter(p => p.changed).map(p => p.before.rollNo),
      existingPasswordsPreserved: true, academicRecordsPreserved: true, emailsSent: 0,
    };
    if (!options.apply) return summary;
    const changed = summary.collegeChanged || summary.departmentsChanged || summary.accountsChanged || summary.facultyChanged || summary.facultyCreated || summary.studentsChanged;
    if (!changed) return { ...summary, mode: "already-current" };
    if (summary.facultyCreated && (!options.newAccountPassword || options.newAccountPassword.length < 10 || Buffer.byteLength(options.newAccountPassword) > 72))
      throw new Error("Set COLLEGE_IMPORT_PASSWORD (10–72 bytes, at least 10 characters) for new faculty accounts. Existing passwords will not change.");

    const counts = async () => ({ marks: await tx.mark.count(), attendance: await tx.attendanceRecord.count(), results: await tx.subjectResult.count(), students: await tx.student.count() });
    const academicCounts = await counts();
    const folder = join(options.backupRoot ?? "backups", `college-data-${new Date().toISOString().replaceAll(":", "-")}`);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    // Back up only the fields this operation changes, never password hashes or secrets.
    const userBefore = (u: { id: string; name: string; email: string; role: string; phone: string | null }) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone });
    writeFileSync(join(folder, "before.json"), JSON.stringify({
      academicCounts,
      institution: institution ? Object.fromEntries(Object.keys(data.college).map(key => [key, institution[key as keyof typeof institution]])) : null,
      departments: departmentPlan.map(p => p.before ?? { newCode: p.department.code }),
      accounts: accountPlan.map(p => userBefore(p.before)),
      faculty: facultyPlan.map(p => p.before ? { id: p.before.id, user: userBefore(p.before.user), designation: p.before.designation, qualification: p.before.qualification } : { newEmployeeId: p.person.employeeId }),
      students: studentPlan.map(p => ({ id: p.before.id, user: userBefore(p.before.user), address: p.before.address, guardianName: p.before.guardianName, guardianPhone: p.before.guardianPhone, guardianEmail: p.before.guardianEmail })),
    }, null, 2), { mode: 0o600, flag: "wx" });

    const departmentIds = new Map(departments.map(d => [d.code, d.id]));
    for (const { department, changed } of departmentPlan) {
      if (!changed) continue;
      const row = await tx.department.upsert({ where: { code: department.code }, create: { code: department.code, name: department.name }, update: { name: department.name } });
      departmentIds.set(row.code, row.id);
    }
    const resetChallenges = async (id: string, oldEmail: string, newEmail: string) => {
      if (oldEmail === newEmail) return;
      await tx.user.update({ where: { id }, data: { emailVerifiedAt: null } });
      await tx.emailChallenge.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.accountSetupToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.loginCode.deleteMany({ where: { userId: id } });
    };
    for (const p of accountPlan.filter(p => p.changed)) {
      await tx.user.update({ where: { id: p.before.id }, data: p.desired });
      await resetChallenges(p.before.id, p.before.email, p.desired.email);
    }
    const newHash = summary.facultyCreated ? await bcrypt.hash(options.newAccountPassword!, 10) : undefined;
    const facultyIds = new Map(faculty.map(f => [f.employeeId, f.id]));
    for (const p of facultyPlan.filter(p => p.changed)) {
      if (p.before) {
        await tx.user.update({ where: { id: p.before.userId }, data: p.user });
        await tx.faculty.update({ where: { id: p.before.id }, data: p.profile });
        await resetChallenges(p.before.userId, p.before.user.email, p.user.email);
      } else {
        const row = await tx.faculty.create({ data: {
          employeeId: p.person.employeeId, department: { connect: { id: departmentIds.get(p.person.departmentCode)! } }, ...p.profile,
          user: { create: { ...p.user, passwordHash: newHash! } },
        } });
        facultyIds.set(p.person.employeeId, row.id);
      }
    }
    for (const { department } of departmentPlan.filter(p => p.changed)) {
      if (department.hodEmployeeId) await tx.department.update({ where: { code: department.code }, data: { hodId: facultyIds.get(department.hodEmployeeId)! } });
    }
    for (const p of studentPlan.filter(p => p.changed)) {
      await tx.user.update({ where: { id: p.before.userId }, data: p.user });
      if (Object.keys(p.profile).length) await tx.student.update({ where: { id: p.before.id }, data: p.profile });
      await resetChallenges(p.before.userId, p.before.user.email, p.user.email);
    }
    if (summary.collegeChanged) await tx.institution.upsert({ where: { id: 1 }, create: { id: 1, ...data.college }, update: data.college });
    if (JSON.stringify(await counts()) !== JSON.stringify(academicCounts)) throw new Error("Academic counts changed; rolling back.");
    for (const before of [...accountPlan.map(p => p.before), ...facultyPlan.flatMap(p => p.before ? [p.before.user] : []), ...studentPlan.map(p => p.before.user)]) {
      const after = await tx.user.findUniqueOrThrow({ where: { id: before.id } });
      if (after.passwordHash !== before.passwordHash || after.isActive !== before.isActive)
        throw new Error("An existing password or activation state changed; rolling back.");
    }
    await tx.auditLog.create({ data: { action: "IMPORT_COLLEGE_DATA", entity: "Institution", details: JSON.stringify(summary) } });
    return { ...summary, backup: join(folder, "before.json") };
  }, { timeout: 60000, isolationLevel: "Serializable" });
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.some(f => !["--validate", "--apply"].includes(f)) || (flags.includes("--validate") && flags.includes("--apply")))
    throw new Error("Use --validate, --apply, or no flags for a database preview.");
  const data = collegeDataSchema.parse(JSON.parse(readFileSync(new URL("../college-data.json", import.meta.url), "utf8")));
  if (flags.includes("--validate")) {
    console.log(`Valid college-data.json: ${data.faculty.length} faculty, ${data.students.length} students, ${data.departments.length} departments.`);
    return;
  }
  try { loadEnvFile(".env"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const db = new PrismaClient();
  try {
    console.log(JSON.stringify(await syncCollegeData(db, data, { apply: flags.includes("--apply"), newAccountPassword: process.env.COLLEGE_IMPORT_PASSWORD }), null, 2));
  } finally { await db.$disconnect(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    // Prisma connection errors may contain credentials; print only our own validation messages.
    if (error instanceof ZodError) console.error(error.issues.map(issue => `${issue.path.join(".") || "college-data.json"}: ${issue.message}`).join("\n"));
    else if (error instanceof Error && error.constructor === Error && !error.message.includes("DATABASE_URL")) console.error(error.message);
    else console.error("College data import stopped. Check file validation, database access and backup permissions. No partial database changes were committed.");
    process.exitCode = 1;
  });
}
