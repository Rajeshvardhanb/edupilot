import type { CurrentUser } from "./auth";
import type { Role } from "@prisma/client";
export type PhotoTarget = { id: string; role: Role; student: { id: string; batch: { program: { departmentId: string } } } | null };
export function canManagePhoto(me: Pick<CurrentUser, "id" | "role">, target: PhotoTarget) {
  return me.id === target.id || me.role === "ADMIN" || me.role === "OFFICE" && target.role === "STUDENT" && !!target.student;
}
export function canViewPhoto(me: Pick<CurrentUser, "id" | "role" | "departmentId" | "children">, target: PhotoTarget) {
  if (canManagePhoto(me, target)) return true;
  if (!target.student) return false;
  if (me.role === "ACCOUNTANT") return true;
  if (me.role === "HOD" || me.role === "FACULTY") return !!me.departmentId && me.departmentId === target.student.batch.program.departmentId;
  return me.role === "PARENT" && me.children.some(c => c.id === target.student!.id);
}
