"use server";
import { notifyAcademic } from "@/lib/academic-email";

import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Basic teaching identity needed by course allocation and teacher sign-in. No HR profile. */
export async function createTeacher(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const parsed = z.object({ name: z.string().trim().min(2), email: z.email().transform((v) => v.toLowerCase()), employeeId: z.string().trim().min(2).transform((v) => v.toUpperCase()), departmentId: z.string().min(1) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, employeeId, departmentId } = parsed.data;
  if (me.role === "HOD" && me.departmentId !== departmentId) return { error: "Choose your own department." };
  if (!await db.department.findUnique({ where: { id: departmentId } })) return { error: "Department not found." };
  try {
    const user = await db.user.create({ data: { name, email, role: "FACULTY", passwordHash: await bcrypt.hash(employeeId.toLowerCase(), 10), mustChangePassword: true, faculty: { create: { employeeId, departmentId, designation: "Teacher" } } } });
    await audit(me.id, "CREATE", "TeacherAccount", user.id, employeeId);
    notifyAcademic({ type: "account", id: user.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Email or employee ID already exists." };
    throw e;
  }
  revalidatePath("/academics/teachers");
  return { ok: true, message: "Teacher account created. The temporary password is the employee ID in lowercase." };
}
