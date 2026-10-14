import { getT } from "@/lib/i18n-server";
import { learnerId } from "@/lib/learner";
import Link from "next/link";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceStatus, statusTone } from "@/lib/fees";
import { batchLabel, fmtDate, inr, pct, titleCase } from "@/lib/format";
import { Badge, LinkButton, Pagination, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { Filters, SearchInput } from "@/components/filters";
import { FeeTabs } from "./tabs";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { startOnlinePayment } from "@/actions/pay";
import { applyLateFinesAction } from "@/actions/campus";
import { emailFeeReminders } from "@/actions/alerts";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Fees" };
const PAGE = 30;

export default async function FeesPage(props: PageProps<"/fees">) {
  const user = await requireUser(["ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"]);
  const sp = await props.searchParams;
  if (user.role === "STUDENT" || user.role === "PARENT") return <MyFees user={user} />;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const program = typeof sp.program === "string" ? sp.program : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const [invoices, programs] = await Promise.all([
    db.feeInvoice.findMany({
      where: {
        ...(q && { OR: [{ invoiceNo: { contains: q } }, { student: { rollNo: { contains: q } } }, { student: { user: { name: { contains: q } } } }] }),
        ...(program && { student: { batch: { programId: program } } }),
      },
      include: { payments: true, instalments: true, student: { include: { user: true, batch: { include: { program: true } } } } },
      orderBy: { invoiceNo: "asc" },
    }),
    db.program.findMany({ orderBy: { code: "asc" } }),
  ]);
  const withStatus = invoices.map((i) => ({ i, st: invoiceStatus(i) }));
  const filtered = status ? withStatus.filter((x) => x.st.status === status) : withStatus;
  const totals = filtered.reduce((a, x) => ({ payable: a.payable + x.st.payable, paid: a.paid + x.st.paid, bal: a.bal + x.st.balance }), { payable: 0, paid: 0, bal: 0 });
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "page") as [string, string][]);

  return (
    <>
      <PageHeader title="Fees" subtitle="Demand, collection and dues" actions={<><ActionButton action={emailFeeReminders} fields={{}} size="md" confirm="Email a reminder for every overdue invoice to the student and their parents?">Email overdue reminders</ActionButton><ActionButton action={applyLateFinesAction} fields={{}} size="md" confirm="Recalculate late fines on all overdue invoices using the per-day rate in Settings?">Apply late fines</ActionButton></>} />
      <FeeTabs active="/fees" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Demand (filtered)" value={inr(totals.payable)} hint={`${filtered.length} invoices`} />
        <StatCard label="Collected" value={inr(totals.paid)} tone="success" hint={`${pct(totals.paid, totals.payable)}%`} />
        <StatCard label="Balance due" value={inr(totals.bal)} tone="warning" />
      </div>
      <Filters>
        <SearchInput placeholder="Invoice no, roll no or student name" defaultValue={q} />
        <select name="program" aria-label="Program" defaultValue={program} className="input w-auto"><option value="">All programmes</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
        <select name="status" aria-label="Status" defaultValue={status} className="input w-auto"><option value="">Any status</option>{["PAID", "PARTIAL", "DUE", "OVERDUE"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-fees" />
      <Card>
        {filtered.length === 0 ? <EmptyState title="No invoices match" action={<><LinkButton variant="secondary" href="/fees">Clear the filters</LinkButton><LinkButton href="/fees/structures">Generate invoices for a batch</LinkButton></>}>Invoices are raised from a fee structure, one batch at a time.</EmptyState> : (
          <Table>
            <thead><tr><Th>Invoice</Th><Th>Student</Th><Th>Batch</Th><Th className="text-right">Payable</Th><Th className="text-right">Paid</Th><Th className="text-right">Balance</Th><Th>Due</Th><Th>Status</Th></tr></thead>
            <tbody>
              {filtered.slice((page - 1) * PAGE, page * PAGE).map(({ i, st }) => (
                <tr key={i.id} className="hover:bg-surface-2">
                  <Td><Link href={`/fees/${i.id}`} className="font-mono text-xs text-brand">{i.invoiceNo}</Link></Td>
                  <Td><p>{i.student.user.name}</p><p className="font-mono text-xs text-muted">{i.student.rollNo}</p></Td>
                  <Td className="whitespace-nowrap">{batchLabel(i.student.batch)}</Td>
                  <Td className="text-right tabular-nums">{inr(st.payable)}{i.concession > 0 && <p className="text-xs text-success">−{inr(i.concession)} conc.</p>}{st.fine > 0 && <p className="text-xs text-danger">+{inr(st.fine)} fine</p>}</Td>
                  <Td className="text-right tabular-nums">{inr(st.paid)}</Td>
                  <Td className="text-right font-medium tabular-nums">{inr(st.balance)}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(st.nextDue)}{i.instalments.length > 0 && <p className="text-xs text-muted">{i.instalments.length} instalments</p>}</Td>
                  <Td><Badge tone={statusTone[st.status]}>{st.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pages={Math.ceil(filtered.length / PAGE)} makeHref={(p) => `/fees?${query}&page=${p}`} />
      </Card>
    </>
  );
}

async function MyFees({ user }: { user: CurrentUser }) {
  const t = await getT();
  const invoices = await db.feeInvoice.findMany({ where: { studentId: learnerId(user) }, include: { payments: { orderBy: { paidAt: "desc" } }, instalments: { orderBy: { dueDate: "asc" } }, structure: { include: { items: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title={t("My fees")} subtitle="Pay online here, or at the accounts section quoting your invoice number." actions={user.studentId && <LinkButton variant="secondary" href={`/fees/statement/${user.studentId}`}>Fee statement / no-dues</LinkButton>} />
      {invoices.length === 0 && <EmptyState title="No invoices" />}
      <div className="space-y-6">
        {invoices.map((inv) => {
          const st = invoiceStatus(inv);
          return (
            <Card key={inv.id} title={<span>{inv.title} <span className="font-mono text-xs font-normal text-muted">{inv.invoiceNo}</span></span>} actions={<Badge tone={statusTone[st.status]}>{st.status}</Badge>}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Table>
                    <tbody>
                      {inv.structure?.items.map((it) => <tr key={it.id}><Td>{it.head}</Td><Td className="text-right tabular-nums">{inr(it.amount)}</Td></tr>)}
                      {inv.concession > 0 && <tr><Td className="text-success">Concession / scholarship</Td><Td className="text-right text-success tabular-nums">−{inr(inv.concession)}</Td></tr>}
                      {st.fine > 0 && <tr><Td className="text-danger">Late fine</Td><Td className="text-right text-danger tabular-nums">+{inr(st.fine)}</Td></tr>}
                      <tr><Td className="font-semibold">{t("Payable")}</Td><Td className="text-right font-semibold tabular-nums">{inr(st.payable)}</Td></tr>
                      <tr><Td>{t("Paid")}</Td><Td className="text-right tabular-nums">{inr(st.paid)}</Td></tr>
                      <tr><Td className="font-semibold">Balance · due {fmtDate(inv.dueDate)}</Td><Td className="text-right font-semibold tabular-nums">{inr(st.balance)}</Td></tr>
                    </tbody>
                  </Table>
                </div>
                <div>
                  {inv.instalments.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-sm font-medium">Instalment plan</p>
                      <ul className="space-y-1 text-sm">{inv.instalments.map((x, n) => <li key={x.id} className="flex justify-between"><span>Instalment {n + 1} · due {fmtDate(x.dueDate)}</span><span className="tabular-nums">{inr(x.amount)}</span></li>)}</ul>
                    </div>
                  )}
                  {st.balance > 0 && (
                    <ActionForm action={startOnlinePayment} className="mb-5 flex flex-wrap items-end gap-2 rounded-xl bg-brand-soft/60 p-3">
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <div><label className="label" htmlFor={`amt-${inv.id}`}>Pay online (₹)</label><input id={`amt-${inv.id}`} name="amount" type="number" min={1} max={st.balance} defaultValue={st.arrears > 0 ? st.arrears : st.balance} className="input w-36" required /></div>
                      <SubmitButton>{t("Pay now")}</SubmitButton>
                    </ActionForm>
                  )}
                  <p className="mb-2 text-sm font-medium">{t("Payments")}</p>
                  {inv.payments.length === 0 ? <p className="text-sm text-muted">No payments yet.</p> : (
                    <ul className="space-y-2 text-sm">
                      {inv.payments.map((p) => (
                        <li key={p.id} className="flex justify-between"><span>{fmtDate(p.paidAt)} · {titleCase(p.mode)}</span><Link href={`/fees/receipt/${p.id}`} className="text-brand">{p.amount < 0 ? `Refund ${inr(-p.amount)} · voucher` : `${inr(p.amount)} · receipt`}</Link></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
