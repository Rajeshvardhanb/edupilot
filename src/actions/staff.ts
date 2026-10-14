"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { StaffDayStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { currentTerm } from "@/lib/scope";
import { notifyRoles, notifyUsers } from "@/lib/notify";
import { LEAVE_QUOTA, leaveUsed, managedStaff, workingDays } from "@/lib/staff";
import type { ActionState } from "@/lib/action-state";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

// ───────── Staff attendance ─────────
export async function saveStaffAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const date = String(fd.get("date"));
  if (!isoRe.test(date) || day(date).getTime() > Date.now()) return { error: "Pick today or an earlier date." };
  const allowed = new Set((await db.user.findMany({ where: managedStaff(me), select: { id: true } })).map((u) => u.id));
  const rows = [...fd].filter(([k]) => k.startsWith("u_")).map(([k, v]) => ({ userId: k.slice(2), status: String(v) as StaffDayStatus }))
    .filter((r) => allowed.has(r.userId) && ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"].includes(r.status));
  if (!rows.length) return { error: "Nothing to save." };
  await db.$transaction(rows.map((r) => db.staffAttendance.upsert({ where: { userId_date: { userId: r.userId, date: day(date) } }, create: { ...r, date: day(date) }, update: { status: r.status } })));
  await audit(me.id, "MARK", "StaffAttendance", undefined, `${date}: ${rows.length} staff`);
  revalidatePath("/staff");
  return { ok: true, message: `Saved for ${rows.length} staff. ${rows.filter((r) => r.status === "ABSENT").length} absent.` };
}

// ───────── Staff leave ─────────
const LeaveSchema = z.object({ type: z.enum(["CASUAL", "SICK", "EARNED", "ON_DUTY"]), fromDate: z.string().regex(isoRe, "Pick a start date"), toDate: z.string().regex(isoRe, "Pick an end date"), reason: z.string().trim().min(5, "Give a reason") });

export async function applyStaffLeave(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const p = LeaveSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const from = day(p.data.fromDate), to = day(p.data.toDate);
  if (to < from) return { error: "End date is before the start date." };
  const days = workingDays(from, to);
  if (days === 0) return { error: "Those dates contain no working days." };
  const quota = LEAVE_QUOTA[p.data.type];
  if (quota > 0) {
    const used = (await leaveUsed(me.id, from.getUTCFullYear()))[p.data.type];
    if (used + days > quota) return { error: `Only ${quota - used} day(s) of this leave remain for ${from.getUTCFullYear()}; this request needs ${days}.` };
  }
  if (await db.staffLeave.findFirst({ where: { userId: me.id, status: { not: "REJECTED" }, fromDate: { lte: to }, toDate: { gte: from } } })) return { error: "You already have a leave request overlapping these dates." };
  await db.staffLeave.create({ data: { userId: me.id, type: p.data.type, fromDate: from, toDate: to, reason: p.data.reason } });
  // Faculty are approved by their HOD; HODs and office staff by the principal.
  if (me.role === "FACULTY") await notifyRoles(["HOD"], { title: `Leave request from ${me.name}`, body: `${days} day(s): ${p.data.reason}`, href: "/staff/leave" }, me.departmentId);
  else await notifyRoles(["ADMIN"], { title: `Leave request from ${me.name}`, body: `${days} day(s): ${p.data.reason}`, href: "/staff/leave" });
  revalidatePath("/staff/leave");
  return { ok: true, message: `Request for ${days} working day(s) submitted.` };
}

export async function reviewStaffLeave(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const decision = z.enum(["APPROVED", "REJECTED"]).parse(fd.get("decision"));
  const req = await db.staffLeave.findFirst({ where: { id: String(fd.get("id")), user: managedStaff(me) } });
  if (!req) return { error: "Request not found." };
  if (req.status !== "PENDING") return { error: "Already reviewed." };
  await db.$transaction(async (tx) => {
    await tx.staffLeave.update({ where: { id: req.id }, data: { status: decision, reviewedById: me.id } });
    if (decision === "APPROVED") {
      for (let d = req.fromDate; d <= req.toDate && d.getTime() <= Date.now(); d = new Date(d.getTime() + 864e5)) {
        if (d.getUTCDay() === 0) continue;
        await tx.staffAttendance.upsert({ where: { userId_date: { userId: req.userId, date: d } }, create: { userId: req.userId, date: d, status: "ON_LEAVE" }, update: { status: "ON_LEAVE" } });
      }
    }
  });
  await audit(me.id, decision, "StaffLeave", req.id);
  await notifyUsers([req.userId], { title: `Your leave request was ${decision.toLowerCase()}`, body: `${req.fromDate.toISOString().slice(0, 10)} to ${req.toDate.toISOString().slice(0, 10)} · reviewed by ${me.name}`, href: "/staff/leave", email: true });
  revalidatePath("/staff/leave");
  return { ok: true, message: decision === "APPROVED" ? "Approved." : "Rejected." };
}

// ───────── Appraisal records ─────────
export async function saveAchievement(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["HOD", "FACULTY"]);
  if (!me.facultyId) return { error: "Only teaching staff can add records." };
  const kind = z.enum(["PUBLICATION", "CONFERENCE", "WORKSHOP", "FDP", "PATENT", "FUNDED_PROJECT", "AWARD"]).safeParse(fd.get("kind"));
  const title = String(fd.get("title") ?? "").trim(), date = String(fd.get("date") ?? ""), url = String(fd.get("url") ?? "").trim();
  if (!kind.success || title.length < 4 || !isoRe.test(date)) return { error: "Choose a type, and enter a title and date." };
  if (url && !/^https?:\/\//i.test(url)) return { error: "Link must start with http:// or https://" };
  await db.achievement.create({ data: { facultyId: me.facultyId, kind: kind.data, title: title.slice(0, 190), venue: String(fd.get("venue") ?? "").trim().slice(0, 190) || null, date: day(date), details: String(fd.get("details") ?? "").trim().slice(0, 1000) || null, url: url || null } });
  revalidatePath("/staff/achievements");
  return { ok: true, message: "Added to your appraisal record." };
}

export async function deleteAchievement(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const a = await db.achievement.findUnique({ where: { id: String(fd.get("id")) } });
  if (!a || (me.role !== "ADMIN" && a.facultyId !== me.facultyId)) return { error: "Not allowed." };
  await db.achievement.delete({ where: { id: a.id } });
  revalidatePath("/staff/achievements");
  return { ok: true, message: "Removed." };
}

// ───────── Class swaps ─────────
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
  await db.swapRequest.create({ data: { slotId: slot.id, date: d, fromId: me.facultyId!, toId, reason: String(fd.get("reason") ?? "").trim().slice(0, 190) || null } });
  await notifyUsers([to.userId], { title: `${me.name} asks you to take a class`, body: `${slot.offering.subject.name} on ${date}, period ${slot.period}`, href: "/staff/swaps", email: true });
  revalidatePath("/staff/swaps");
  return { ok: true, message: "Request sent to your colleague." };
}

/** Accepting makes the colleague the substitute for that period, so they can take its attendance. */
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
  await notifyUsers([req.from.userId], { title: `${me.name} ${decision === "APPROVED" ? "accepted" : "declined"} your class swap`, body: `${req.date.toISOString().slice(0, 10)}, period ${req.slot.period}`, href: "/staff/swaps", email: true });
  revalidatePath("/staff/swaps");
  return { ok: true, message: decision === "APPROVED" ? "Accepted. The class is on your Attendance page for that date." : "Declined." };
}
