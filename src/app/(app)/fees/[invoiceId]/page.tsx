import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceStatus, statusTone } from "@/lib/fees";
import { batchLabel, fmtDate, inr, titleCase } from "@/lib/format";
import { collectPayment, refundPayment, setConcession } from "@/actions/fees";
import { setInstalments, waiveFine } from "@/actions/campus";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { waLink } from "@/lib/whatsapp";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, LinkButton, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Invoice" };

export default async function InvoicePage(props: PageProps<"/fees/[invoiceId]">) {
  const user = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const { invoiceId } = await props.params;
  const inv = await db.feeInvoice.findUnique({
    where: { id: invoiceId },
    include: { structure: { include: { items: true } }, instalments: { orderBy: { dueDate: "asc" } }, payments: { include: { collectedBy: true, refunds: { select: { amount: true } } }, orderBy: { paidAt: "desc" } }, student: { include: { user: true, batch: { include: { program: true } } } } },
  });
  if (!inv) notFound();
  const st = invoiceStatus(inv);
  const remind = `Dear Parent, a fee balance of Rs. ${st.balance.toLocaleString("en-IN")} is pending for ${inv.student.user.name} (${inv.student.rollNo}) on invoice ${inv.invoiceNo}. Kindly pay at the earliest. — Accounts`;
  return (
    <>
      <Breadcrumbs items={[{ label: "Fees", href: "/fees" }, { label: inv.invoiceNo }]} />
      <PageHeader title={`Invoice ${inv.invoiceNo}`} subtitle={<><Link href={`/students/${inv.studentId}`} className="text-brand">{inv.student.user.name}</Link> · {inv.student.rollNo} · {batchLabel(inv.student.batch)}</>} actions={<><LinkButton variant="secondary" href={`/fees/statement/${inv.studentId}`}>Fee statement</LinkButton>{st.balance > 0 && <WhatsAppButton href={waLink(inv.student.guardianPhone, remind)} label="Remind parent" text={remind} log={{ studentId: inv.studentId, purpose: "FEES" }} />}<Badge tone={statusTone[st.status]}>{st.status}</Badge></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={inv.title} className="lg:col-span-2">
          <Table>
            <tbody>
              {inv.structure?.items.map((it) => <tr key={it.id}><Td>{it.head}</Td><Td className="text-right tabular-nums">{inr(it.amount)}</Td></tr>)}
              <tr><Td className="font-medium">Gross</Td><Td className="text-right tabular-nums">{inr(inv.amount)}</Td></tr>
              <tr><Td className="text-success">Concession</Td><Td className="text-right text-success tabular-nums">−{inr(inv.concession)}</Td></tr>
              {(inv.fine > 0) && <tr><Td className="text-danger">Late fine {inv.fineWaived && <Badge>Waived</Badge>}</Td><Td className={`text-right tabular-nums ${inv.fineWaived ? "text-muted line-through" : "text-danger"}`}>+{inr(inv.fine)}</Td></tr>}
              <tr><Td className="font-semibold">Payable</Td><Td className="text-right font-semibold tabular-nums">{inr(st.payable)}</Td></tr>
              <tr><Td>Paid</Td><Td className="text-right tabular-nums">{inr(st.paid)}</Td></tr>
              <tr><Td className="font-semibold">Balance (next due {fmtDate(st.nextDue)})</Td><Td className="text-right text-lg font-semibold tabular-nums">{inr(st.balance)}</Td></tr>
            </tbody>
          </Table>
          <h3 className="mt-6 mb-2 text-sm font-semibold">Payments</h3>
          <Table>
            <thead><tr><Th>Receipt</Th><Th>Date</Th><Th>Mode</Th><Th>Reference</Th><Th>By</Th><Th className="text-right">Amount</Th><Th /></tr></thead>
            <tbody>
              {inv.payments.map((p) => (
                <tr key={p.id}>
                  <Td><Link href={`/fees/receipt/${p.id}`} className="font-mono text-xs text-brand">{p.receiptNo}</Link></Td>
                  <Td>{fmtDate(p.paidAt)}</Td><Td>{titleCase(p.mode)}</Td><Td className="font-mono text-xs">{p.reference ?? "—"}</Td>
                  <Td>{p.collectedBy?.name ?? "—"}</Td>
                  <Td className={`text-right tabular-nums ${p.amount < 0 ? "text-danger" : ""}`}>{p.amount < 0 && <Badge tone="danger">Refund</Badge>} {p.amount < 0 ? "−" : ""}{inr(Math.abs(p.amount))}{p.note && <p className="text-xs font-normal text-muted">{p.note}</p>}</Td>
                  <Td className="text-right">
                    {p.amount > 0 && p.amount + p.refunds.reduce((t, r) => t + r.amount, 0) > 0 && (
                      <details className="relative inline-block text-left">
                        <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg">Refund</summary>
                        <div className="absolute right-0 z-20 mt-1 w-72 rounded-[20px] border border-line bg-surface p-4 shadow-lift">
                          <p className="mb-3 text-sm font-semibold">Refund against {p.receiptNo}</p>
                          <ActionForm action={refundPayment} className="space-y-3">
                            <input type="hidden" name="paymentId" value={p.id} />
                            <Field label={`Amount (₹), up to ${inr(p.amount + p.refunds.reduce((t, r) => t + r.amount, 0))}`}><input name="amount" aria-label="Refund amount" type="number" min={1} max={p.amount + p.refunds.reduce((t, r) => t + r.amount, 0)} defaultValue={p.amount + p.refunds.reduce((t, r) => t + r.amount, 0)} className="input" required /></Field>
                            <Field label="Paid back by"><select name="mode" aria-label="Refund mode" className="input">{["BANK_TRANSFER", "CASH", "UPI", "CARD", "DD"].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</select></Field>
                            <Field label="Reference (UTR / cheque no.)"><input name="reference" aria-label="Refund reference" className="input" /></Field>
                            <Field label="Reason"><input name="reason" aria-label="Reason" className="input" placeholder="e.g. Admission cancelled" required /></Field>
                            <SubmitButton variant="danger" className="w-full" confirm="Issue this refund? It reduces the amount paid on the invoice.">Issue refund</SubmitButton>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-6">
          {st.balance > 0 && (
            <Card title="Collect payment">
              <ActionForm action={collectPayment} className="space-y-3">
                <input type="hidden" name="invoiceId" value={inv.id} />
                <Field label="Amount (₹)" name="amount"><input id="amount" name="amount" type="number" step="1" min={1} max={st.balance} defaultValue={st.balance} className="input" required /></Field>
                <Field label="Mode" name="mode"><select id="mode" name="mode" className="input">{["UPI", "CASH", "CARD", "BANK_TRANSFER", "DD", "SCHOLARSHIP"].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</select></Field>
                <Field label="Reference (UTR / cheque / DD no.)" name="reference"><input id="reference" name="reference" className="input" /></Field>
                <SubmitButton className="w-full">Collect & print receipt</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <Card title="Instalment plan">
            {inv.instalments.length > 0 && (
              <ul className="mb-4 space-y-1.5 text-sm">{inv.instalments.map((x, n) => {
                const cum = inv.instalments.slice(0, n + 1).reduce((t, y) => t + y.amount, 0);
                return <li key={x.id} className="flex items-center justify-between"><span>{n + 1}. {fmtDate(x.dueDate)}</span><span className="flex items-center gap-2 tabular-nums">{inr(x.amount)}<Badge tone={st.paid >= cum ? "success" : x.dueDate < new Date() ? "danger" : "neutral"}>{st.paid >= cum ? "Paid" : x.dueDate < new Date() ? "Overdue" : "Upcoming"}</Badge></span></li>;
              })}</ul>
            )}
            <ActionForm action={setInstalments} className="space-y-3">
              <input type="hidden" name="invoiceId" value={inv.id} />
              <div className="grid grid-cols-3 gap-2">
                <Field label="Instalments" name="count"><select id="count" name="count" defaultValue={inv.instalments.length || 2} className="input">{[0, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n === 0 ? "None" : n}</option>)}</select></Field>
                <Field label="First due" name="firstDue"><input id="firstDue" type="date" name="firstDue" className="input" /></Field>
                <Field label="Gap (days)" name="gapDays"><input id="gapDays" type="number" name="gapDays" defaultValue={60} className="input" /></Field>
              </div>
              <SubmitButton variant="secondary" size="sm">Save plan</SubmitButton>
            </ActionForm>
          </Card>
          {user.role === "ADMIN" && inv.fine > 0 && !inv.fineWaived && (
            <Card title="Late fine"><p className="mb-3 text-sm text-muted">{inr(inv.fine)} has accrued on this invoice.</p><ActionButton action={waiveFine} fields={{ invoiceId: inv.id }} confirm="Waive the late fine on this invoice?">Waive fine</ActionButton></Card>
          )}
          {user.role === "ADMIN" && (
            <Card title="Concession / scholarship">
              <ActionForm action={setConcession} className="space-y-3">
                <input type="hidden" name="invoiceId" value={inv.id} />
                <Field label="Concession amount (₹)" name="concession"><input id="concession" name="concession" type="number" min={0} defaultValue={inv.concession} className="input" /></Field>
                <SubmitButton variant="secondary">Update</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
