"use server";
import { notifyAcademic } from "@/lib/academic-email";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { currentTerm } from "@/lib/scope";
import type { ActionState } from "@/lib/action-state";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export async function requestSwap(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["HOD", "FACULTY"]);
  const date = String(fd.get("date")), toId = String(fd.get("toId"));
  const slot = await db.timetableSlot.findFirst({ where: { id: String(fd.get("slotId")), offering: { facultyId: me.facultyId ?? "-" } }, include: { offering: { include: { subject: true } } } });
  if (!slot || !isoRe.test(date) || !toId) return { error: "Choose one of your classes, a date and a colleague." };
  const d = day(date);
  if (d.getTime() < Date.now() - 864e5) return { error: "Choose today or a future date." };
  if (d.getUTCDay() !== slot.dayOfWeek) return { error: "That class does not run on the chosen date's weekday." };
  if (toId === me.facultyId) return { error: "Choose a colleague." };
  const to = await db.faculty.findUnique({ where: { id: toId }, select: { userId: true } });
  if (!to) return { error: "Colleague not found." };
  if (await db.swapRequest.findFirst({ where: { slotId: slot.id, date: d, status: { not: "REJECTED" } } })) return { error: "A request already exists for that class." };
  const request = await db.swapRequest.create({ data: { slotId: slot.id, date: d, fromId: me.facultyId!, toId, reason: String(fd.get("reason") ?? "").trim().slice(0, 190) || null } });
  revalidatePath("/staff/swaps");
  notifyAcademic({ type: "swap-request", id: request.id });
  return { ok: true, message: "Request sent to your colleague." };
}

export async function respondSwap(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["HOD", "FACULTY"]);
  const decision = z.enum(["APPROVED", "REJECTED"]).parse(fd.get("decision"));
  const req = await db.swapRequest.findFirst({ where: { id: String(fd.get("id")), toId: me.facultyId ?? "-", status: "PENDING" }, include: { slot: { include: { offering: true } }, from: { select: { userId: true } } } });
  if (!req) return { error: "Request not found." };
  if (decision === "APPROVED") {
    const term = await currentTerm();
    const busy = await db.timetableSlot.findFirst({ where: { dayOfWeek: req.slot.dayOfWeek, period: req.slot.period, offering: { facultyId: me.facultyId, termId: term?.id } } });
    if (busy) return { error: "You already have a class in that period." };
    await db.$transaction([
      db.swapRequest.update({ where: { id: req.id }, data: { status: "APPROVED" } }),
      db.substitution.upsert({ where: { offeringId_date_period: { offeringId: req.slot.offeringId, date: req.date, period: req.slot.period } }, create: { offeringId: req.slot.offeringId, date: req.date, period: req.slot.period, facultyId: me.facultyId!, reason: "Class swap" }, update: { facultyId: me.facultyId! } }),
    ]);
  } else await db.swapRequest.update({ where: { id: req.id }, data: { status: "REJECTED" } });
  revalidatePath("/staff/swaps");
  notifyAcademic({ type: "swap-decision", id: req.id });
  return { ok: true, message: decision === "APPROVED" ? "Accepted. The class is on your Attendance page for that date." : "Declined." };
}
