import "server-only";
import { Prisma, type AttendanceStatus } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { assertOffering } from "./scope";
import { audit } from "./audit";
import { notifyStudents } from "./notify";
import type { ActionState } from "./action-state";

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "ON_DUTY"];

export type AttendanceInput = { offeringId: string; date: string; period: number; topic?: string; marks: Record<string, string> };

/** Holiday (from the academic calendar) covering this date, if any. */
export async function holidayOn(date: Date) {
  return db.calendarEvent.findFirst({
    where: { type: "HOLIDAY", OR: [{ date }, { date: { lte: date }, endDate: { gte: date } }] },
  });
}

/** Validates and stores one class's attendance. Shared by the form action and the offline sync endpoint. */
export async function recordAttendance(me: CurrentUser, input: AttendanceInput): Promise<ActionState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Pick a date." };
  if (!Number.isInteger(input.period) || input.period < 1 || input.period > 10) return { error: "Invalid period." };
  try { await assertOffering(me, input.offeringId); } catch (e) { return { error: (e as Error).message }; }

  const date = new Date(`${input.date}T00:00:00Z`);
  if (date.getTime() > Date.now()) return { error: "Attendance cannot be marked for a future date." };
  if (date.getUTCDay() === 0) return { error: "Sunday is not a working day." };
  const holiday = await holidayOn(date);
  if (holiday) return { error: `${input.date} is a holiday (${holiday.title}).` };

  const offering = await db.courseOffering.findUniqueOrThrow({ where: { id: input.offeringId }, include: { term: true } });
  if (date < offering.term.startDate || date > offering.term.endDate) return { error: "Date is outside this term." };

  // Only students actually in this batch may be recorded.
  const enrolled = new Set((await db.student.findMany({ where: { batchId: offering.batchId }, select: { id: true } })).map((s) => s.id));
  const rows = Object.entries(input.marks)
    .map(([studentId, status]) => ({ studentId, status: status as AttendanceStatus }))
    .filter((r) => STATUSES.includes(r.status) && enrolled.has(r.studentId));
  if (!rows.length) return { error: "No students to mark." };

  // Absence alerts go out when a class is first marked, not on every later correction.
  const firstTime = !(await db.attendanceSession.findUnique({ where: { offeringId_date_period: { offeringId: input.offeringId, date, period: input.period } }, select: { id: true } }));
  const save = () => db.$transaction(async (tx) => {
    const session = await tx.attendanceSession.upsert({
      where: { offeringId_date_period: { offeringId: input.offeringId, date, period: input.period } },
      create: { offeringId: input.offeringId, date, period: input.period, topic: input.topic || null, takenById: me.id },
      update: { topic: input.topic || null, takenById: me.id },
    });
    await tx.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
    await tx.attendanceRecord.createMany({ data: rows.map((r) => ({ ...r, sessionId: session.id })) });
  });
  try {
    await save();
  } catch (e) {
    // Two saves for the same class at the same instant (double submit, offline sync): the loser retries as an update.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    await save();
  }
  await audit(me.id, "MARK", "Attendance", input.offeringId, `${input.date} P${input.period}`);
  const absentees = rows.filter((r) => r.status === "ABSENT").map((r) => r.studentId);
  if (absentees.length && firstTime) {
    const subject = await db.subject.findUniqueOrThrow({ where: { id: offering.subjectId }, select: { name: true } });
    await notifyStudents(absentees, { title: `Marked absent: ${subject.name}`, body: `${input.date}, period ${input.period}. Speak to your teacher within 3 days if this is a mistake.`, href: "/attendance" });
  }
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  return { ok: true, message: `Saved: ${rows.length - absent} present, ${absent} absent.` };
}
