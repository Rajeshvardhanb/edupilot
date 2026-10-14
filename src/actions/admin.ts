"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { forgetInstitution, getInstitution } from "@/lib/institution";
import { parseGradeScale } from "@/lib/grading";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import type { ActionState } from "@/lib/action-state";

// ── Notices ──
const NoticeSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(200),
  body: z.string().trim().min(5, "Message is required"),
  audience: z.enum(["ALL", "STUDENTS", "FACULTY"]),
  pinned: z.literal("on").optional(),
});

export async function createNotice(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const p = NoticeSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const n = await db.notice.create({
    data: { title: p.data.title, body: p.data.body, audience: p.data.audience, pinned: me.role === "ADMIN" && !!p.data.pinned, createdById: me.id, departmentId: me.role === "HOD" || me.role === "FACULTY" ? me.departmentId : null },
  });
  await audit(me.id, "CREATE", "Notice", n.id, n.title);
  const roles = n.audience === "STUDENTS" ? ["STUDENT", "PARENT"] : n.audience === "FACULTY" ? ["FACULTY", "HOD", "ACCOUNTANT", "OFFICE"] : ["STUDENT", "PARENT", "FACULTY", "HOD", "ACCOUNTANT", "OFFICE"];
  const audience = await db.user.findMany({ where: { role: { in: roles as never }, isActive: true, id: { not: me.id } }, select: { id: true } });
  await notifyUsers(audience.map((u) => u.id), { title: `Notice: ${n.title}`, body: n.body.slice(0, 600), href: "/notices", email: fd.get("email") === "on" });
  revalidatePath("/notices");
  return { ok: true, message: "Notice published." };
}

export async function deleteNotice(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const n = await db.notice.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  if (me.role !== "ADMIN" && n.createdById !== me.id) return { error: "You can only delete your own notices." };
  await db.$transaction([
    db.notice.delete({ where: { id: n.id } }),
    // Take back the bell notifications it sent, so a withdrawn notice does not linger in anyone's list.
    db.notification.deleteMany({ where: { title: `Notice: ${n.title}`, href: "/notices", createdAt: { gte: new Date(n.createdAt.getTime() - 1000) } } }),
  ]);
  await audit(me.id, "DELETE", "Notice", n.id, n.title);
  revalidatePath("/notices");
  return { ok: true };
}

// ── Users ──
export async function toggleUserActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const id = String(fd.get("id"));
  if (id === me.id) return { error: "You cannot disable your own account." };
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  await db.user.update({ where: { id }, data: { isActive: !u.isActive } });
  await audit(me.id, u.isActive ? "DISABLE" : "ENABLE", "User", id, u.email);
  revalidatePath("/admin");
  return { ok: true };
}

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const id = String(fd.get("id"));
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  const temp = `Edu@${Math.random().toString(36).slice(2, 8)}`;
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(temp, 10), mustChangePassword: true, passwordChangedAt: new Date(Math.floor(Date.now() / 1000) * 1000 + 1000), failedLogins: 0, lockedUntil: null } });
  await audit(me.id, "RESET_PASSWORD", "User", id, u.email);
  return { ok: true, message: `Temporary password for ${u.email}: ${temp}` };
}

export async function turnOffTwoStep(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const u = await db.user.update({ where: { id: String(fd.get("id")) }, data: { twoStep: false } });
  await audit(me.id, "TWO_STEP_OFF", "User", u.id, `by administrator for ${u.email}`);
  revalidatePath("/admin");
  return { ok: true, message: `Two-step sign-in turned off for ${u.email}.` };
}

const StaffSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().transform((v) => v.toLowerCase()),
  role: z.enum(["ADMIN", "ACCOUNTANT", "OFFICE"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Admin and accounts staff (faculty and students are created from their own modules). */
export async function createStaffUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const p = StaffSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (await db.user.findUnique({ where: { email: p.data.email } })) return { error: "Email already registered." };
  const u = await db.user.create({ data: { name: p.data.name, email: p.data.email, role: p.data.role, mustChangePassword: true, passwordHash: await bcrypt.hash(p.data.password, 10) } });
  await audit(me.id, "CREATE", "User", u.id, `${u.role} ${u.email}`);
  revalidatePath("/admin");
  return { ok: true, message: "User created." };
}

// ── Academic rules ──
/** Attendance thresholds, pass marks and the grade scale. Applies to results computed from now on; published results keep their grades. */
export async function saveRules(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const int = (k: string) => Math.round(Number(fd.get(k)));
  const attendanceRequired = int("attendanceRequired"), attendanceCondonable = int("attendanceCondonable"), passPercent = int("passPercent"), minExternalPercent = int("minExternalPercent");
  const bad = (n: number, lo: number, hi: number) => !Number.isFinite(n) || n < lo || n > hi;
  if (bad(attendanceRequired, 1, 100)) return { fieldErrors: { attendanceRequired: ["Enter a percentage from 1 to 100"] } };
  if (bad(attendanceCondonable, 0, attendanceRequired)) return { fieldErrors: { attendanceCondonable: ["Must be between 0 and the required attendance"] } };
  if (bad(passPercent, 1, 100)) return { fieldErrors: { passPercent: ["Enter a percentage from 1 to 100"] } };
  if (bad(minExternalPercent, 0, 100)) return { fieldErrors: { minExternalPercent: ["Enter a percentage from 0 to 100"] } };

  const rawLimit = String(fd.get("promoteMaxBacklogs") ?? "").trim();
  const promoteMaxBacklogs = rawLimit === "" ? null : Math.round(Number(rawLimit));
  if (promoteMaxBacklogs !== null && bad(promoteMaxBacklogs, 0, 60)) return { fieldErrors: { promoteMaxBacklogs: ["Enter a number from 0 to 60, or leave it empty"] } };
  const placementFromSemestersLeft = [1, 3, 5, 99].includes(int("placementSemestersLeft")) ? int("placementSemestersLeft") : 3;

  const mins = fd.getAll("min").map(String), grades = fd.getAll("grade").map(String), points = fd.getAll("point").map(String);
  const rows = grades.map((g, i) => ({ grade: g.trim(), min: mins[i]?.trim() ?? "", point: points[i]?.trim() ?? "" })).filter((r) => r.grade || r.min || r.point);
  if (rows.some((r) => !r.grade || r.min === "" || r.point === "")) return { error: "Each grade row needs a letter, the marks it starts at, and its grade points. Clear a row completely to remove it." };
  const scale = parseGradeScale(rows.map((r) => ({ grade: r.grade, min: Number(r.min), point: Number(r.point) })));
  if (!scale) return { error: "The grade scale isn't usable. It needs at least two grades, each letter and starting mark used once, points from 0 to 10 that don't rise as marks fall, and a last row starting at 0%." };
  if (scale.some((g) => !Number.isInteger(g.point))) return { error: "Grade points must be whole numbers." };
  const fail = scale[scale.length - 1];
  if (fail.point !== 0) return { error: `The lowest grade (${fail.grade}, from 0%) is the fail grade and must carry 0 points.` };
  const lowestPass = scale[scale.length - 2];
  if (lowestPass.min > passPercent) return { error: `A student who passes with ${passPercent}% would have no grade: the lowest pass grade (${lowestPass.grade}) starts at ${lowestPass.min}%. Lower that grade or raise the pass mark.` };

  await getInstitution();
  await db.institution.update({ where: { id: 1 }, data: { attendanceRequired, attendanceCondonable, passPercent, minExternalPercent, gradeScale: scale, promoteMaxBacklogs, placementFromSemestersLeft } });
  forgetInstitution();
  await audit(me.id, "UPDATE", "Rules", "1", `attendance ${attendanceRequired}/${attendanceCondonable}, pass ${passPercent}/${minExternalPercent}, ${scale.length} grades`);
  revalidatePath("/", "layout");
  return { ok: true, message: "Rules saved. They apply to attendance everywhere straight away, and to results published from now on." };
}

export async function resetGradeScale(): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  await getInstitution();
  await db.institution.update({ where: { id: 1 }, data: { gradeScale: Prisma.DbNull } });
  forgetInstitution();
  await audit(me.id, "UPDATE", "Rules", "1", "grade scale reset to default");
  revalidatePath("/", "layout");
  return { ok: true, message: "Grade scale reset to the standard 10-point scale." };
}

// ── System health ──
export async function resolveError(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  await db.errorLog.update({ where: { id: String(fd.get("id")) }, data: { resolvedAt: new Date() } });
  revalidatePath("/admin/health");
  return { ok: true };
}

export async function resolveAllErrors(): Promise<ActionState> {
  await requireUser(["ADMIN"]);
  await db.errorLog.updateMany({ where: { resolvedAt: null }, data: { resolvedAt: new Date() } });
  revalidatePath("/admin/health");
  return { ok: true, message: "All errors marked as resolved." };
}
