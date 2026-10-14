import "server-only";
import { execFile } from "node:child_process";
import { db } from "./db";
import { getRules } from "./rules";
import { currentTerm } from "./scope";
import { attendanceSummary } from "./attendance";
import { invoiceStatus } from "./fees";
import { appUrl, sendMail } from "./mail";
import { batchLabel, daysAgo, pct } from "./format";
import { recalculateLateFines } from "./fines";

export const SCHEDULED: Record<string, { label: string; description: string; roles: string[] }> = {
  attendance: { label: "Attendance summary", description: "Attendance % and students below the required percentage, batch by batch", roles: ["ADMIN", "HOD"] },
  fees: { label: "Fee collection summary", description: "Collected in the period, outstanding and overdue", roles: ["ADMIN", "ACCOUNTANT"] },
  pending: { label: "Pending approvals", description: "Leave requests, certificates and helpdesk tickets waiting", roles: ["ADMIN", "HOD"] },
};
const inr = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;

/** Plain-text body of one scheduled report for one recipient (HODs get their department only). */
export async function buildSummary(user: { id: string; role: string; departmentId: string | null }, key: string, days: number): Promise<{ subject: string; text: string; href: string } | null> {
  const dept = user.role === "HOD" ? { departmentId: user.departmentId ?? "-" } : {};
  if (key === "attendance") {
    const term = await currentTerm();
    const need = (await getRules()).attendanceRequired;
    const batches = await db.batch.findMany({ where: { program: dept, offerings: { some: { termId: term?.id } } }, include: { program: true, offerings: { where: { termId: term?.id }, select: { id: true } } }, orderBy: [{ program: { code: "asc" } }, { admissionYear: "desc" }] });
    const lines: string[] = [];
    for (const b of batches) {
      const summary = await attendanceSummary({ offeringIds: b.offerings.map((o) => o.id) });
      const per = new Map<string, { a: number; t: number }>();
      for (const [k, v] of summary) { const id = k.split(":")[0]; const x = per.get(id) ?? { a: 0, t: 0 }; x.a += v.attended; x.t += v.total; per.set(id, x); }
      const all = [...per.values()].reduce((s, v) => ({ a: s.a + v.a, t: s.t + v.t }), { a: 0, t: 0 });
      lines.push(`${batchLabel(b).padEnd(16)} ${String(pct(all.a, all.t)).padStart(5)}%   below ${need}%: ${[...per.values()].filter((v) => pct(v.a, v.t) < need).length} of ${per.size}`);
    }
    return { subject: "Attendance summary", text: `Attendance for ${term?.name ?? "the current term"}:\n\n${lines.join("\n") || "No classes recorded yet."}`, href: "/attendance/report" };
  }
  if (key === "fees") {
    const [invoices, recent] = await Promise.all([
      db.feeInvoice.findMany({ include: { payments: { select: { amount: true } }, instalments: true } }),
      db.payment.aggregate({ where: { paidAt: { gte: daysAgo(days) } }, _sum: { amount: true }, _count: true }),
    ]);
    const t = invoices.reduce((s, i) => { const st = invoiceStatus(i); return { payable: s.payable + st.payable, paid: s.paid + st.paid, overdue: s.overdue + (st.status === "OVERDUE" ? 1 : 0), arrears: s.arrears + st.arrears }; }, { payable: 0, paid: 0, overdue: 0, arrears: 0 });
    return { subject: "Fee collection summary", text: `Collected in the last ${days} days: ${inr(recent._sum.amount ?? 0)} across ${recent._count} receipts.\n\nTotal demand:  ${inr(t.payable)}\nCollected:     ${inr(t.paid)} (${pct(t.paid, t.payable)}%)\nOutstanding:   ${inr(t.payable - t.paid)}\nOverdue:       ${t.overdue} invoices, ${inr(t.arrears)} past due`, href: "/fees" };
  }
  if (key === "pending") {
    const studentDept = user.role === "HOD" ? { student: { batch: { program: dept } } } : {};
    const [leave, staffLeave, certs, tickets] = await Promise.all([
      db.leaveRequest.count({ where: { status: "PENDING", ...studentDept } }),
      db.staffLeave.count({ where: { status: "PENDING", ...(user.role === "HOD" ? { user: { faculty: dept } } : {}) } }),
      user.role === "ADMIN" ? db.certificateRequest.count({ where: { status: "PENDING" } }) : 0,
      user.role === "ADMIN" ? db.ticket.count({ where: { status: { not: "RESOLVED" } } }) : 0,
    ]);
    return { subject: "Pending approvals", text: `Waiting for action:\n\nStudent leave / on-duty requests: ${leave}\nStaff leave requests:             ${staffLeave}${user.role === "ADMIN" ? `\nCertificate requests:             ${certs}\nOpen helpdesk tickets:            ${tickets}` : ""}`, href: "/dashboard" };
  }
  return null;
}

export async function sendSchedule(scheduleId: string) {
  const s = await db.reportSchedule.findUnique({ where: { id: scheduleId }, include: { user: { include: { faculty: { select: { departmentId: true } } } } } });
  if (!s || !s.user.isActive) return "SKIPPED" as const;
  const summary = await buildSummary({ id: s.userId, role: s.user.role, departmentId: s.user.faculty?.departmentId ?? null }, s.report, s.frequency === "MONTHLY" ? 30 : 7);
  if (!summary) return "SKIPPED" as const;
  const status = await sendMail({ to: s.user.email, subject: `${s.frequency === "MONTHLY" ? "Monthly" : "Weekly"} report: ${summary.subject}`, text: `Hello ${s.user.name},\n\n${summary.text}`, link: { label: "Open in the portal", url: appUrl(summary.href) } });
  await db.reportSchedule.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
  return status;
}

/** Runs scripts/backup.mjs (needs the mysqldump tool on this machine). Never throws. */
function runBackup(): Promise<string> {
  return new Promise((resolve) => {
    execFile(process.execPath, ["scripts/backup.mjs"], { timeout: 10 * 60_000 }, (err, stdout, stderr) => {
      if (err) { console.error("nightly backup failed", stderr || err.message); resolve(`failed (${(stderr || err.message).trim().split("\n")[0].slice(0, 120)})`); }
      else resolve(stdout.trim().split("\n")[0].slice(0, 120));
    });
  });
}

/**
 * Once-a-day housekeeping, run from the hourly tick. An audit-log entry marks the day as done,
 * so a restart (or several servers) cannot run it twice.
 */
export async function runDailyJobs() {
  const today = new Date(new Date().toISOString().slice(0, 10));
  if (await db.auditLog.findFirst({ where: { action: "DAILY_JOBS", createdAt: { gte: today } }, select: { id: true } })) return false;
  await db.auditLog.create({ data: { action: "DAILY_JOBS", entity: "System", details: "started" } });
  const fines = await recalculateLateFines();
  const backup = process.env.AUTO_BACKUP === "1" ? await runBackup() : "off";
  // Tidy up: sign-in attempts older than 30 days and spent or expired reset links.
  const old = new Date(Date.now() - 30 * 864e5);
  const attempts = await db.loginAttempt.deleteMany({ where: { createdAt: { lt: old } } });
  const tokens = await db.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } });
  await db.auditLog.create({ data: { action: "DAILY_JOBS", entity: "System", details: `late fines: ${fines === null ? "no rate set" : `${fines} invoices updated`}; removed ${attempts.count} old sign-in records and ${tokens.count} reset links; backup: ${backup}` } });
  return true;
}

/** Sends every schedule whose period has elapsed. Called hourly by the server and by the cron endpoint. */
export async function runDueSchedules() {
  const all = await db.reportSchedule.findMany({ select: { id: true, frequency: true, lastSentAt: true } });
  const due = all.filter((s) => !s.lastSentAt || Date.now() - s.lastSentAt.getTime() >= (s.frequency === "MONTHLY" ? 30 : 7) * 864e5 - 3600e3);
  for (const s of due) await sendSchedule(s.id).catch((e) => console.error("scheduled report failed", e));
  return due.length;
}
