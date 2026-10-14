import { requireUser, isLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, programScope } from "@/lib/scope";
import { fmtDate, isoDate } from "@/lib/format";
import { assignInvigilators, deleteExam, generateSeating, removeInvigilator, saveExam, saveRoom } from "@/actions/exams";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Exam schedule" };
const SESSION: Record<string, string> = { FN: "FN · 10:00–13:00", AN: "AN · 14:00–17:00" };
const KIND: Record<string, string> = { END_SEM: "End semester", MID_1: "Mid term 1", MID_2: "Mid term 2" };

export default async function ExamSchedulePage() {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "STUDENT", "PARENT"]);
  const term = await currentTerm();
  const manage = user.role === "ADMIN" || user.role === "HOD";
  const student = isLearner(user) && user.studentId ? await db.student.findUnique({ where: { id: user.studentId }, select: { id: true, batchId: true } }) : null;

  const exams = await db.examSchedule.findMany({
    where: { termId: term?.id, ...(student ? { subject: { offerings: { some: { termId: term?.id, batchId: student.batchId } } } } : user.role === "HOD" ? { subject: { program: programScope(user) } } : {}) },
    include: { subject: { include: { program: true } }, _count: { select: { seats: true } }, seats: { where: { studentId: student?.id ?? "-" }, include: { room: true } } },
    orderBy: [{ date: "asc" }, { session: "asc" }],
  });
  const [rooms, subjects] = manage
    ? await Promise.all([
        db.examRoom.findMany({ orderBy: { name: "asc" } }),
        db.subject.findMany({ where: { offerings: { some: { termId: term?.id } }, program: programScope(user) }, include: { program: true }, orderBy: [{ program: { code: "asc" } }, { semester: "asc" }, { code: "asc" }] }),
      ])
    : [[], []];
  const slots = [...new Map(exams.map((e) => [`${isoDate(e.date)}|${e.session}`, e])).values()];
  // Who supervises which hall. Staff see every duty; a teacher's own are highlighted.
  const duties = isLearner(user) ? [] : await db.invigilationDuty.findMany({
    where: { date: { gte: term?.startDate, lte: term?.endDate } },
    include: { room: true, faculty: { select: { id: true, user: { select: { name: true } } } } },
    orderBy: [{ date: "asc" }, { session: "asc" }, { room: { name: "asc" } }],
  });
  const mine = duties.filter((d) => d.faculty.id === user.facultyId);

  return (
    <>
      <PageHeader title="Exam schedule" subtitle={`${term?.name ?? ""} · mid-term and end-semester papers`} actions={<PrintButton />} />
      {mine.length > 0 && (
        <div className="mb-6 rounded-[var(--radius-card)] border border-brand/20 bg-brand-soft/60 p-4 text-sm">
          <p className="font-semibold">Your invigilation duties</p>
          <ul className="mt-2 flex flex-wrap gap-2">{mine.map((d) => <li key={d.id} className="rounded-full bg-surface px-3 py-1 text-xs font-medium ring-1 ring-line ring-inset">{fmtDate(d.date)} · {SESSION[d.session]} · {d.room.name}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`space-y-6 ${manage ? "lg:col-span-2" : "lg:col-span-3"}`}>
        <Card title="Time-table">
          {exams.length === 0 ? <EmptyState title="The exam schedule has not been published yet" /> : (
            <Table>
              <thead><tr><Th>Date</Th><Th>Session</Th><Th>Exam</Th><Th>Subject</Th><Th>Programme · Sem</Th>{student ? <Th>Your seat</Th> : <Th className="text-right">Seated</Th>}{manage && <Th />}</tr></thead>
              <tbody>{exams.map((e) => (
                <tr key={e.id}>
                  <Td className="font-medium whitespace-nowrap">{fmtDate(e.date)}<p className="text-xs font-normal text-muted">{e.date.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" })}</p></Td>
                  <Td className="whitespace-nowrap"><Badge tone={e.session === "FN" ? "info" : "warning"}>{SESSION[e.session]}</Badge></Td>
                  <Td><Badge tone={e.kind === "END_SEM" ? "brand" : "neutral"}>{KIND[e.kind] ?? e.kind}</Badge></Td>
                  <Td>{e.subject.name}<p className="font-mono text-xs text-muted">{e.subject.code}</p></Td>
                  <Td>{e.subject.program.code} · {e.subject.semester}</Td>
                  {student ? <Td>{e.seats[0] ? <span className="font-medium">{e.seats[0].room.name} · Seat {e.seats[0].seatNo}</span> : <span className="text-xs text-muted">Not allotted yet</span>}</Td> : <Td className="text-right">{e._count.seats || "—"}</Td>}
                  {manage && <Td><ActionButton action={deleteExam} fields={{ id: e.id }} variant="ghost" confirm={`Remove ${e.subject.name} from the schedule?`}>×</ActionButton></Td>}
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        {duties.length > 0 && (
          <Card title="Invigilation roster" actions={<span className="text-xs text-muted">{duties.length} duties</span>}>
            <Table>
              <thead><tr><Th>Date</Th><Th>Session</Th><Th>Hall</Th><Th>Teacher</Th>{manage && <Th />}</tr></thead>
              <tbody>{duties.map((d) => (
                <tr key={d.id} className={d.faculty.id === user.facultyId ? "bg-brand-soft/50" : ""}>
                  <Td className="font-medium whitespace-nowrap">{fmtDate(d.date)}</Td>
                  <Td className="whitespace-nowrap"><Badge tone={d.session === "FN" ? "info" : "warning"}>{SESSION[d.session]}</Badge></Td>
                  <Td>{d.room.name}</Td>
                  <Td>{d.faculty.user.name}</Td>
                  {manage && <Td className="text-right"><ActionButton action={removeInvigilator} fields={{ id: d.id }} variant="ghost" confirm={`Remove ${d.faculty.user.name} from ${d.room.name}?`}>×</ActionButton></Td>}
                </tr>
              ))}</tbody>
            </Table>
          </Card>
        )}
        </div>
        {manage && (
          <div className="no-print space-y-6">
            <Card title="Schedule an exam">
              <ActionForm action={saveExam} className="space-y-3">
                <Field label="Subject" name="subjectId"><select id="subjectId" name="subjectId" className="input" required>{subjects.map((s) => <option key={s.id} value={s.id}>{s.program.code} S{s.semester} · {s.code} {s.name}</option>)}</select></Field>
                <Field label="Exam" name="kind"><select id="kind" name="kind" className="input"><option value="END_SEM">End semester</option><option value="MID_1">Mid term 1</option><option value="MID_2">Mid term 2</option></select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" name="date"><input id="date" type="date" name="date" className="input" required /></Field>
                  <Field label="Session" name="session"><select id="session" name="session" className="input"><option value="FN">Forenoon</option><option value="AN">Afternoon</option></select></Field>
                </div>
                <SubmitButton>Save</SubmitButton>
                <p className="text-xs text-muted">Two papers for the same batch in one session are blocked.</p>
              </ActionForm>
            </Card>
            <Card title="Seating plan">
              {slots.length === 0 ? <p className="text-sm text-muted">Schedule exams first.</p> : (
                <ActionForm action={generateSeating} className="space-y-3">
                  <Field label="Exam session" name="slot">
                    <select id="slot" name="slot" className="input">{slots.map((e) => <option key={e.id} value={`${isoDate(e.date)}|${e.session}`}>{fmtDate(e.date)} · {e.session}</option>)}</select>
                  </Field>
                  <SubmitButton variant="secondary">Generate seating</SubmitButton>
                  <p className="text-xs text-muted">Students of different papers are alternated, in roll-number order.</p>
                </ActionForm>
              )}
            </Card>
            <Card title="Invigilation duty">
              {slots.length === 0 ? <p className="text-sm text-muted">Schedule exams first.</p> : (
                <ActionForm action={assignInvigilators} className="space-y-3">
                  <Field label="Exam session" name="slot">
                    <select name="slot" className="input">{slots.map((e) => <option key={e.id} value={`${isoDate(e.date)}|${e.session}`}>{fmtDate(e.date)} · {e.session}</option>)}</select>
                  </Field>
                  <SubmitButton variant="secondary">Assign teachers to halls</SubmitButton>
                  <p className="text-xs text-muted">One teacher per hall. Teachers on approved leave are skipped, and those with the fewest duties this term go first.</p>
                </ActionForm>
              )}
            </Card>
            {user.role === "ADMIN" && (
              <Card title={`Exam halls · ${rooms.reduce((s, r) => s + r.capacity, 0)} seats`}>
                <ul className="mb-3 space-y-1 text-sm">{rooms.map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}</span><span className="text-muted">{r.capacity} seats</span></li>)}</ul>
                <ActionForm action={saveRoom} className="flex gap-2" resetOnSuccess>
                  <input name="name" placeholder="Room" className="input" required />
                  <input name="capacity" type="number" placeholder="Seats" className="input w-24" required />
                  <SubmitButton size="sm" variant="secondary">Add</SubmitButton>
                </ActionForm>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
