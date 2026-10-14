import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, inr, isoDate, titleCase } from "@/lib/format";
import { closeDay } from "@/actions/fees";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Filters } from "@/components/filters";
import { Letterhead } from "@/components/letterhead";
import { PrintButton } from "@/components/print-button";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { FeeTabs } from "../tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Day closing" };

const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "DD", "SCHOLARSHIP", "ONLINE"] as const;

/** End-of-day cash-up: what the day's receipts add up to, by mode and by cashier, against the cash counted. */
export default async function DayClosingPage(props: PageProps<"/fees/closing">) {
  await requireUser(["ADMIN", "ACCOUNTANT"]);
  const sp = await props.searchParams;
  const today = isoDate(new Date());
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const date = new Date(`${day}T00:00:00Z`);
  const [payments, closing, history] = await Promise.all([
    db.payment.findMany({ where: { paidAt: { gte: date, lte: new Date(`${day}T23:59:59.999Z`) } }, include: { collectedBy: { select: { name: true } }, invoice: { select: { invoiceNo: true, student: { select: { rollNo: true, user: { select: { name: true } } } } } } }, orderBy: { paidAt: "asc" } }),
    db.cashClosing.findUnique({ where: { date }, include: { closedBy: { select: { name: true } } } }),
    db.cashClosing.findMany({ orderBy: { date: "desc" }, take: 10, include: { closedBy: { select: { name: true } } } }),
  ]);
  const byMode = new Map<string, { in: number; out: number; n: number }>();
  const byCashier = new Map<string, { in: number; out: number; n: number }>();
  for (const p of payments) {
    for (const [map, key] of [[byMode, p.mode], [byCashier, p.collectedBy?.name ?? (p.mode === "ONLINE" ? "Online payments" : "—")]] as const) {
      const x = map.get(key) ?? { in: 0, out: 0, n: 0 };
      if (p.amount < 0) x.out += -p.amount; else x.in += p.amount;
      x.n++; map.set(key, x);
    }
  }
  const received = payments.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const refunded = payments.filter((p) => p.amount < 0).reduce((s, p) => s - p.amount, 0);
  const cash = byMode.get("CASH");
  const expectedCash = (cash?.in ?? 0) - (cash?.out ?? 0);
  const variance = closing ? closing.countedCash - closing.expectedCash : 0;

  return (
    <>
      <PageHeader title="Fees" subtitle="Close the day: check the cash drawer against the day's receipts" actions={<PrintButton />} />
      <FeeTabs active="/fees/closing" />
      <Filters>
        <div><label className="label" htmlFor="date">Day</label><input id="date" type="date" name="date" defaultValue={day} max={today} className="input" /></div>
        <button className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-semibold">Show</button>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-fees-closing" />

      <div className="hidden print:block"><Letterhead title="Day closing report" serial={day} /></div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={`Received · ${fmtDate(date)}`} value={inr(received)} tone="success" hint={`${payments.filter((p) => p.amount > 0).length} receipts`} />
        <StatCard label="Refunded" value={inr(refunded)} tone="danger" hint={`${payments.filter((p) => p.amount < 0).length} vouchers`} />
        <StatCard label="Net for the day" value={inr(received - refunded)} tone="brand" hint="all modes" />
        <StatCard label="Cash that should be in the drawer" value={inr(expectedCash)} tone="warning" hint="cash receipts less cash refunds" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="By payment mode">
            {payments.length === 0 ? <EmptyState title="No receipts on this day" /> : (
              <Table>
                <thead><tr><Th>Mode</Th><Th className="text-right">Entries</Th><Th className="text-right">Received</Th><Th className="text-right">Refunded</Th><Th className="text-right">Net</Th></tr></thead>
                <tbody>
                  {MODES.filter((m) => byMode.has(m)).map((m) => { const x = byMode.get(m)!; return (
                    <tr key={m}><Td className="font-medium">{titleCase(m)}</Td><Td className="text-right tabular-nums">{x.n}</Td><Td className="text-right tabular-nums">{inr(x.in)}</Td><Td className="text-right tabular-nums">{x.out ? `−${inr(x.out)}` : "—"}</Td><Td className="text-right font-semibold tabular-nums">{inr(x.in - x.out)}</Td></tr>
                  ); })}
                  <tr><Td className="font-semibold">Total</Td><Td className="text-right tabular-nums">{payments.length}</Td><Td className="text-right tabular-nums">{inr(received)}</Td><Td className="text-right tabular-nums">{refunded ? `−${inr(refunded)}` : "—"}</Td><Td className="text-right font-semibold tabular-nums">{inr(received - refunded)}</Td></tr>
                </tbody>
              </Table>
            )}
          </Card>
          {payments.length > 0 && (
            <Card title="By cashier">
              <Table>
                <thead><tr><Th>Collected by</Th><Th className="text-right">Entries</Th><Th className="text-right">Net amount</Th></tr></thead>
                <tbody>{[...byCashier].map(([name, x]) => <tr key={name}><Td>{name}</Td><Td className="text-right tabular-nums">{x.n}</Td><Td className="text-right tabular-nums">{inr(x.in - x.out)}</Td></tr>)}</tbody>
              </Table>
            </Card>
          )}
          {payments.length > 0 && (
            <Card title="Every entry">
              <Table>
                <thead><tr><Th>No.</Th><Th>Time</Th><Th>Student</Th><Th>Mode</Th><Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td><Link href={`/fees/receipt/${p.id}`} className="font-mono text-xs text-brand">{p.receiptNo}</Link></Td>
                      <Td className="text-xs whitespace-nowrap">{p.paidAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</Td>
                      <Td>{p.invoice.student.user.name} <span className="font-mono text-xs text-muted">{p.invoice.student.rollNo}</span></Td>
                      <Td>{titleCase(p.mode)}{p.amount < 0 && <> <Badge tone="danger">Refund</Badge></>}</Td>
                      <Td className={`text-right tabular-nums ${p.amount < 0 ? "text-danger" : ""}`}>{p.amount < 0 ? "−" : ""}{inr(Math.abs(p.amount))}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title={closing ? "Day closed" : "Close this day"}>
            {closing && (
              <dl className="mb-5 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Cash per the books</dt><dd className="tabular-nums">{inr(closing.expectedCash)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Cash counted</dt><dd className="tabular-nums">{inr(closing.countedCash)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Difference</dt><dd className="tabular-nums"><Badge tone={Math.abs(variance) < 1 ? "success" : "danger"}>{Math.abs(variance) < 1 ? "Tallied" : `${variance > 0 ? "Excess" : "Short"} ${inr(Math.abs(variance))}`}</Badge></dd></div>
                {closing.note && <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">{closing.note}</p>}
                <p className="text-xs text-muted">Closed by {closing.closedBy?.name ?? "—"} · {fmtDateTime(closing.closedAt)}</p>
                {Math.abs(closing.expectedCash - expectedCash) >= 1 && <p className="rounded-xl bg-warning-soft p-3 text-xs text-warning">Cash entries were added or refunded after this day was closed. The books now say {inr(expectedCash)}. Close the day again to update it.</p>}
              </dl>
            )}
            <ActionForm action={closeDay} className="no-print space-y-3">
              <input type="hidden" name="date" value={day} />
              <Field label="Cash counted in the drawer (₹)" name="countedCash"><input name="countedCash" type="number" min={0} step="1" defaultValue={closing?.countedCash ?? expectedCash} className="input" required /></Field>
              <Field label="Note (needed if the count differs)" name="note"><textarea name="note" rows={2} defaultValue={closing?.note ?? ""} className="input" /></Field>
              <SubmitButton className="w-full">{closing ? "Close again" : "Close the day"}</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Recent closings" className="no-print">
            {history.length === 0 ? <p className="text-sm text-muted">No day has been closed yet.</p> : (
              <ul className="divide-y divide-line/70 text-sm">
                {history.map((h) => { const v = h.countedCash - h.expectedCash; return (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/fees/closing?date=${isoDate(h.date)}`} className="font-medium hover:text-brand">{fmtDate(h.date)}</Link>
                    <span className="flex items-center gap-2"><span className="tabular-nums text-muted">{inr(h.countedCash)}</span><Badge tone={Math.abs(v) < 1 ? "success" : "danger"}>{Math.abs(v) < 1 ? "Tallied" : `${v > 0 ? "+" : "−"}${inr(Math.abs(v))}`}</Badge></span>
                  </li>
                ); })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
