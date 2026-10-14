import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceStatus, statusTone } from "@/lib/fees";
import { getInstitution } from "@/lib/institution";
import { batchLabel, fmtDate, inr, inWords, titleCase } from "@/lib/format";
import { Letterhead, Sheet } from "@/components/letterhead";
import { PrintButton } from "@/components/print-button";
import { Badge, LinkButton } from "@/components/ui";

export const metadata = { title: "Fee statement" };

/**
 * One student's complete fee position. With nothing outstanding it reads as a no-dues certificate;
 * otherwise it is a statement of dues. Students and parents can open only their own.
 */
export default async function FeeStatementPage(props: PageProps<"/fees/statement/[studentId]">) {
  const user = await requireUser(["ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"]);
  const { studentId } = await props.params;
  const learner = user.role === "STUDENT" || user.role === "PARENT";
  if (learner && studentId !== user.studentId) notFound();
  const s = await db.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true } }, batch: { include: { program: true } }, invoices: { include: { payments: { select: { amount: true } }, instalments: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!s) notFound();
  const inst = await getInstitution();
  const rows = s.invoices.map((inv) => ({ inv, st: invoiceStatus(inv) }));
  const total = rows.reduce((t, r) => ({ payable: t.payable + r.st.payable, paid: t.paid + r.st.paid, balance: t.balance + r.st.balance }), { payable: 0, paid: 0, balance: 0 });
  const clear = rows.length > 0 && total.balance === 0;
  const today = new Date();

  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-between">
        <LinkButton variant="secondary" href={learner ? "/fees" : `/students/${s.id}`}>Back</LinkButton>
        <PrintButton />
      </div>
      <Sheet>
        <Letterhead title={clear ? "No-dues certificate" : "Fee statement"} serial={`${s.rollNo}/${today.getFullYear()}`} />
        <h1 className="mt-8 text-center font-display text-lg font-bold tracking-wide uppercase underline underline-offset-4">{clear ? "No-dues certificate" : "Statement of fee dues"}</h1>
        <p className="mt-6 text-sm leading-7">
          {clear
            ? <>This is to certify that <b>{s.user.name}</b>, Roll No. <b>{s.rollNo}</b>, of <b>{s.batch.program.name}</b> ({batchLabel(s.batch)}), has paid all fees raised by the institution up to <b>{fmtDate(today)}</b> and has <b>no dues outstanding</b> towards fees.</>
            : <>Fee position of <b>{s.user.name}</b>, Roll No. <b>{s.rollNo}</b>, of <b>{s.batch.program.name}</b> ({batchLabel(s.batch)}), as on <b>{fmtDate(today)}</b>.</>}
        </p>
        {rows.length === 0 ? <p className="mt-6 rounded-xl bg-surface-2 p-4 text-sm text-muted">No fee has been raised for this student yet.</p> : (
          <div className="mt-6 overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-surface-2 text-left">{["Invoice", "Particulars", "Due date", "Payable", "Paid", "Balance", ""].map((h, i) => <th key={i} className={`border border-line px-2.5 py-2 text-xs font-semibold ${i >= 3 && i <= 5 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ inv, st }) => (
                  <tr key={inv.id}>
                    <td className="border border-line px-2.5 py-2 font-mono text-xs">{inv.invoiceNo}</td>
                    <td className="border border-line px-2.5 py-2">{inv.title}{inv.concession > 0 && <span className="block text-xs text-muted">after concession of {inr(inv.concession)}</span>}{st.fine > 0 && <span className="block text-xs text-muted">includes late fine of {inr(st.fine)}</span>}</td>
                    <td className="border border-line px-2.5 py-2 whitespace-nowrap">{fmtDate(st.nextDue)}</td>
                    <td className="border border-line px-2.5 py-2 text-right tabular-nums">{inr(st.payable)}</td>
                    <td className="border border-line px-2.5 py-2 text-right tabular-nums">{inr(st.paid)}</td>
                    <td className="border border-line px-2.5 py-2 text-right font-semibold tabular-nums">{inr(st.balance)}</td>
                    <td className="border border-line px-2.5 py-2"><Badge tone={statusTone[st.status]}>{titleCase(st.status)}</Badge></td>
                  </tr>
                ))}
                <tr className="bg-surface-2 font-semibold">
                  <td colSpan={3} className="border border-line px-2.5 py-2">Total</td>
                  <td className="border border-line px-2.5 py-2 text-right tabular-nums">{inr(total.payable)}</td>
                  <td className="border border-line px-2.5 py-2 text-right tabular-nums">{inr(total.paid)}</td>
                  <td className="border border-line px-2.5 py-2 text-right tabular-nums">{inr(total.balance)}</td>
                  <td className="border border-line" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {!clear && total.balance > 0 && <p className="mt-4 text-sm">Amount outstanding: <b>{inr(total.balance)}</b> ({inWords(total.balance)}).</p>}
        <div className="mt-16 flex items-end justify-between text-sm">
          <div><p>Date: {fmtDate(today)}</p><p className="text-xs text-muted">Generated from the fee records of {inst.name}.</p></div>
          <div className="text-center"><p className="mb-1 h-8" /><p className="border-t border-fg/60 px-6 pt-1 font-medium">Accounts Officer</p><p className="text-xs text-muted">(Seal &amp; signature)</p></div>
        </div>
      </Sheet>
    </>
  );
}
