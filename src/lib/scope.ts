import "server-only";
import type { Prisma, Term } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { daysAgo } from "./format";

/**
 * Students the user may see: HODs and faculty are limited to their department, students and
 * parents to one record. Combine it with other conditions using `AND: [{ id }, studentScope(user)]`,
 * never by spreading: for a student the scope is itself an `id` filter and would overwrite yours.
 */
export function studentScope(user: CurrentUser): Prisma.StudentWhereInput {
  if (user.role === "HOD" || user.role === "FACULTY")
    return { batch: { program: { departmentId: user.departmentId ?? "-" } } };
  if (user.role === "STUDENT" || user.role === "PARENT") return { id: user.studentId ?? "-" };
  return {};
}

/** Course offerings the user manages: faculty see their own, HODs their department's. */
export function offeringScope(user: CurrentUser): Prisma.CourseOfferingWhereInput {
  if (user.role === "FACULTY") {
    const fid = user.facultyId ?? "-";
    // Own courses, plus any course this teacher is covering as a substitute (within the last week or upcoming).
    return { OR: [{ facultyId: fid }, { substitutions: { some: { facultyId: fid, date: { gte: daysAgo(7) } } } }] };
  }
  if (user.role === "HOD") return { batch: { program: { departmentId: user.departmentId ?? "-" } } };
  if (user.role === "ADMIN") return {};
  return { id: "-" };
}

export function programScope(user: CurrentUser): Prisma.ProgramWhereInput {
  return user.role === "HOD" ? { departmentId: user.departmentId ?? "-" } : {};
}

// The current term is read by almost every page and changes twice a year: keep it briefly in memory.
let termMemo: { at: number; value: Term | null } | null = null;
export async function currentTerm() {
  if (termMemo && Date.now() - termMemo.at < 15_000) return termMemo.value;
  const value = (await db.term.findFirst({ where: { isCurrent: true } })) ?? (await db.term.findFirst({ orderBy: { startDate: "desc" } }));
  termMemo = { at: Date.now(), value };
  return value;
}
/** Call after adding, editing or switching terms. */
export function forgetCurrentTerm() { termMemo = null; }

/** Throws unless the user may manage this offering (marks, attendance). */
export async function assertOffering(user: CurrentUser, offeringId: string) {
  const o = await db.courseOffering.findFirst({ where: { id: offeringId, ...offeringScope(user) }, select: { id: true } });
  if (!o) throw new Error("You are not allowed to manage this course.");
}
