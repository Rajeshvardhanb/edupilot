"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { createOrder, razorpaySignatureValid, settleOrder } from "@/lib/payments";
import type { ActionState } from "@/lib/action-state";

/** Students and parents pay their own invoices; accounts staff may start a payment for anyone. */
async function ownsInvoice(user: CurrentUser, invoiceId: string) {
  if (user.role === "ADMIN" || user.role === "ACCOUNTANT") return true;
  const inv = await db.feeInvoice.findUnique({ where: { id: invoiceId }, select: { studentId: true } });
  return !!inv && inv.studentId === user.studentId;
}

export async function startOnlinePayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT", "PARENT", "ADMIN", "ACCOUNTANT"]);
  const invoiceId = String(fd.get("invoiceId"));
  if (!(await ownsInvoice(me, invoiceId))) return { error: "Invoice not found." };
  let orderId: string;
  try { orderId = await createOrder(invoiceId, Number(fd.get("amount")), me.id); }
  catch (e) { return { error: (e as Error).message }; }
  redirect(`/pay/${orderId}`);
}

async function loadOrder(me: CurrentUser, orderId: string) {
  const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order || !(await ownsInvoice(me, order.invoiceId))) return null;
  return order;
}

/** Test checkout only: completes or fails the order without any real payment. */
export async function sandboxPay(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT", "PARENT", "ADMIN", "ACCOUNTANT"]);
  const order = await loadOrder(me, String(fd.get("orderId")));
  if (!order || order.provider !== "SANDBOX") return { error: "Order not found." };
  if (order.status === "PAID" && order.paymentId) redirect(`/fees/receipt/${order.paymentId}`);
  if (fd.get("outcome") === "fail") {
    await db.paymentOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
    return { error: "Payment failed (simulated). No money was taken. You can try again." };
  }
  const method = String(fd.get("method") ?? "UPI").slice(0, 20);
  const paymentId = await settleOrder(order.id, `TEST-${method}-${order.id.slice(-8).toUpperCase()}`);
  redirect(`/fees/receipt/${paymentId}`);
}

/** Called by the browser after Razorpay Checkout succeeds. The signature is verified before anything is recorded. */
export async function razorpayConfirm(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT", "PARENT", "ADMIN", "ACCOUNTANT"]);
  const order = await loadOrder(me, String(fd.get("orderId")));
  const paymentRef = String(fd.get("razorpay_payment_id") ?? ""), signature = String(fd.get("razorpay_signature") ?? "");
  if (!order || order.provider !== "RAZORPAY" || !order.providerRef) return { error: "Order not found." };
  if (!paymentRef || !razorpaySignatureValid(order.providerRef, paymentRef, signature)) return { error: "Payment could not be verified. If money was deducted, contact the accounts office with your bank reference." };
  const paymentId = await settleOrder(order.id, paymentRef);
  redirect(`/fees/receipt/${paymentId}`);
}
