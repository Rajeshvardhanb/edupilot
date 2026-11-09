import "server-only";
import { attendanceSummary } from "./attendance";
import { db } from "./db";
import { pct } from "./format";
import { getRules } from "./rules";

export type HallTicketStatus = { attendance: number; condoned: boolean; eligible: boolean; reasons: string[] };

/** A term-specific HOD/Admin decision controls condonation. Fees are not recorded here. */
export async function hallTicketStatus(studentIds: string[], termId: string | undefined): Promise<Map<string, HallTicketStatus>> {
  const { attendanceRequired: required, attendanceCondonable: minimum } = await getRules();
  const students = await db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, batchId: true } });
  if (!termId) return new Map(students.map(s => [s.id, { attendance: 0, condoned: false, eligible: false, reasons: ["No academic term is configured. Contact Administration."] }]));
  const decisions = await db.attendanceCondonation.findMany({ where: { studentId: { in: studentIds }, termId }, select: { studentId: true, status: true } });
  const approved = new Set(decisions.filter(d => d.status === "APPROVED").map(d => d.studentId));
  const offerings = await db.courseOffering.findMany({ where: { termId, batchId: { in: [...new Set(students.map(s => s.batchId))] } }, select: { id: true } });
  const summary = await attendanceSummary({ studentIds, offeringIds: offerings.map(o => o.id) });
  const totals = new Map<string, { a: number; t: number }>();
  for (const [k, v] of summary) {
    const sid = k.split(":")[0], x = totals.get(sid) ?? { a: 0, t: 0 };
    x.a += v.attended; x.t += v.total; totals.set(sid, x);
  }
  return new Map(students.map(s => {
    const t = totals.get(s.id) ?? { a: 0, t: 0 }, attendance = t.t ? pct(t.a, t.t) : 100;
    const condoned = attendance < required && attendance >= minimum && approved.has(s.id);
    const reasons: string[] = [];
    if (attendance < required && !condoned) reasons.push(attendance >= minimum
      ? `Attendance ${attendance}% — contact Administration. HOD or Admin must approve condonation for this term.`
      : `Attendance ${attendance}% is below ${minimum}%. Condonation cannot release this hall ticket.`);
    return [s.id, { attendance, condoned, eligible: reasons.length === 0, reasons }];
  }));
}

/** Subjects a student has failed and not yet cleared. */
export async function backlogSubjects(studentId: string) {
  const results = await db.subjectResult.findMany({ where: { studentId }, include: { offering: { include: { subject: true, term: true } } }, orderBy: { createdAt: "asc" } });
  const best = new Map<string, (typeof results)[number]>();
  for (const r of results) {
    const prev = best.get(r.offering.subjectId);
    if (!prev || r.gradePoint > prev.gradePoint) best.set(r.offering.subjectId, r);
  }
  return [...best.values()].filter((r) => !r.passed);
}
