import "server-only";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";

export const LEAVE_QUOTA = { CASUAL: 12, SICK: 10, EARNED: 15, ON_DUTY: 0 } as const; // days per calendar year; on-duty is unlimited
export const LEAVE_LABEL = { CASUAL: "Casual leave", SICK: "Sick leave", EARNED: "Earned leave", ON_DUTY: "On duty" } as const;

/** Staff a manager is responsible for: an HOD manages their department's faculty; the principal manages everyone else. */
export function managedStaff(user: CurrentUser): Prisma.UserWhereInput {
  if (user.role === "ADMIN") return { role: { in: ["HOD", "FACULTY", "ACCOUNTANT", "OFFICE"] } };
  if (user.role === "HOD") return { role: "FACULTY", faculty: { departmentId: user.departmentId ?? "-" } };
  return { id: "-" };
}

/** Working days between two dates, inclusive (Sundays excluded). */
export function workingDays(from: Date, to: Date) {
  let n = 0;
  for (let d = from; d <= to; d = new Date(d.getTime() + 864e5)) if (d.getUTCDay() !== 0) n++;
  return n;
}

/** Approved leave days taken in a calendar year, by type. */
export async function leaveUsed(userId: string, year: number) {
  const day = (s: string) => new Date(`${s}T00:00:00Z`);
  const rows = await db.staffLeave.findMany({ where: { userId, status: "APPROVED", fromDate: { gte: day(`${year}-01-01`), lte: day(`${year}-12-31`) } } });
  const used = { CASUAL: 0, SICK: 0, EARNED: 0, ON_DUTY: 0 };
  for (const r of rows) used[r.type] += workingDays(r.fromDate, r.toDate);
  return used;
}

