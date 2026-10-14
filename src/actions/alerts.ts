"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getRules } from "@/lib/rules";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { currentTerm, studentScope } from "@/lib/scope";
import { attendanceSummary } from "@/lib/attendance";
import { invoiceStatus } from "@/lib/fees";
import { notifyStudents } from "@/lib/notify";
import { mailConfigured, sendMail } from "@/lib/mail";
import { getInstitution } from "@/lib/institution";
import { pct } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";

const delivery = () => (mailConfigured() ? "" : " No mail server is configured yet, so emails are saved in the outbox instead of being delivered.");

export async function markNotificationsRead(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = String(fd.get("id") ?? "");
  await db.notification.updateMany({ where: { userId: me.id, readAt: null, ...(id && { id }) }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Emails every student (and parent) in a batch whose attendance is under the threshold. */
export async function emailShortage(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const rules = await getRules();
  const batchId = String(fd.get("batchId")), below = Number(fd.get("below")) || rules.attendanceRequired;
  const term = await currentTerm();
  const students = await db.student.findMany({ where: { batchId, status: "ACTIVE", ...studentScope(me) }, select: { id: true } });
  const offerings = await db.courseOffering.findMany({ where: { batchId, termId: term?.id }, select: { id: true } });
  const summary = await attendanceSummary({ studentIds: students.map((s) => s.id), offeringIds: offerings.map((o) => o.id) });
  const totals = new Map<string, { a: number; t: number }>();
  for (const [k, v] of summary) { const id = k.split(":")[0]; const x = totals.get(id) ?? { a: 0, t: 0 }; x.a += v.attended; x.t += v.total; totals.set(id, x); }
  const short = [...totals].map(([id, v]) => ({ id, p: pct(v.a, v.t) })).filter((x) => x.p < below);
  if (!short.length) return { error: "No students are below that threshold." };
  const inst = await getInstitution();
  for (const s of short) {
    await notifyStudents([s.id], (st) => ({
      title: `Attendance shortage: ${s.p}%`, href: "/attendance", email: true,
      body: `${st.name} (${st.rollNo}) has ${s.p}% attendance this term. A minimum of ${rules.attendanceRequired}% is required to appear for the end-semester examinations. Please ensure regular attendance, or apply for condonation with supporting documents if eligible.\n\n— ${inst.name}`,
    }));
  }
  await db.parentContact.createMany({ data: short.map((x) => ({ studentId: x.id, channel: "EMAIL", purpose: "ATTENDANCE", message: `Attendance shortage alert: ${x.p}% this term (minimum ${rules.attendanceRequired}%).`, byId: me.id })) });
  await audit(me.id, "EMAIL_SHORTAGE", "Batch", batchId, `${short.length} students`);
  return { ok: true, message: `Alerts sent for ${short.length} student(s).${delivery()}` };
}

/** Emails a reminder for every overdue invoice. */
export async function emailFeeReminders(...args: [ActionState, FormData]): Promise<ActionState> {
  void args;
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const invoices = await db.feeInvoice.findMany({ include: { payments: { select: { amount: true } }, instalments: true } });
  const due = invoices.map((i) => ({ i, st: invoiceStatus(i) })).filter((x) => x.st.status === "OVERDUE");
  if (!due.length) return { error: "No overdue invoices." };
  const inst = await getInstitution();
  for (const { i, st } of due) {
    await notifyStudents([i.studentId], (s) => ({
      title: `Fee reminder: ₹${st.balance.toLocaleString("en-IN")} overdue`, href: "/fees", email: true,
      body: `This is a reminder that ₹${st.balance.toLocaleString("en-IN")} is overdue on invoice ${i.invoiceNo} (${i.title}) for ${s.name} (${s.rollNo}). Please pay at the accounts section or online through the portal to avoid late fines.\n\n— Accounts, ${inst.name}`,
    }));
  }
  await db.parentContact.createMany({ data: due.map(({ i, st }) => ({ studentId: i.studentId, channel: "EMAIL", purpose: "FEES", message: `Fee reminder: ₹${st.balance.toLocaleString("en-IN")} overdue on invoice ${i.invoiceNo}.`, byId: me.id })) });
  await audit(me.id, "EMAIL_FEE_REMINDERS", "FeeInvoice", undefined, `${due.length} invoices`);
  return { ok: true, message: `Reminders sent for ${due.length} overdue invoice(s).${delivery()}` };
}

export async function sendTestEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  const to = String(fd.get("to") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { error: "Enter an email address." };
  const status = await sendMail({ to, subject: "Test email", text: "If you are reading this, email alerts are set up correctly." });
  revalidatePath("/admin/email");
  if (status === "SENT") return { ok: true, message: `Sent to ${to}.` };
  if (status === "NOT_CONFIGURED") return { error: "No mail server is configured. Add the SMTP settings to .env and restart the app." };
  return { error: "The mail server rejected the message. See the error in the outbox below." };
}
