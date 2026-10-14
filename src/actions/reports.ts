"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SCHEDULED, sendSchedule } from "@/lib/scheduler";
import { mailConfigured } from "@/lib/mail";
import type { ActionState } from "@/lib/action-state";

export async function saveSchedule(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "ACCOUNTANT"]);
  const report = String(fd.get("report")), frequency = fd.get("frequency") === "MONTHLY" ? "MONTHLY" : "WEEKLY";
  if (!SCHEDULED[report]?.roles.includes(me.role)) return { error: "Choose a report." };
  await db.reportSchedule.upsert({ where: { userId_report: { userId: me.id, report } }, create: { userId: me.id, report, frequency }, update: { frequency } });
  revalidatePath("/reports/schedules");
  return { ok: true, message: `You'll receive this ${frequency.toLowerCase()} at ${me.email}.` };
}

export async function deleteSchedule(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "ACCOUNTANT"]);
  await db.reportSchedule.deleteMany({ where: { id: String(fd.get("id")), userId: me.id } });
  revalidatePath("/reports/schedules");
  return { ok: true, message: "Schedule removed." };
}

export async function sendScheduleNow(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "ACCOUNTANT"]);
  const s = await db.reportSchedule.findFirst({ where: { id: String(fd.get("id")), userId: me.id } });
  if (!s) return { error: "Schedule not found." };
  const status = await sendSchedule(s.id);
  revalidatePath("/reports/schedules");
  return status === "FAILED" ? { error: "The mail server rejected the message. See Administration → Email outbox." } : { ok: true, message: mailConfigured() ? `Sent to ${me.email}.` : "Generated and saved to the email outbox (no mail server is configured yet)." };
}

export async function saveAlumni(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  const studentId = String(fd.get("studentId"));
  const s = await db.student.findUnique({ where: { id: studentId }, include: { batch: { include: { program: true } } } });
  if (!s || s.status !== "GRADUATED") return { error: "Not a graduate." };
  const v = (k: string, max = 190) => String(fd.get(k) ?? "").trim().slice(0, max) || null;
  const linkedin = v("linkedin");
  if (linkedin && !/^https?:\/\//i.test(linkedin)) return { error: "LinkedIn link must start with http:// or https://" };
  const data = { company: v("company"), designation: v("designation"), location: v("location"), higherStudies: v("higherStudies"), personalEmail: v("personalEmail"), phone: v("phone", 20), linkedin };
  await db.alumniProfile.upsert({ where: { studentId }, create: { studentId, graduationYear: s.batch.admissionYear + s.batch.program.durationYears, ...data }, update: data });
  revalidatePath("/alumni");
  return { ok: true, message: "Alumni record updated." };
}
