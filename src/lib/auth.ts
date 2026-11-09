import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export const CHILD_COOKIE = "edupilot_child";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentId: string | null;
  facultyId: string | null;
  departmentId: string | null;
  mustChangePassword: boolean;
  /** A parent's linked children (empty for everyone else). */
  children: { id: string; name: string; rollNo: string }[];
};

/** Data Access Layer: verifies the session cookie and loads the user. Deduped per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const chosenChild = jar.get(CHILD_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: {
      student: { select: { id: true } },
      faculty: { select: { id: true, departmentId: true } },
      children: { select: { studentId: true, student: { select: { rollNo: true, user: { select: { name: true } } } } }, orderBy: { studentId: "asc" } },
    },
  });
  if (!user || !user.isActive) return null;
  // Changing or resetting a password signs out every session issued before it.
  if (user.passwordChangedAt && session.iat && session.iat * 1000 < user.passwordChangedAt.getTime()) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    // A parent sees the linked child's records (read-only).
    studentId: user.student?.id ?? (user.children.find((c) => c.studentId === chosenChild) ?? user.children[0])?.studentId ?? null,
    children: user.children.map((c) => ({ id: c.studentId, name: c.student.user.name, rollNo: c.student.rollNo })),
    facultyId: user.faculty?.id ?? null,
    departmentId: user.faculty?.departmentId ?? null,
    mustChangePassword: user.mustChangePassword,
  };
});

/** Use in pages & actions. Redirects to login (or dashboard when the role is not allowed). */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // Signed-in cookie but no usable account (deleted, disabled, data reset): clear it, don't loop.
  if (!user) redirect("/session/expired");
  // First login with a temporary password: nothing else is reachable until it is replaced.
  if (user.mustChangePassword) redirect("/change-password");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

/** Students and parents share the read-only "my records" views. */
export const isLearner = (u: { role: Role }) => u.role === "STUDENT" || u.role === "PARENT";

export const STAFF: Role[] = ["ADMIN", "HOD", "FACULTY"];
export const MANAGEMENT: Role[] = ["ADMIN", "HOD"];
export const FINANCE: Role[] = ["ADMIN", "ACCOUNTANT"];
/** The administrator and front-office staff, who run admissions, student records and campus services. */
export const isOffice = (u: { role: Role }) => u.role === "ADMIN" || u.role === "OFFICE";
