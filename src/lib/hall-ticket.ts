import "server-only";
import { db } from "./db";
import { hallTicketStatus, type HallTicketStatus } from "./eligibility";
import { batchLabel, fmtDate } from "./format";
import type { Doc } from "./pdf";

type Student = { id: string; rollNo: string; batchId: string; user: { name: string }; batch: { admissionYear: number; section: string; currentSemester: number; program: { code: string; name: string } } };

/** Draws one hall ticket on the current page of a PDF. */
export async function drawHallTicket(doc: Doc, s: Student, st: HallTicketStatus, term: { id: string; name: string } | null) {
  const exams = await db.examSchedule.findMany({ where: { kind: "END_SEM", termId: term?.id, subject: { offerings: { some: { termId: term?.id, batchId: s.batchId } } } }, include: { subject: true, seats: { where: { studentId: s.id }, include: { room: true } } }, orderBy: [{ date: "asc" }, { session: "asc" }] });
  await doc.letterhead("Hall ticket", term?.name);
  doc.pairs([["Name", s.user.name], ["Hall ticket no.", s.rollNo], ["Programme", s.batch.program.name], ["Batch · semester", `${batchLabel(s.batch)} · Semester ${s.batch.currentSemester}`], ["Attendance", `${st.attendance}%${st.condoned ? " (condoned)" : ""}`]]);
  doc.space(10);
  doc.table(["Date", "Session", "Code", "Subject", "Hall · seat", "Invigilator"], exams.map((e) => [fmtDate(e.date), e.session === "FN" ? "10:00-13:00" : "14:00-17:00", e.subject.code, e.subject.name, e.seats[0] ? `${e.seats[0].room.name} · ${e.seats[0].seatNo}` : "To be notified", ""]), { widths: [1.3, 1.2, 1.1, 2.6, 1.6, 1.2] });
  doc.space(18);
  for (const rule of ["1. Carry this hall ticket and your college ID card to every examination.", "2. Report to the hall 30 minutes before the start. Entry closes 30 minutes after the start.", "3. Mobile phones, smart watches and programmable calculators are not permitted."]) doc.line(rule, { size: 8 });
  doc.space(50);
  doc.text("Signature of the candidate", { size: 9 }); doc.text("Controller of Examinations", { size: 9, align: "right" });
}

export { hallTicketStatus };
