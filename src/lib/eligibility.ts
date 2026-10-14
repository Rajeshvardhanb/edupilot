import "server-only";
import { db } from "./db";
import { attendanceSummary } from "./attendance";
import { getRules } from "./rules";
import { invoiceStatus } from "./fees";
import { pct } from "./format";

export type HallTicketStatus = { attendance: number; feeDue: number; condoned: boolean; eligible: boolean; reasons: string[] };

/**
 * Hall-ticket rule: attendance at or above the required percentage (or in the condonation band with an
 * approved medical leave)
 * and no overdue fee balance.
 */
export async function hallTicketStatus(studentIds: string[], termId: string | undefined): Promise<Map<string, HallTicketStatus>> {
  const { attendanceRequired: ATTENDANCE_REQUIRED, attendanceCondonable: ATTENDANCE_CONDONABLE } = await getRules();
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, batchId: true, invoices: { include: { payments: { select: { amount: true } }, instalments: true } }, leaves: { where: { type: "MEDICAL", status: "APPROVED" }, select: { id: true } } },
  });
  const offerings = await db.courseOffering.findMany({ where: { termId, batchId: { in: [...new Set(students.map((s) => s.batchId))] } }, select: { id: true } });
  const summary = await attendanceSummary({ studentIds, offeringIds: offerings.map((o) => o.id) });
  const totals = new Map<string, { a: number; t: number }>();
  for (const [k, v] of summary) {
    const sid = k.split(":")[0];
    const x = totals.get(sid) ?? { a: 0, t: 0 };
    x.a += v.attended; x.t += v.total; totals.set(sid, x);
  }
  return new Map(students.map((s) => {
    const t = totals.get(s.id) ?? { a: 0, t: 0 };
    const attendance = t.t ? pct(t.a, t.t) : 100;
    const feeDue = s.invoices.reduce((sum, inv) => { const st = invoiceStatus(inv); return sum + (st.status === "OVERDUE" ? st.balance : 0); }, 0);
    const condoned = attendance < ATTENDANCE_REQUIRED && attendance >= ATTENDANCE_CONDONABLE && s.leaves.length > 0;
    const reasons: string[] = [];
    if (attendance < ATTENDANCE_REQUIRED && !condoned) reasons.push(attendance >= ATTENDANCE_CONDONABLE ? `Attendance ${attendance}% — needs condonation (approved medical leave)` : `Attendance ${attendance}% is below ${ATTENDANCE_CONDONABLE}%`);
    if (feeDue > 0) reasons.push(`Overdue fee ₹${feeDue.toLocaleString("en-IN")}`);
    return [s.id, { attendance, feeDue, condoned, eligible: reasons.length === 0, reasons }];
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
