import "server-only";
import { db } from "./db";
import { getInstitution } from "./institution";
import { invoiceStatus } from "./fees";

/**
 * Brings the late fine on every overdue invoice up to date: days overdue × the per-day rate,
 * capped at the maximum, both set under Administration → Branding & settings. Waived invoices are skipped.
 * Returns how many invoices changed, or null when no rate is configured.
 */
export async function recalculateLateFines(): Promise<number | null> {
  const inst = await getInstitution();
  if (!(inst.lateFinePerDay > 0)) return null;
  const invoices = await db.feeInvoice.findMany({ where: { fineWaived: false }, include: { payments: true, instalments: true } });
  const now = Date.now();
  let touched = 0;
  for (const inv of invoices) {
    const st = invoiceStatus({ ...inv, fine: 0 });
    if (st.status !== "OVERDUE") continue;
    // Count from the earliest instalment that has fallen due, or from the invoice's own due date.
    const plan = inv.instalments.filter((i) => i.dueDate.getTime() < now).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const since = plan.length ? plan[0].dueDate : inv.dueDate;
    const days = Math.max(0, Math.floor((now - since.getTime()) / 864e5));
    const fine = Math.min(inst.lateFineMax > 0 ? inst.lateFineMax : Infinity, days * inst.lateFinePerDay);
    if (fine !== inv.fine) { await db.feeInvoice.update({ where: { id: inv.id }, data: { fine } }); touched++; }
  }
  return touched;
}
