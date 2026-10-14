import { notFound, redirect } from "next/navigation";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInstitution } from "@/lib/institution";
import { inr } from "@/lib/format";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card } from "@/components/ui-server";
import { SandboxCheckout, RazorpayCheckout } from "./checkout";

export const metadata = { title: "Pay online" };

export default async function PayPage(props: PageProps<"/pay/[orderId]">) {
  const user = await requireUser(["STUDENT", "PARENT", "ADMIN", "ACCOUNTANT"]);
  const { orderId } = await props.params;
  const order = await db.paymentOrder.findUnique({ where: { id: orderId }, include: { invoice: { include: { student: { include: { user: { select: { name: true, email: true, phone: true } } } } } } } });
  if (!order) notFound();
  const staff = user.role === "ADMIN" || user.role === "ACCOUNTANT";
  if (!staff && order.invoice.studentId !== user.studentId) notFound();
  if (order.status === "PAID" && order.paymentId) redirect(`/fees/receipt/${order.paymentId}`);
  const inst = await getInstitution();
  const s = order.invoice.student;
  return (
    <div className="mx-auto max-w-lg">
      <Breadcrumbs items={[{ label: "Fees", href: "/fees" }, { label: "Pay online" }]} />
      <Card>
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Paying {inst.name}</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">{inr(order.amount)}</p>
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">For</dt><dd>{order.invoice.title}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Invoice</dt><dd className="font-mono text-xs">{order.invoice.invoiceNo}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Student</dt><dd>{s.user.name} · <span className="font-mono text-xs">{s.rollNo}</span></dd></div>
        </dl>
        <div className="mt-6">
          {order.provider === "SANDBOX" ? (
            <>
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                <FlaskConical className="mt-0.5 size-4 shrink-0" />
                <p><b>Test mode.</b> This is a practice checkout: no bank is contacted and no money moves. Add Razorpay keys in <code>.env</code> to accept real payments.</p>
              </div>
              <SandboxCheckout orderId={order.id} failed={order.status === "FAILED"} />
            </>
          ) : (
            <RazorpayCheckout orderId={order.id} providerOrderId={order.providerRef ?? ""} keyId={process.env.RAZORPAY_KEY_ID ?? ""} amountPaise={Math.round(order.amount * 100)} college={inst.name} description={order.invoice.title} name={s.user.name} email={s.user.email} phone={s.user.phone ?? ""} testMode={(process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_")} />
          )}
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5" /> A receipt is generated and emailed as soon as the payment succeeds.</p>
      </Card>
    </div>
  );
}
