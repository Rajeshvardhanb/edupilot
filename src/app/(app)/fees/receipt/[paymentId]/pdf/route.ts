import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceStatus } from "@/lib/fees";
import { batchLabel, fmtDate, inWords, titleCase } from "@/lib/format";
import { Doc, pdfResponse } from "@/lib/pdf";

export async function GET(_: Request, ctx: RouteContext<"/fees/receipt/[paymentId]/pdf">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { paymentId } = await ctx.params;
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { collectedBy: { select: { name: true } }, invoice: { include: { payments: true, instalments: true, student: { include: { user: { select: { name: true } }, batch: { include: { program: true } } } } } } } });
  const staff = user.role === "ADMIN" || user.role === "ACCOUNTANT";
  if (!p || (!staff && p.invoice.studentId !== user.studentId)) return new Response("Not found", { status: 404 });
  const s = p.invoice.student, st = invoiceStatus(p.invoice);
  const doc = await Doc.create();
  const refund = p.amount < 0;
  await doc.letterhead(refund ? "Refund voucher" : "Fee receipt", p.receiptNo);
  doc.pairs([
    ["Student", s.user.name], ["Roll no", s.rollNo], ["Programme / batch", `${s.batch.program.code} · ${batchLabel(s.batch)}`],
    ["Invoice", `${p.invoice.invoiceNo} — ${p.invoice.title}`], ["Date", fmtDate(p.paidAt)], ["Mode / reference", `${titleCase(p.mode)}${p.reference ? ` · ${p.reference}` : ""}`],
  ]);
  doc.space(8); doc.rule(14);
  doc.text(refund ? "Amount refunded" : "Amount received", { size: 11 });
  doc.text(`Rs. ${Math.abs(p.amount).toLocaleString("en-IN")}`, { size: 20, bold: true, align: "right" });
  doc.space(28);
  doc.line(inWords(Math.abs(p.amount)), { size: 9 });
  if (refund && p.note) doc.line(`Reason: ${p.note}`, { size: 9 });
  doc.space(6); doc.rule(14);
  doc.pairs([["Balance outstanding", `Rs. ${st.balance.toLocaleString("en-IN")}`], [refund ? "Refunded by" : "Received by", p.collectedBy?.name ?? (p.mode === "ONLINE" ? "Online payment" : "Accounts")]]);
  return pdfResponse(await doc.finish(refund ? "Computer-generated voucher; no signature required." : "Computer-generated receipt; no signature required."), `${p.receiptNo}.pdf`);
}
