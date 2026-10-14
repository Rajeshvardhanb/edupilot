"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { computePay, workingDaysIn } from "@/lib/payroll";
import type { ActionState } from "@/lib/action-state";

const money = (fd: FormData, k: string) => Math.max(0, Math.round(Number(fd.get(k)) || 0));

export async function saveSalary(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const userId = String(fd.get("userId"));
  const staff = await db.user.findFirst({ where: { id: userId, role: { in: ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"] } }, select: { name: true } });
  if (!staff) return { error: "Staff member not found." };
  const basic = money(fd, "basic"), pfPercent = Math.min(30, Math.max(0, Number(fd.get("pfPercent")) || 0));
  if (basic <= 0) return { error: "Enter the basic pay." };
  const data = { basic, hra: money(fd, "hra"), da: money(fd, "da"), allowances: money(fd, "allowances"), pfPercent, otherDeductions: money(fd, "otherDeductions") };
  await db.salaryStructure.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await audit(me.id, "SALARY", "User", userId, `basic ₹${basic}`);
  revalidatePath("/staff/payroll");
  return { ok: true, message: `Salary saved for ${staff.name}.` };
}

/**
 * Works out everyone's pay for a month and stores a payslip each. Running it again for the same
 * month recalculates those payslips, so it can be re-run after attendance is corrected.
 */
export async function runPayroll(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const month = String(fd.get("month") ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "Choose a month." };
  const from = new Date(`${month}-01T00:00:00Z`), to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
  if (from.getTime() > Date.now()) return { error: "That month has not started yet." };
  const [structures, holidays, attendance] = await Promise.all([
    db.salaryStructure.findMany({ where: { user: { isActive: true } } }),
    db.calendarEvent.findMany({ where: { type: "HOLIDAY", date: { lte: to }, OR: [{ endDate: { gte: from } }, { endDate: null, date: { gte: from } }] } }),
    db.staffAttendance.groupBy({ by: ["userId", "status"], where: { date: { gte: from, lte: to }, status: { in: ["ABSENT", "HALF_DAY"] } }, _count: true }),
  ]);
  if (!structures.length) return { error: "Nobody has a salary set yet. Enter salaries first." };
  const off: number[] = [];
  for (const h of holidays) for (let d = new Date(Math.max(h.date.getTime(), from.getTime())); d <= (h.endDate ?? h.date) && d <= to; d = new Date(d.getTime() + 864e5)) off.push(d.getUTCDate());
  const workingDays = workingDaysIn(month, off);
  const lop = new Map<string, number>();
  for (const a of attendance) lop.set(a.userId, (lop.get(a.userId) ?? 0) + a._count * (a.status === "HALF_DAY" ? 0.5 : 1));

  const slips = structures.map((s) => {
    const p = computePay(s, workingDays, lop.get(s.userId) ?? 0);
    return { userId: s.userId, month, workingDays, paidDays: p.paidDays, lopDays: p.lopDays, basic: s.basic, hra: s.hra, da: s.da, allowances: s.allowances, gross: p.gross, pf: p.pf, otherDeductions: p.otherDeductions, lopDeduction: p.lopDeduction, net: p.net };
  });
  // Existing payslips are updated in place, so a payslip someone has open or bookmarked stays valid after a re-run.
  await db.$transaction([
    db.payslip.deleteMany({ where: { month, userId: { notIn: slips.map((p) => p.userId) } } }),
    ...slips.map((p) => db.payslip.upsert({ where: { userId_month: { userId: p.userId, month } }, create: p, update: { ...p, generatedAt: new Date() } })),
  ]);
  await audit(me.id, "PAYROLL", "Payslip", month, `${slips.length} payslips, net ₹${slips.reduce((t, s) => t + s.net, 0)}`);
  await notifyUsers(slips.map((s) => s.userId).filter((id) => id !== me.id), { title: `Payslip ready: ${from.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}`, body: "Your payslip for the month is available under Staff → Payroll.", href: "/staff/payroll" });
  revalidatePath("/staff/payroll");
  return { ok: true, message: `Payroll run for ${slips.length} staff · ${workingDays} working days · net ₹${slips.reduce((t, s) => t + s.net, 0).toLocaleString("en-IN")}.` };
}
