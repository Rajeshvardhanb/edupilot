"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";

const opt = z.string().trim().optional().transform((v) => v || undefined);
const FacultySchema = z.object({
  id: opt,
  name: z.string().trim().min(2, "Name is required"),
  email: z.email().transform((v) => v.toLowerCase()),
  phone: opt,
  employeeId: z.string().trim().min(2, "Employee ID is required").transform((v) => v.toUpperCase()),
  departmentId: z.string().min(1, "Select a department"),
  designation: z.string().min(2),
  qualification: opt,
  specialization: opt,
  joiningDate: opt.transform((v) => (v ? new Date(`${v}T00:00:00Z`) : undefined)),
});

export async function saveFaculty(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const p = FacultySchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { fieldErrors: z.flattenError(p.error).fieldErrors, error: "Please fix the highlighted fields." };
  const { id, name, email, phone, ...data } = p.data;
  if (me.role === "HOD") {
    const existing = id ? await db.faculty.findUnique({ where: { id } }) : null;
    if (data.departmentId !== me.departmentId || (id && existing?.departmentId !== me.departmentId))
      return { error: "HODs can only manage faculty of their own department." };
  }
  let fid = id;
  try {
    if (id) {
      await db.$transaction(async (tx) => {
        const f = await tx.faculty.update({ where: { id }, data });
        await tx.user.update({ where: { id: f.userId }, data: { name, email, phone } });
      });
    } else {
      const u = await db.user.create({
        data: { name, email, phone, role: "FACULTY", passwordHash: await bcrypt.hash(data.employeeId.toLowerCase(), 10), mustChangePassword: true, faculty: { create: data } },
        include: { faculty: true },
      });
      fid = u.faculty!.id;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: "Email or employee ID already exists." };
    throw e;
  }
  await audit(me.id, id ? "UPDATE" : "CREATE", "Faculty", fid, data.employeeId);
  redirect("/faculty");
}
