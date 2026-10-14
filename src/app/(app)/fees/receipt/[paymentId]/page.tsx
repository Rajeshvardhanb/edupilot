import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceStatus } from "@/lib/fees";
import { batchLabel, fmtDate, inr, inWords, titleCase } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { Letterhead } from "@/components/letterhead";
import { Download } from "lucide-react";
import { LinkButton, buttonClass } from "@/components/ui";

export const metadata = { title: "Fee receipt" };

export default async function ReceiptPage(props: PageProps<"/fees/receipt/[paymentId]">) {
  const user = await requireUser(["ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"]);
  const { paymentId } = await props.params;
  const p = await db.payment.findUnique({
    where: { id: paymentId },
    include: { collectedBy: true, refundOf: { select: { receiptNo: true } }, invoice: { include: { payments: true, instalments: true, student: { include: { user: true, batch: { include: { program: true } } } } } } },
  });
  if (!p || ((user.role === "STUDENT" || user.role === "PARENT") && p.invoice.studentId !== user.studentId)) notFound();
  const st = invoiceStatus(p.invoice);
  const s = p.invoice.student;
  const refund = p.amount < 0;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex justify-between">
        <LinkButton variant="secondary" href={user.role === "STUDENT" || user.role === "PARENT" ? "/fees" : `/fees/${p.invoiceId}`}>Back</LinkButton>
        <span className="flex gap-2"><a href={`/fees/receipt/${p.id}/pdf`} className={buttonClass("secondary")}><Download className="size-4" /> Download PDF</a><PrintButton label="Print" /></span>
      </div>
      <div className="rounded-xl border border-line bg-surface p-8 print:border-0 print:p-0">
        <Letterhead title={refund ? "Refund voucher" : "Fee receipt"} serial={p.receiptNo} />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 py-4 text-sm">
          <dt className="text-muted">Student</dt><dd className="font-medium">{s.user.name}</dd>
          <dt className="text-muted">Roll no</dt><dd className="font-mono">{s.rollNo}</dd>
          <dt className="text-muted">Programme / batch</dt><dd>{s.batch.program.code} · {batchLabel(s.batch)}</dd>
          <dt className="text-muted">Invoice</dt><dd className="font-mono">{p.invoice.invoiceNo} — {p.invoice.title}</dd>
          <dt className="text-muted">Date</dt><dd>{fmtDate(p.paidAt)}</dd>
          {refund && <><dt className="text-muted">Refund against</dt><dd className="font-mono">{p.refundOf?.receiptNo}</dd><dt className="text-muted">Reason</dt><dd>{p.note}</dd></>}
          <dt className="text-muted">Mode / reference</dt><dd>{titleCase(p.mode)} {p.reference && <span className="font-mono text-xs">· {p.reference}</span>}</dd>
        </dl>
        <div className="rounded-lg bg-surface-2 p-4">
          <div className="flex items-baseline justify-between"><span className="text-sm">{refund ? "Amount refunded" : "Amount received"}</span><span className="text-2xl font-semibold tabular-nums">{inr(Math.abs(p.amount))}</span></div>
          <p className="mt-1 text-xs text-muted">{inWords(Math.abs(p.amount))}</p>
        </div>
        <div className="mt-4 flex justify-between text-sm"><span className="text-muted">Balance outstanding on invoice</span><span className="font-medium tabular-nums">{inr(st.balance)}</span></div>
        <div className="mt-12 flex justify-between text-xs text-muted">
          <span>Computer-generated {refund ? "voucher" : "receipt"}; no signature required.</span>
          <span>{refund ? "Refunded" : "Received"} by: {p.collectedBy?.name ?? "Accounts"}</span>
        </div>
      </div>
    </div>
  );
}
