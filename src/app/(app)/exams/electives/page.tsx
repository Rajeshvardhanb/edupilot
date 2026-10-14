import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, programScope } from "@/lib/scope";
import { chooseElective, closeElective, openElective } from "@/actions/exams";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Progress, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Electives" };

export default async function ElectivesPage() {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT"]);
  const term = await currentTerm();

  if (user.role === "STUDENT") {
    const student = await db.student.findUniqueOrThrow({ where: { id: user.studentId! }, include: { batch: true, electives: true } });
    const options = await db.electiveOption.findMany({
      where: { termId: term?.id, subject: { programId: student.batch.programId, semester: { in: [student.batch.currentSemester, student.batch.currentSemester + 1] } } },
      include: { subject: true, _count: { select: { choices: true } } }, orderBy: { subject: { code: "asc" } },
    });
    const mine = new Set(student.electives.map((e) => e.optionId));
    return (
      <>
        <PageHeader title="Choose your elective" subtitle="One elective per semester. You can change your choice while seats remain." />
        {options.length === 0 ? <EmptyState title="No electives are open for your semester right now" /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((o) => {
              const full = o._count.choices >= o.seatLimit, chosen = mine.has(o.id);
              return (
                <div key={o.id} className={`rounded-[var(--radius-card)] border bg-surface p-5 shadow-card ${chosen ? "border-brand ring-2 ring-brand/20" : "border-line"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold">{o.subject.name}</p>{chosen && <Badge tone="brand">Your choice</Badge>}</div>
                  <p className="mt-1 text-xs text-muted">{o.subject.code} · Semester {o.subject.semester} · {o.subject.credits} credits</p>
                  <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span className="text-muted">Seats filled</span><span>{o._count.choices}/{o.seatLimit}</span></div><Progress value={(o._count.choices / o.seatLimit) * 100} tone={full ? "danger" : "brand"} /></div>
                  <div className="mt-4">{chosen ? <span className="text-sm text-success">Enrolled</span> : full ? <Badge tone="danger">Full</Badge> : <ActionButton action={chooseElective} fields={{ optionId: o.id }} variant="secondary" size="md">Select this elective</ActionButton>}</div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  const [options, subjects] = await Promise.all([
    db.electiveOption.findMany({ where: { termId: term?.id, subject: { program: programScope(user) } }, include: { subject: { include: { program: true } }, _count: { select: { choices: true } } }, orderBy: { subject: { code: "asc" } } }),
    db.subject.findMany({ where: { type: "ELECTIVE", program: programScope(user) }, include: { program: true }, orderBy: [{ program: { code: "asc" } }, { semester: "asc" }] }),
  ]);
  return (
    <>
      <PageHeader title="Elective selection" subtitle={`${term?.name} · open electives and seat limits`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Open electives">
          {options.length === 0 ? <EmptyState title="No electives are open">Open one from the form. Subjects of type “Elective” in the curriculum can be offered.</EmptyState> : (
            <Table>
              <thead><tr><Th>Elective</Th><Th>Programme · Sem</Th><Th className="w-48">Seats</Th><Th /></tr></thead>
              <tbody>{options.map((o) => (
                <tr key={o.id}>
                  <Td>{o.subject.name}<p className="font-mono text-xs text-muted">{o.subject.code}</p></Td>
                  <Td>{o.subject.program.code} · {o.subject.semester}</Td>
                  <Td><div className="flex items-center gap-2"><Progress value={(o._count.choices / o.seatLimit) * 100} /><span className="text-xs tabular-nums">{o._count.choices}/{o.seatLimit}</span></div></Td>
                  <Td><ActionButton action={closeElective} fields={{ id: o.id }} variant="ghost" confirm="Close this elective? Students' choices for it are removed.">Close</ActionButton></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        <Card title="Open an elective">
          <ActionForm action={openElective} className="space-y-3">
            <Field label="Subject" name="subjectId"><select id="subjectId" name="subjectId" className="input" required>{subjects.map((s) => <option key={s.id} value={s.id}>{s.program.code} S{s.semester} · {s.name}</option>)}</select></Field>
            <Field label="Seat limit" name="seatLimit"><input id="seatLimit" name="seatLimit" type="number" min={1} defaultValue={40} className="input" /></Field>
            <SubmitButton>Open</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
