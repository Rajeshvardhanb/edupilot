"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { studentScope } from "@/lib/scope";
import type { ActionState } from "@/lib/action-state";

const CHANNELS = ["WHATSAPP", "EMAIL", "PHONE", "IN_PERSON"] as const;
const PURPOSES = ["ATTENDANCE", "FEES", "RESULTS", "CONDUCT", "GENERAL"] as const;
const STAFF = ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"] as const;

/** Notes that a parent or guardian was contacted about a student. Called by the WhatsApp button and by the form on the student page. */
export async function logParentContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser([...STAFF]);
  const studentId = String(fd.get("studentId") ?? "");
  const channel = String(fd.get("channel") ?? ""), purpose = String(fd.get("purpose") ?? "GENERAL");
  const message = String(fd.get("message") ?? "").trim().slice(0, 2000);
  if (!CHANNELS.includes(channel as never) || !PURPOSES.includes(purpose as never)) return { error: "Choose how and why the parent was contacted." };
  if (message.length < 3) return { error: "Write a short note of what was said." };
  // Staff can only log against students they are allowed to see.
  if (!(await db.student.findFirst({ where: { AND: [{ id: studentId }, studentScope(me)] }, select: { id: true } }))) return { error: "Student not found." };
  await db.parentContact.create({ data: { studentId, channel, purpose, message, byId: me.id } });
  revalidatePath(`/students/${studentId}`);
  return { ok: true, message: "Added to the contact log." };
}
