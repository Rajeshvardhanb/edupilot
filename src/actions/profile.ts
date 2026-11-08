"use server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountProfileSchema, personalProfileSchema } from "@/lib/profile-validation";
import type { ActionState } from "@/lib/action-state";

export async function updateMyProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  const values = Object.fromEntries(formData);
  const account = accountProfileSchema.safeParse(values);
  if (!account.success) return { error: account.error.issues[0].message };
  const personal = me.role === "STUDENT" ? personalProfileSchema.safeParse(values) : null;
  if (personal && !personal.success) return { error: personal.error.issues[0].message };
  const current = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { email: true, passwordHash: true } });
  if (current.email !== account.data.email && !(await bcrypt.compare(String(formData.get("currentPassword") ?? ""), current.passwordHash)))
    return { error: "Enter your current password to change your login email." };
  if (me.role === "STUDENT" && !me.studentId) return { error: "No student record is linked to your account." };
  try {
    await db.$transaction(async tx => {
      await tx.user.update({ where: { id: me.id }, data: account.data });
      if (personal?.success && me.studentId)
        await tx.student.update({ where: { id: me.studentId, userId: me.id }, data: personal.data });
      await tx.auditLog.create({ data: { userId: me.id, action: "UPDATE_PROFILE", entity: "User", entityId: me.id, details: "Updated own profile details" } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "That email address is already registered." };
    return { error: "Could not save your profile. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Your profile has been updated." };
}
