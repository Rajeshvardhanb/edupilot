import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { visibleStudentIdsSql } from "./student-visibility";

/**
 * Per-student, per-offering attendance counts, keyed "studentId:offeringId".
 * The database does the counting, so a term's ~100,000 records are never loaded into memory.
 * Present, late and on-duty all count as attended.
 */
export async function attendanceSummary(where: { studentIds?: string[]; offeringIds?: string[] }) {
  const map = new Map<string, { attended: number; total: number }>();
  // An empty list means "none of them", the same as Prisma's `in: []`.
  if (where.studentIds?.length === 0 || where.offeringIds?.length === 0) return map;
  const rows = await db.$queryRaw<{ studentId: string; offeringId: string; attended: bigint; total: bigint }[]>`
    SELECT r.studentId, s.offeringId, SUM(r.status IN ('PRESENT','LATE','ON_DUTY')) AS attended, COUNT(*) AS total
    FROM AttendanceRecord r JOIN AttendanceSession s ON s.id = r.sessionId
    WHERE r.studentId IN (${visibleStudentIdsSql})
      ${where.studentIds ? Prisma.sql`AND r.studentId IN (${Prisma.join(where.studentIds)})` : Prisma.empty}
      ${where.offeringIds ? Prisma.sql`AND s.offeringId IN (${Prisma.join(where.offeringIds)})` : Prisma.empty}
    GROUP BY r.studentId, s.offeringId`;
  for (const r of rows) map.set(`${r.studentId}:${r.offeringId}`, { attended: Number(r.attended), total: Number(r.total) });
  return map;
}
