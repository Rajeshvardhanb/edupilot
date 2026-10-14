import type { PrismaClient } from "@prisma/client";

/** The fee totals as the app now computes them: in SQL (kept in step with src/lib/fee-ledger.ts). */
export async function feeTotalsSql(db: PrismaClient) {
  const rows = await db.$queryRawUnsafe<{ status: string; n: bigint; payable: number; paid: number }[]>(`
    SELECT g.status, COUNT(*) AS n, SUM(g.payable) AS payable, SUM(g.paid) AS paid FROM (
      SELECT l.*, CASE WHEN l.balance = 0 THEN 'PAID' WHEN LEAST(l.balance, l.dueByNow - l.paid) > 0 THEN 'OVERDUE' WHEN l.paid > 0 THEN 'PARTIAL' ELSE 'DUE' END AS status FROM (
        SELECT i.id, (i.amount - i.concession + IF(i.fineWaived, 0, i.fine)) AS payable, COALESCE(p.paid, 0) AS paid,
          GREATEST(0, ROUND(i.amount - i.concession + IF(i.fineWaived, 0, i.fine) - COALESCE(p.paid, 0), 2)) AS balance,
          IF(COALESCE(x.n, 0) > 0, x.dueNow, IF(i.dueDate < UTC_TIMESTAMP(), i.amount - i.concession + IF(i.fineWaived, 0, i.fine), 0)) AS dueByNow
        FROM FeeInvoice i LEFT JOIN (SELECT invoiceId, SUM(amount) AS paid FROM Payment GROUP BY invoiceId) p ON p.invoiceId = i.id
        LEFT JOIN (SELECT invoiceId, COUNT(*) AS n, SUM(IF(dueDate < UTC_TIMESTAMP(), amount, 0)) AS dueNow FROM Instalment GROUP BY invoiceId) x ON x.invoiceId = i.id) l) g
    GROUP BY g.status`);
  return { overdue: Number(rows.find((r) => r.status === "OVERDUE")?.n ?? 0), paid: rows.reduce((t, r) => t + Number(r.paid), 0), payable: rows.reduce((t, r) => t + Number(r.payable), 0) };
}

/** The same totals worked out invoice by invoice with the rules in src/lib/fees.ts (repeated here: that file is server-only). */
export async function jsOverdueCount(db: PrismaClient) {
  const invoices = await db.feeInvoice.findMany({ include: { payments: { select: { amount: true } }, instalments: true } });
  const now = new Date();
  let overdue = 0, paidAll = 0, payableAll = 0;
  for (const inv of invoices) {
    const payable = inv.amount - inv.concession + (inv.fineWaived ? 0 : inv.fine);
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, Math.round((payable - paid) * 100) / 100);
    const dueByNow = inv.instalments.length ? inv.instalments.filter((i) => i.dueDate < now).reduce((s, i) => s + i.amount, 0) : inv.dueDate < now ? payable : 0;
    if (balance > 0 && Math.min(balance, dueByNow - paid) > 0) overdue++;
    paidAll += paid; payableAll += payable;
  }
  return { overdue, paid: paidAll, payable: payableAll };
}
