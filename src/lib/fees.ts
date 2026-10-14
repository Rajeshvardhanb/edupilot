import "server-only";

type Inv = {
  amount: number; concession: number; dueDate: Date; fine?: number; fineWaived?: boolean;
  payments: { amount: number }[]; instalments?: { dueDate: Date; amount: number }[];
};

/**
 * Payable = amount − concession + late fine. With an instalment plan, an invoice is
 * overdue only when less has been paid than the instalments that have fallen due.
 */
export function invoiceStatus(inv: Inv) {
  const fine = inv.fineWaived ? 0 : inv.fine ?? 0;
  const payable = inv.amount - inv.concession + fine;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((payable - paid) * 100) / 100);
  const now = new Date();
  const plan = inv.instalments ?? [];
  const dueByNow = plan.length ? plan.filter((i) => i.dueDate < now).reduce((s, i) => s + i.amount, 0) : inv.dueDate < now ? payable : 0;
  const arrears = Math.max(0, Math.min(balance, dueByNow - paid));
  const status = balance === 0 ? "PAID" : arrears > 0 ? "OVERDUE" : paid > 0 ? "PARTIAL" : "DUE";
  const nextDue = plan.length ? plan.slice().sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).find((i, idx, arr) => arr.slice(0, idx + 1).reduce((s, x) => s + x.amount, 0) > paid)?.dueDate ?? inv.dueDate : inv.dueDate;
  return { payable, paid, balance, fine, arrears, nextDue, status } as const;
}

export const statusTone = { PAID: "success", PARTIAL: "info", DUE: "warning", OVERDUE: "danger" } as const;
