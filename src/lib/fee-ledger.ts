import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Fee position of every invoice, worked out by the database instead of loading every invoice and
 * payment into memory. It applies the same rules as invoiceStatus() in fees.ts:
 * payable = amount − concession + unwaived fine; overdue when less has been paid than has fallen due.
 * (tests/e2e checks the two agree.)
 */
const LEDGER = Prisma.sql`
  SELECT l.*, GREATEST(0, LEAST(l.balance, l.dueByNow - l.paid)) AS arrears,
    CASE WHEN l.balance = 0 THEN 'PAID' WHEN LEAST(l.balance, l.dueByNow - l.paid) > 0 THEN 'OVERDUE' WHEN l.paid > 0 THEN 'PARTIAL' ELSE 'DUE' END AS status
  FROM (
    SELECT i.id AS invoiceId, i.studentId,
      (i.amount - i.concession + IF(i.fineWaived, 0, i.fine)) AS payable,
      COALESCE(p.paid, 0) AS paid,
      GREATEST(0, ROUND(i.amount - i.concession + IF(i.fineWaived, 0, i.fine) - COALESCE(p.paid, 0), 2)) AS balance,
      IF(COALESCE(x.n, 0) > 0, x.dueNow, IF(i.dueDate < UTC_TIMESTAMP(), i.amount - i.concession + IF(i.fineWaived, 0, i.fine), 0)) AS dueByNow
    FROM FeeInvoice i
    LEFT JOIN (SELECT invoiceId, SUM(amount) AS paid FROM Payment GROUP BY invoiceId) p ON p.invoiceId = i.id
    LEFT JOIN (SELECT invoiceId, COUNT(*) AS n, SUM(IF(dueDate < UTC_TIMESTAMP(), amount, 0)) AS dueNow FROM Instalment GROUP BY invoiceId) x ON x.invoiceId = i.id
  ) l`;

export type FeeFilter = { departmentId?: string; studentId?: string };

const scope = (f: FeeFilter) =>
  f.studentId ? Prisma.sql`WHERE g.studentId = ${f.studentId}`
  : f.departmentId ? Prisma.sql`JOIN Student s ON s.id = g.studentId JOIN Batch b ON b.id = s.batchId JOIN Program pr ON pr.id = b.programId WHERE pr.departmentId = ${f.departmentId}`
  : Prisma.empty;

const n = (v: unknown) => Number(v ?? 0);

/** Demand, collection and the number of invoices in each state, for the whole college, one department or one student. */
export async function feeTotals(filter: FeeFilter = {}) {
  const rows = await db.$queryRaw<{ status: string; invoices: bigint; payable: number; paid: number; arrears: number; balance: number }[]>`
    SELECT g.status, COUNT(*) AS invoices, SUM(g.payable) AS payable, SUM(g.paid) AS paid, SUM(g.arrears) AS arrears, SUM(g.balance) AS balance
    FROM (${LEDGER}) g ${scope(filter)} GROUP BY g.status`;
  const split = { PAID: 0, PARTIAL: 0, DUE: 0, OVERDUE: 0 };
  let payable = 0, paid = 0, invoices = 0, overdueBalance = 0;
  for (const r of rows) {
    split[r.status as keyof typeof split] = n(r.invoices);
    payable += n(r.payable); paid += n(r.paid); invoices += n(r.invoices);
    if (r.status === "OVERDUE") overdueBalance = n(r.balance);
  }
  return { split, payable, paid, invoices, overdue: split.OVERDUE, overdueBalance };
}

/** How many invoices are overdue right now. */
export const overdueCount = async (filter: FeeFilter = {}) => (await feeTotals(filter)).overdue;

/** Demand and collection per programme. */
export async function feeByProgram() {
  const rows = await db.$queryRaw<{ code: string; payable: number; paid: number }[]>`
    SELECT pr.code, SUM(g.payable) AS payable, SUM(g.paid) AS paid
    FROM (${LEDGER}) g JOIN Student s ON s.id = g.studentId JOIN Batch b ON b.id = s.batchId JOIN Program pr ON pr.id = b.programId
    GROUP BY pr.code ORDER BY pr.code`;
  return rows.map((r) => ({ code: r.code, payable: n(r.payable), paid: n(r.paid) }));
}

/** The largest overdue balances, with who owes them. */
export async function topOverdue(take = 7) {
  const rows = await db.$queryRaw<{ invoiceId: string; balance: number; rollNo: string; name: string; userId: string; photoType: string | null }[]>`
    SELECT g.invoiceId, g.balance, s.rollNo, u.name, u.id AS userId, u.photoType
    FROM (${LEDGER}) g JOIN Student s ON s.id = g.studentId JOIN User u ON u.id = s.userId
    WHERE g.status = 'OVERDUE' ORDER BY g.balance DESC LIMIT ${take}`;
  return rows.map((r) => ({ id: r.invoiceId, balance: n(r.balance), roll: r.rollNo, name: r.name, userId: r.userId, hasPhoto: !!r.photoType }));
}

/** Every invoice's computed state, for checking the SQL against invoiceStatus(). */
export async function ledgerRows() {
  const rows = await db.$queryRaw<{ invoiceId: string; payable: number; paid: number; balance: number; status: string }[]>`SELECT g.invoiceId, g.payable, g.paid, g.balance, g.status FROM (${LEDGER}) g`;
  return rows.map((r) => ({ invoiceId: r.invoiceId, payable: n(r.payable), paid: n(r.paid), balance: n(r.balance), status: r.status }));
}
