"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Checked when a staff member leaves a field, so a clash is shown before the form is submitted.
 * Returns a message when there is a problem, otherwise an empty string.
 */
export async function checkField(kind: string, raw: string): Promise<string> {
  await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const value = raw.trim();
  if (!value || value.length > 190) return "";
  if (kind === "rollNo") {
    const s = await db.student.findUnique({ where: { rollNo: value.toUpperCase() }, select: { user: { select: { name: true } } } });
    return s ? `${value.toUpperCase()} is already ${s.user.name}'s roll number.` : "";
  }
  if (kind === "email") {
    const u = await db.user.findUnique({ where: { email: value.toLowerCase() }, select: { name: true } });
    return u ? `This email already belongs to ${u.name}.` : "";
  }
  if (kind === "employeeId") {
    const f = await db.faculty.findUnique({ where: { employeeId: value.toUpperCase() }, select: { user: { select: { name: true } } } });
    return f ? `${value.toUpperCase()} is already ${f.user.name}'s employee ID.` : "";
  }
  if (kind === "student") {
    const s = await db.student.findUnique({ where: { rollNo: value.toUpperCase() }, select: { id: true } });
    return s ? "" : `No student has the roll number ${value.toUpperCase()}.`;
  }
  return "";
}
