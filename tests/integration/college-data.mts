// Runs only in edupilot_test. All fixture/import writes are rolled back, even on success.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import original from "../../college-data.json";
import { syncCollegeData } from "../../scripts/college-data.mts";
import { collegeDataSchema } from "../../src/lib/college-data-schema";

try { loadEnvFile(".env"); } catch { /* CI may supply DATABASE_URL */ }
const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("Integration tests require local MySQL.");
url.pathname = "/edupilot_test";
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const backupRoot = mkdtempSync(join(tmpdir(), "college-import-test-"));
const rollback = new Error("ROLLBACK_TEST_FIXTURES");
try {
  await db.$transaction(async tx => {
    const tag = `test${randomUUID().slice(0, 8)}`;
    const data = collegeDataSchema.parse(structuredClone(original));
    data.departments = data.departments.map(d => ({ ...d, code: tag + d.code, hodEmployeeId: d.hodEmployeeId ? tag + d.hodEmployeeId : null }));
    data.faculty = data.faculty.map((f, i) => ({ ...f, employeeId: tag + f.employeeId, departmentCode: tag + f.departmentCode, email: `${tag}.faculty${i}@example.org` }));
    data.students = data.students.map((s, i) => ({ ...s, rollNo: tag + s.rollNo, email: `${tag}.student${i}@example.org` }));
    data.accounts = data.accounts.map(a => ({ ...a, matchEmail: tag + a.email, email: tag + a.email }));
    data.demoLogins.hodEmployeeId = tag + data.demoLogins.hodEmployeeId;
    data.demoLogins.facultyEmployeeId = tag + data.demoLogins.facultyEmployeeId;
    data.demoLogins.studentRollNo = tag + data.demoLogins.studentRollNo;
    const passwordHash = await bcrypt.hash("keep-this-password", 4);
    for (const a of data.accounts) await tx.user.create({ data: { email: a.matchEmail, name: "Old staff", role: a.role, passwordHash, isActive: false } });
    for (const d of data.departments) await tx.department.create({ data: { code: d.code, name: d.name } });
    const department = await tx.department.findUniqueOrThrow({ where: { code: data.departments[0].code } });
    for (const [i, f] of data.faculty.slice(0, 8).entries()) {
      const row = await tx.faculty.create({ data: {
        employeeId: f.employeeId, departmentId: department.id, designation: "Old title", qualification: "Old qualification",
        userId: (await tx.user.create({ data: { email: f.email, name: "Old faculty", role: i === 0 ? "HOD" : "FACULTY", passwordHash, isActive: false } })).id,
      } });
      if (i === 0) await tx.department.update({ where: { id: department.id }, data: { hodId: row.id } });
    }
    const program = await tx.program.create({ data: { code: tag, name: "Test program", level: "UG", durationYears: 4, totalSemesters: 8, departmentId: department.id } });
    const batch = await tx.batch.create({ data: { programId: program.id, admissionYear: 2024, section: tag } });
    for (const s of data.students) await tx.student.create({ data: {
      rollNo: s.rollNo, batchId: batch.id, admissionDate: new Date("2024-08-01"), guardianName: "Keep guardian",
      userId: (await tx.user.create({ data: { name: "Old student", email: s.email, role: "STUDENT", passwordHash, isActive: false } })).id,
    } });
    const student = await tx.student.findUniqueOrThrow({ where: { rollNo: data.students[0].rollNo } });
    const teacher = await tx.faculty.findUniqueOrThrow({ where: { employeeId: data.faculty[0].employeeId } });
    const term = await tx.term.create({ data: { name: tag, startDate: new Date("2026-07-01"), endDate: new Date("2026-12-01") } });
    const subject = await tx.subject.create({ data: { code: tag, name: "Test subject", programId: program.id, semester: 1, credits: 3 } });
    const course = await tx.courseOffering.create({ data: { subjectId: subject.id, batchId: batch.id, termId: term.id, facultyId: teacher.id } });
    const assessment = await tx.assessment.create({ data: { offeringId: course.id, name: "Test midterm", type: "MID_TERM", maxMarks: 20 } });
    const mark = await tx.mark.create({ data: { assessmentId: assessment.id, studentId: student.id, marks: 17 } });
    const session = await tx.attendanceSession.create({ data: { offeringId: course.id, date: new Date("2026-09-01"), period: 1 } });
    const attendance = await tx.attendanceRecord.create({ data: { sessionId: session.id, studentId: student.id, status: "PRESENT" } });

    // Reuse this outer transaction so even successful import writes can be rolled back.
    const nested = { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
    const usersBefore = await tx.user.count();
    const preview = await syncCollegeData(nested, data);
    assert.equal(preview.facultyCreated, 32);
    assert.equal(await tx.user.count(), usersBefore);
    await assert.rejects(syncCollegeData(nested, data, { apply: true, backupRoot }), /COLLEGE_IMPORT_PASSWORD/);
    assert.equal(await tx.user.count(), usersBefore);
    const result = await syncCollegeData(nested, data, { apply: true, newAccountPassword: "new-faculty-password", backupRoot });
    assert.equal(result.facultyCreated, 32);
    assert.equal(await tx.user.count(), usersBefore + 32);
    assert.equal((await tx.faculty.findUniqueOrThrow({ where: { id: teacher.id } })).userId, teacher.userId);
    assert.deepEqual(await tx.mark.findUniqueOrThrow({ where: { id: mark.id } }), mark);
    assert.deepEqual(await tx.attendanceRecord.findUniqueOrThrow({ where: { id: attendance.id } }), attendance);
    const preserved = await tx.user.findUniqueOrThrow({ where: { id: teacher.userId } });
    assert.equal(preserved.passwordHash, passwordHash);
    assert.equal(preserved.isActive, false);
    assert.equal((await tx.student.findUniqueOrThrow({ where: { id: student.id } })).guardianName, "Keep guardian");
    const newFaculty = await tx.faculty.findUniqueOrThrow({ where: { employeeId: data.faculty[39].employeeId }, include: { user: true } });
    assert.equal(await bcrypt.compare("new-faculty-password", newFaculty.user.passwordHash), true);
    assert.equal((await syncCollegeData(nested, data, { apply: true, backupRoot })).mode, "already-current");
    const missing = structuredClone(data);
    missing.students[0].rollNo = "NOT_REGISTERED";
    await assert.rejects(syncCollegeData(nested, missing, { apply: true, backupRoot }), /Register new students/);
    const collision = structuredClone(data);
    collision.faculty[0].email = "external-owner@example.org";
    await tx.user.create({ data: { email: collision.faculty[0].email, name: "External owner", role: "FACULTY", passwordHash } });
    await assert.rejects(syncCollegeData(nested, collision, { apply: true, backupRoot }), /already owned/);
    const switched = structuredClone(data);
    switched.departments[0].hodEmployeeId = switched.faculty[6].employeeId;
    switched.demoLogins.hodEmployeeId = switched.faculty[6].employeeId;
    await syncCollegeData(nested, switched, { apply: true, backupRoot });
    assert.equal((await tx.user.findUniqueOrThrow({ where: { id: teacher.userId } })).role, "FACULTY");
    const head = await tx.department.findUniqueOrThrow({ where: { id: department.id }, include: { hod: { include: { user: true } } } });
    assert.equal(head.hod?.employeeId, switched.faculty[6].employeeId);
    assert.equal(head.hod?.user.role, "HOD");
    const shorter = structuredClone(switched);
    shorter.faculty.pop();
    await syncCollegeData(nested, shorter, { apply: true, backupRoot });
    assert.ok(await tx.faculty.findUnique({ where: { id: newFaculty.id } }));
    throw rollback;
  }, { timeout: 60000 });
} catch (error) {
  if (error !== rollback) throw error;
  console.log("PASS: preview, 32 new faculty, stable IDs/passwords/academic records, idempotency, collision rejection, HOD changes, removal preservation and complete fixture rollback.");
} finally {
  await db.$disconnect();
  rmSync(backupRoot, { recursive: true, force: true });
}
