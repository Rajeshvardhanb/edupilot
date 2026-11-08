import { Prisma } from "@prisma/client";
import "server-only";
import { attendanceSummary } from "./attendance";
import { db } from "./db";
import { visibleStudentIdsSql } from "./student-visibility";
import { daysAgo,pct } from "./format";
import { studentStandings } from "./results";

/** Daily attendance % for the given offerings over the last `days` days. */
export async function dailyAttendance(offeringIds: string[], days = 30) {
  if (!offeringIds.length) return [];
  const rows = await db.$queryRaw<{ d: Date; present: bigint; total: bigint }[]>`
    SELECT s.date AS d, SUM(r.status IN ('PRESENT','LATE','ON_DUTY')) AS present, COUNT(*) AS total
    FROM AttendanceRecord r JOIN AttendanceSession s ON s.id = r.sessionId
    WHERE r.studentId IN (${visibleStudentIdsSql}) AND s.date >= ${daysAgo(days)} AND s.offeringId IN (${Prisma.join(offeringIds)})
    GROUP BY s.date ORDER BY s.date`;
  return rows.map((r) => ({ date: new Date(r.d), value: pct(Number(r.present), Number(r.total)) }));
}

export async function demographics(where: Prisma.StudentWhereInput) {
  const base = { ...where, status: "ACTIVE" as const };
  const [gender, admission, category] = await Promise.all([
    db.student.groupBy({ by: ["gender"], where: base, _count: true }),
    db.student.groupBy({ by: ["admissionType"], where: base, _count: true }),
    db.student.groupBy({ by: ["category"], where: base, _count: true }),
  ]);
  return { gender, admission, category };
}

/** CGPA bands across students with at least one published result. */
export async function cgpaDistribution(studentIds: string[]) {
  const st = await studentStandings(studentIds);
  const bands = [
    { label: "< 5", min: 0, max: 5 }, { label: "5–6", min: 5, max: 6 }, { label: "6–7", min: 6, max: 7 },
    { label: "7–8", min: 7, max: 8 }, { label: "8–9", min: 8, max: 9 }, { label: "9–10", min: 9, max: 10.01 },
  ];
  const values = [...st.values()].filter((s) => s.creditsEarned > 0 || s.backlogs > 0).map((s) => s.cgpa);
  return {
    bands: bands.map((b) => ({ label: b.label, value: values.filter((v) => v >= b.min && v < b.max).length })),
    average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : 0,
    withBacklogs: [...st.values()].filter((s) => s.backlogs > 0).length,
  };
}

/** Per-department snapshot: students, faculty, current attendance %, last-term pass %. */
export async function departmentSnapshots(termId?: string, lastTermId?: string, departmentId?: string) {
  const depts = await db.department.findMany({
    where: departmentId ? { id: departmentId } : {},
    include: {
      hod: { include: { user: { select: { name: true } } } },
      _count: { select: { faculty: true } },
      programs: { select: { id: true, batches: { select: { id: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } } } },
    },
    orderBy: { code: "asc" },
  });
  const offerings = termId ? await db.courseOffering.findMany({ where: { termId }, select: { id: true, batch: { select: { program: { select: { departmentId: true } } } } } }) : [];
  const summary = await attendanceSummary({ offeringIds: offerings.map((o) => o.id) });
  const offDept = new Map(offerings.map((o) => [o.id, o.batch.program.departmentId]));
  const att = new Map<string, { a: number; t: number }>();
  for (const [k, v] of summary) {
    const d = offDept.get(k.split(":")[1])!;
    const x = att.get(d) ?? { a: 0, t: 0 };
    x.a += v.attended; x.t += v.total; att.set(d, x);
  }
  // Last term's pass rate per department, counted by the database.
  const pass = lastTermId
    ? await db.$queryRaw<{ departmentId: string; p: bigint; t: bigint }[]>`
        SELECT pr.departmentId, SUM(r.passed) AS p, COUNT(*) AS t
        FROM SubjectResult r JOIN CourseOffering o ON o.id = r.offeringId JOIN Batch b ON b.id = o.batchId JOIN Program pr ON pr.id = b.programId
        WHERE r.studentId IN (${visibleStudentIdsSql}) AND o.termId = ${lastTermId} GROUP BY pr.departmentId`
    : [];
  const passMap = new Map(pass.map((r) => [r.departmentId, { p: Number(r.p), t: Number(r.t) }]));
  return depts.map((d) => ({
    id: d.id, code: d.code, name: d.name, hod: d.hod?.user.name ?? null, faculty: d._count.faculty,
    programs: d.programs.length,
    students: d.programs.flatMap((p) => p.batches).reduce((s, b) => s + b._count.students, 0),
    attendance: att.get(d.id) ? pct(att.get(d.id)!.a, att.get(d.id)!.t) : 0,
    passRate: passMap.get(d.id) ? pct(passMap.get(d.id)!.p, passMap.get(d.id)!.t) : 0,
  }));
}

export function termProgress(term: { startDate: Date; endDate: Date } | null) {
  if (!term) return { week: 0, weeks: 0, percent: 0 };
  const now = Date.now(), s = term.startDate.getTime(), e = term.endDate.getTime();
  const weeks = Math.ceil((e - s) / (7 * 864e5));
  const week = Math.min(weeks, Math.max(1, Math.ceil((now - s) / (7 * 864e5))));
  return { week, weeks, percent: Math.round(Math.min(1, Math.max(0, (now - s) / (e - s))) * 100) };
}

export function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name.replace(/^(Dr|Prof)\.?\s+/i, "").split(" ")[0]}`;
}
