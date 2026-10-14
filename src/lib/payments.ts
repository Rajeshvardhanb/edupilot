import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { invoiceStatus } from "./fees";
import { notifyStudents } from "./notify";
import { audit } from "./audit";

/**
 * Online fee payment.
 * - SANDBOX (default): a built-in test checkout. No account, no real money.
 * - RAZORPAY: used when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in .env.
 *   Razorpay test keys (rzp_test_…) are free and move no real money.
 */
export const gateway = () => (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? "RAZORPAY" : "SANDBOX") as "RAZORPAY" | "SANDBOX";

export async function createOrder(invoiceId: string, amount: number, userId: string) {
  const inv = await db.feeInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true, instalments: true } });
  const { balance } = invoiceStatus(inv);
  if (!(amount >= 1) || amount > balance) throw new Error(`Enter an amount between ₹1 and ₹${balance}.`);
  const provider = gateway();
  const order = await db.paymentOrder.create({ data: { invoiceId, amount: Math.round(amount * 100) / 100, provider, createdById: userId } });
  if (provider === "RAZORPAY") {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}` },
      body: JSON.stringify({ amount: Math.round(order.amount * 100), currency: "INR", receipt: order.id, notes: { invoice: inv.invoiceNo } }),
    });
    if (!res.ok) {
      await db.paymentOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
      throw new Error("The payment gateway did not accept the request. Check the Razorpay keys.");
    }
    const data = (await res.json()) as { id: string };
    await db.paymentOrder.update({ where: { id: order.id }, data: { providerRef: data.id } });
  }
  return order.id;
}

/** Razorpay signs `${order_id}|${payment_id}` with the key secret; a match proves the payment is genuine. */
export function razorpaySignatureValid(providerOrderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${providerOrderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Marks an order paid and writes the receipt. Safe to call twice: the second call returns the same receipt. */
export async function settleOrder(orderId: string, reference: string): Promise<string> {
  const order = await db.paymentOrder.findUniqueOrThrow({ where: { id: orderId }, include: { invoice: true } });
  if (order.status === "PAID" && order.paymentId) return order.paymentId;
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const paymentId = await db.$transaction(async (tx) => {
        const fresh = await tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
        if (fresh.status === "PAID" && fresh.paymentId) return fresh.paymentId;
        const last = await tx.payment.findFirst({ where: { receiptNo: { startsWith: `RCPT-${year}-` } }, orderBy: { receiptNo: "desc" } });
        const pay = await tx.payment.create({ data: { receiptNo: `RCPT-${year}-${String((last ? Number(last.receiptNo.slice(-5)) : 0) + 1).padStart(5, "0")}`, invoiceId: order.invoiceId, amount: order.amount, mode: "ONLINE", reference: reference.slice(0, 100) } });
        await tx.paymentOrder.update({ where: { id: orderId }, data: { status: "PAID", paidAt: new Date(), paymentId: pay.id } });
        return pay.id;
      });
      await audit(order.createdById, "ONLINE_PAYMENT", "Payment", paymentId, `₹${order.amount} via ${order.provider}`);
      await notifyStudents([order.invoice.studentId], (s) => ({
        title: `Payment received: ₹${order.amount.toLocaleString("en-IN")}`, href: `/fees/receipt/${paymentId}`, email: true,
        body: `We have received your online payment of ₹${order.amount.toLocaleString("en-IN")} towards ${order.invoice.title} for ${s.name} (${s.rollNo}). Reference: ${reference}.`,
      }));
      return paymentId;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") || attempt === 3) throw e;
    }
  }
  throw new Error("Could not record the payment.");
}
