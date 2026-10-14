import Link from "next/link";
import type { PaymentMode } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysAgo, fmtDate, inr, isoDate, titleCase } from "@/lib/format";
import { Badge, Td } from "@/components/ui";
import { Card, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { PrintButton } from "@/components/print-button";
import { FeeTabs } from "../tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Payment ledger" };

export default async function PaymentsPage(props: PageProps<"/fees/payments">) {
  await requireUser(["ADMIN", "ACCOUNTANT"]);
  const sp = await props.searchParams;
  const to = typeof sp.to === "string" && sp.to ? sp.to : isoDate(new Date());
  const from = typeof sp.from === "string" && sp.from ? sp.from : isoDate(daysAgo(90));
  const mode = typeof sp.mode === "string" ? sp.mode : "";
  const payments = await db.payment.findMany({
    where: { paidAt: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) }, ...(mode && { mode: mode as PaymentMode }) },
    include: { collectedBy: true, invoice: { include: { student: { include: { user: true } } } } },
    orderBy: { paidAt: "desc" },
  });
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const refunds = payments.filter((p) => p.amount < 0);
  const byMode = new Map<string, number>();
  for (const p of payments) byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + p.amount);
  return (
    <>
      <PageHeader title="Fees" subtitle="Day book of collections" actions={<PrintButton />} />
      <FeeTabs active="/fees/payments" />
      <Filters>
        <div><label className="label">From</label><input type="date" name="from" aria-label="From" defaultValue={from} className="input" /></div>
        <div><label className="label">To</label><input type="date" name="to" aria-label="To" defaultValue={to} className="input" /></div>
        <select name="mode" aria-label="Mode" defaultValue={mode} className="input w-auto"><option value="">All modes</option>{["CASH", "UPI", "CARD", "BANK_TRANSFER", "DD", "SCHOLARSHIP"].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</select>
        <button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">Apply</button>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-fees-payments" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={refunds.length ? "Net collected" : "Total collected"} value={inr(total)} hint={`${payments.length - refunds.length} receipts${refunds.length ? ` · ${refunds.length} refund${refunds.length === 1 ? "" : "s"} of ${inr(-refunds.reduce((s, p) => s + p.amount, 0))}` : ""}`} tone="success" />
        {[...byMode].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, v]) => <StatCard key={m} label={titleCase(m)} value={inr(v)} tone="neutral" />)}
      </div>
      <Card>
        <Table>
          <thead><tr><Th>Receipt</Th><Th>Date</Th><Th>Student</Th><Th>Invoice</Th><Th>Mode</Th><Th>Reference</Th><Th>By</Th><Th className="text-right">Amount</Th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td><Link href={`/fees/receipt/${p.id}`} className="font-mono text-xs text-brand">{p.receiptNo}</Link></Td>
                <Td className="whitespace-nowrap">{fmtDate(p.paidAt)}</Td>
                <Td>{p.invoice.student.user.name}<p className="font-mono text-xs text-muted">{p.invoice.student.rollNo}</p></Td>
                <Td><Link href={`/fees/${p.invoiceId}`} className="font-mono text-xs hover:text-brand">{p.invoice.invoiceNo}</Link></Td>
                <Td>{titleCase(p.mode)}{p.amount < 0 && <> <Badge tone="danger">Refund</Badge></>}</Td>
                <Td className="font-mono text-xs">{p.reference ?? "—"}</Td>
                <Td className="text-xs">{p.collectedBy?.name ?? "—"}</Td>
                <Td className={`text-right tabular-nums ${p.amount < 0 ? "text-danger" : ""}`}>{p.amount < 0 ? "−" : ""}{inr(Math.abs(p.amount))}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
