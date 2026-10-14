import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { programScope } from "@/lib/scope";
import { saveSubject, deleteRecord } from "@/actions/academics";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td, LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { titleCase } from "@/lib/format";
import { AcademicsTabs } from "../tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Subjects" };

export default async function SubjectsPage(props: PageProps<"/academics/subjects">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const sp = await props.searchParams;
  const programs = await db.program.findMany({ where: programScope(user), orderBy: { code: "asc" } });
  const programId = (typeof sp.program === "string" && sp.program) || programs[0]?.id;
  const program = programs.find((p) => p.id === programId);
  const subjects = await db.subject.findMany({ where: { programId }, orderBy: [{ semester: "asc" }, { code: "asc" }] });
  const e = subjects.find((s) => s.id === sp.edit);
  const semesters = [...new Set(subjects.map((s) => s.semester))];

  return (
    <>
      <PageHeader title="Academics" subtitle="Curriculum / scheme of instruction with L-T-P hours, credits and evaluation pattern" />
      <AcademicsTabs active="/academics/subjects" />
      <Filters>
        <select name="program" aria-label="Program" defaultValue={programId} className="input w-auto">
          {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-academics-subjects" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {semesters.length === 0 && <EmptyState title="No subjects yet for this programme" action={<LinkButton variant="secondary" href="/admin/setup#step-6">Import the curriculum from a spreadsheet</LinkButton>}>Add subjects one at a time with the form, or bring in the whole scheme at once.</EmptyState>}
          {semesters.map((sem) => {
            const rows = subjects.filter((s) => s.semester === sem);
            return (
              <Card key={sem} title={`Semester ${sem}`} actions={<span className="text-xs text-muted">{rows.reduce((t, s) => t + s.credits, 0)} credits</span>}>
                <Table>
                  <thead><tr><Th>Code</Th><Th>Subject</Th><Th>Type</Th><Th>L-T-P</Th><Th className="text-right">Credits</Th><Th>CIE / SEE</Th><Th /></tr></thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <Td className="font-mono text-xs">{s.code}</Td>
                        <Td className="font-medium">{s.name}</Td>
                        <Td><Badge tone={s.type === "LAB" ? "info" : s.type === "THEORY" ? "neutral" : "brand"}>{titleCase(s.type)}</Badge></Td>
                        <Td className="tabular-nums">{s.lectureHrs}-{s.tutorialHrs}-{s.practicalHrs}</Td>
                        <Td className="text-right">{s.credits}</Td>
                        <Td className="tabular-nums">{s.internalMax} / {s.externalMax}</Td>
                        <Td className="text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <Link href={`/academics/subjects?program=${programId}&edit=${s.id}`} className="text-xs text-brand">Edit</Link>
                            {user.role === "ADMIN" && <ActionButton action={deleteRecord} fields={{ model: "subject", id: s.id }} variant="ghost" confirm={`Delete ${s.code}?`}>Delete</ActionButton>}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            );
          })}
        </div>
        <Card title={e ? `Edit ${e.code}` : `Add subject to ${program?.code ?? ""}`} className="h-fit lg:sticky lg:top-6">
          <ActionForm key={e?.id ?? "new"} action={saveSubject} className="space-y-3" resetOnSuccess={!e}>
            {e && <input type="hidden" name="id" value={e.id} />}
            <input type="hidden" name="programId" value={programId} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code" name="code"><input id="code" name="code" defaultValue={e?.code} className="input uppercase" required /></Field>
              <Field label="Semester" name="semester"><input id="semester" name="semester" type="number" min={1} max={program?.totalSemesters} defaultValue={e?.semester ?? 1} className="input" /></Field>
            </div>
            <Field label="Name" name="name"><input id="name" name="name" defaultValue={e?.name} className="input" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" name="type">
                <select id="type" name="type" defaultValue={e?.type ?? "THEORY"} className="input">{["THEORY", "LAB", "PROJECT", "ELECTIVE", "AUDIT"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
              </Field>
              <Field label="Credits" name="credits"><input id="credits" name="credits" type="number" step="0.5" defaultValue={e?.credits ?? 3} className="input" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Lecture" name="lectureHrs"><input id="lectureHrs" name="lectureHrs" type="number" min={0} defaultValue={e?.lectureHrs ?? 3} className="input" /></Field>
              <Field label="Tutorial" name="tutorialHrs"><input id="tutorialHrs" name="tutorialHrs" type="number" min={0} defaultValue={e?.tutorialHrs ?? 0} className="input" /></Field>
              <Field label="Practical" name="practicalHrs"><input id="practicalHrs" name="practicalHrs" type="number" min={0} defaultValue={e?.practicalHrs ?? 0} className="input" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Internal max (CIE)" name="internalMax"><input id="internalMax" name="internalMax" type="number" defaultValue={e?.internalMax ?? (program?.level === "DIPLOMA" ? 20 : 40)} className="input" /></Field>
              <Field label="External max (SEE)" name="externalMax"><input id="externalMax" name="externalMax" type="number" defaultValue={e?.externalMax ?? (program?.level === "DIPLOMA" ? 80 : 60)} className="input" /></Field>
            </div>
            <div className="flex gap-2">
              <SubmitButton>{e ? "Save subject" : "Add subject"}</SubmitButton>
              {e && <Link href={`/academics/subjects?program=${programId}`} className="px-3 py-2 text-sm text-muted">Cancel</Link>}
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
