"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { invoiceStatus } from "@/lib/fees";
import { notifyStudents } from "@/lib/notify";
import type { ActionState } from "@/lib/action-state";

/** Next sequential number like RCPT-2026-00042; retried by callers on unique collisions. */
async function nextNumber(prefix: string, field: "receiptNo" | "invoiceNo") {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-`;
  const last = field === "receiptNo"
    ? (await db.payment.findFirst({ where: { receiptNo: { startsWith: like } }, orderBy: { receiptNo: "desc" } }))?.receiptNo
    : (await db.feeInvoice.findFirst({ where: { invoiceNo: { startsWith: like } }, orderBy: { invoiceNo: "desc" } }))?.invoiceNo;
  const n = last ? Number(last.slice(like.length)) + 1 : 1;
  return `${like}${String(n).padStart(5, "0")}`;
}

const PaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "DD", "SCHOLARSHIP"]),
  reference: z.string().trim().max(100).optional(),
});

export async function collectPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const p = PaymentSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const inv = await db.feeInvoice.findUniqueOrThrow({ where: { id: p.data.invoiceId }, include: { payments: true, instalments: true } });
  const { balance } = invoiceStatus(inv);
  if (p.data.amount > balance) return { error: `Amount exceeds the balance of ₹${balance}.` };
  if (p.data.mode !== "CASH" && !p.data.reference) return { error: "Transaction / cheque reference is required for non-cash payments." };

  let paymentId = "";
  for (let attempt = 0; attempt < 3 && !paymentId; attempt++) {
    try {
      paymentId = (await db.payment.create({ data: { ...p.data, receiptNo: await nextNumber("RCPT", "receiptNo"), collectedById: me.id } })).id;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  if (!paymentId) return { error: "Could not allocate a receipt number, please retry." };
  await audit(me.id, "COLLECT", "Payment", paymentId, `₹${p.data.amount} ${p.data.mode}`);
  await notifyStudents([inv.studentId], (s) => ({
    title: `Payment received: ₹${p.data.amount.toLocaleString("en-IN")}`, href: `/fees/receipt/${paymentId}`, email: true,
    body: `We have received ₹${p.data.amount.toLocaleString("en-IN")} towards ${inv.title} (invoice ${inv.invoiceNo}) for ${s.name} (${s.rollNo}). Balance remaining: ₹${(balance - p.data.amount).toLocaleString("en-IN")}.`,
  }));
  redirect(`/fees/receipt/${paymentId}`);
}

const RefundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "DD"]),
  reference: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(5, "Give a reason for the refund").max(190),
});

/**
 * Pays money back against a receipt. The refund is a payment with a negative amount linked to that
 * receipt, with its own voucher number, so the invoice balance and the day book adjust by themselves.
 */
export async function refundPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const p = RefundSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const original = await db.payment.findUniqueOrThrow({ where: { id: p.data.paymentId }, include: { refunds: true, invoice: true } });
  if (original.refundOfId || original.amount <= 0) return { error: "A refund can't itself be refunded." };
  const refundable = original.amount + original.refunds.reduce((t, r) => t + r.amount, 0);
  if (p.data.amount > refundable) return { error: `Only ₹${refundable.toLocaleString("en-IN")} of this receipt is left to refund.` };
  if (p.data.mode !== "CASH" && !p.data.reference) return { error: "Transaction / cheque reference is required for non-cash refunds." };

  let id = "";
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    try {
      id = (await db.payment.create({ data: { invoiceId: original.invoiceId, amount: -p.data.amount, mode: p.data.mode, reference: p.data.reference || null, note: p.data.reason, refundOfId: original.id, receiptNo: await nextNumber("RFND", "receiptNo"), collectedById: me.id } })).id;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  if (!id) return { error: "Could not allocate a voucher number, please retry." };
  await audit(me.id, "REFUND", "Payment", id, `₹${p.data.amount} of ${original.receiptNo}: ${p.data.reason}`);
  await notifyStudents([original.invoice.studentId], (st) => ({
    title: `Refund issued: ₹${p.data.amount.toLocaleString("en-IN")}`, href: `/fees/receipt/${id}`, email: true,
    body: `₹${p.data.amount.toLocaleString("en-IN")} has been refunded to ${st.name} (${st.rollNo}) against receipt ${original.receiptNo} (${original.invoice.title}). Reason: ${p.data.reason}`,
  }));
  redirect(`/fees/receipt/${id}`);
}

/** End-of-day sign-off: stores the cash counted in the drawer against what the day's receipts say it should be. */
export async function closeDay(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const day = String(fd.get("date")), counted = Number(fd.get("countedCash"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Pick a date." };
  if (new Date(`${day}T00:00:00Z`).getTime() > Date.now()) return { error: "A future day can't be closed." };
  if (!Number.isFinite(counted) || counted < 0) return { error: "Enter the cash counted." };
  const expectedCash = await cashExpected(day);
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
  if (Math.abs(counted - expectedCash) >= 1 && !note) return { error: `The count differs from the books by ₹${Math.abs(counted - expectedCash).toLocaleString("en-IN")}. Add a note explaining the difference.` };
  const date = new Date(`${day}T00:00:00Z`);
  await db.cashClosing.upsert({ where: { date }, create: { date, expectedCash, countedCash: counted, note, closedById: me.id }, update: { expectedCash, countedCash: counted, note, closedById: me.id, closedAt: new Date() } });
  await audit(me.id, "CLOSE_DAY", "CashClosing", day, `expected ₹${expectedCash}, counted ₹${counted}`);
  revalidatePath("/fees/closing");
  return { ok: true, message: "Day closed." };
}

/** Net cash taken on a day: cash receipts minus cash refunds. */
async function cashExpected(day: string) {
  const sum = await db.payment.aggregate({ where: { mode: "CASH", paidAt: { gte: new Date(`${day}T00:00:00Z`), lte: new Date(`${day}T23:59:59.999Z`) } }, _sum: { amount: true } });
  return sum._sum.amount ?? 0;
}

export async function setConcession(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const id = String(fd.get("invoiceId"));
  const concession = Number(fd.get("concession"));
  const inv = await db.feeInvoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
  const paid = inv.payments.reduce((s, x) => s + x.amount, 0);
  if (!Number.isFinite(concession) || concession < 0 || concession > inv.amount - paid) return { error: "Concession must be between 0 and the unpaid amount." };
  await db.feeInvoice.update({ where: { id }, data: { concession } });
  await audit(me.id, "CONCESSION", "FeeInvoice", id, `₹${concession}`);
  revalidatePath(`/fees/${id}`);
  return { ok: true, message: "Concession updated." };
}

const StructureSchema = z.object({
  name: z.string().trim().min(3),
  programId: z.string().min(1, "Select programme"),
  yearOfStudy: z.coerce.number().int().min(1).max(6),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/, "Use format 2026-27"),
  items: z.string().min(1, "Add at least one fee head"),
});

export async function saveStructure(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const p = StructureSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  // One "Head: amount" per line.
  const items = p.data.items.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^(.+?)[:=,]\s*₹?\s*([\d,]+(?:\.\d+)?)$/.exec(l);
    return m ? { head: m[1].trim(), amount: Number(m[2].replace(/,/g, "")) } : null;
  });
  if (items.some((i) => !i)) return { error: "Each line must look like “Tuition Fee: 85000”." };
  const { name, programId, yearOfStudy, academicYear } = p.data;
  const s = await db.feeStructure.create({ data: { name, programId, yearOfStudy, academicYear, items: { create: items as { head: string; amount: number }[] } } });
  await audit(me.id, "CREATE", "FeeStructure", s.id, s.name);
  revalidatePath("/fees/structures");
  return { ok: true, message: "Fee structure created." };
}

export async function generateInvoices(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const structure = await db.feeStructure.findUniqueOrThrow({ where: { id: String(fd.get("structureId")) }, include: { items: true } });
  const batchId = String(fd.get("batchId"));
  const due = String(fd.get("dueDate"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Pick a due date." };
  const batch = await db.batch.findUniqueOrThrow({ where: { id: batchId } });
  if (batch.programId !== structure.programId) return { error: "This structure belongs to a different programme." };
  const students = await db.student.findMany({ where: { batchId, status: { in: ["ACTIVE", "DETAINED"] }, invoices: { none: { structureId: structure.id } } } });
  const amount = structure.items.reduce((s, i) => s + i.amount, 0);
  let created = 0;
  for (const st of students) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.feeInvoice.create({ data: { invoiceNo: await nextNumber("INV", "invoiceNo"), studentId: st.id, structureId: structure.id, title: structure.name, amount, dueDate: new Date(`${due}T00:00:00Z`) } });
        created++;
        break;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
  }
  await audit(me.id, "GENERATE", "FeeInvoice", structure.id, `${created} invoices`);
  revalidatePath("/fees");
  return { ok: true, message: created ? `${created} invoices generated.` : "All students in this batch already have this invoice." };
}
