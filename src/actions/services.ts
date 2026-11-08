"use server";
import { notifyAcademic } from "@/lib/academic-email";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";

export async function createParentLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const studentId = String(fd.get("studentId"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId } });
  if (!z.email().safeParse(email).success) return { error: "Enter the parent's email address." };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.role !== "PARENT") return { error: "That email belongs to a staff or student account." };
  const temp = `Parent@${Math.random().toString(36).slice(2, 8)}`;
  const parent = existing ?? (await db.user.create({ data: { email, name: student.guardianName || "Parent", role: "PARENT", mustChangePassword: true, phone: student.guardianPhone, passwordHash: await bcrypt.hash(temp, 10) } }));
  await db.parentLink.upsert({ where: { userId_studentId: { userId: parent.id, studentId } }, create: { userId: parent.id, studentId }, update: {} });
  await audit(me.id, "CREATE", "ParentLogin", studentId, email);
  notifyAcademic(existing ? { type: "parent-link", id: parent.id, studentId } : { type: "account", id: parent.id });
  revalidatePath(`/students/${studentId}`);
  return { ok: true, message: existing ? `Linked existing parent account ${email}.` : `Parent login created: ${email} · temporary password ${temp}` };
}

export async function saveResume(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const url = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v && /^https?:\/\//i.test(v) ? v.slice(0, 190) : v ? null : ""; };
  const linkedin = url("linkedin"), github = url("github");
  if (linkedin === null || github === null) return { error: "Links must start with http:// or https://" };
  await db.student.update({ where: { id: me.studentId! }, data: { about: String(fd.get("about") ?? "").trim().slice(0, 1500) || null, skills: String(fd.get("skills") ?? "").trim().slice(0, 500) || null, linkedin: linkedin || null, github: github || null } });
  revalidatePath("/placements");
  return { ok: true, message: "Profile saved. Recruiters see this with your application." };
}
