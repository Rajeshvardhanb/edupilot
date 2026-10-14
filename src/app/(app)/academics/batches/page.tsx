import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { programScope } from "@/lib/scope";
import { createBatch, deleteRecord } from "@/actions/academics";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, LinkButton, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";
import { yearOfSemester } from "@/lib/format";
import { AcademicsTabs } from "../tabs";

export const metadata = { title: "Batches" };

export default async function BatchesPage(props: PageProps<"/academics/batches">) {
  const done = (await props.searchParams).done;
  const user = await requireUser(["ADMIN", "HOD"]);
  const [batches, programs] = await Promise.all([
    db.batch.findMany({
      where: { program: programScope(user) },
      include: { program: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      orderBy: [{ program: { code: "asc" } }, { admissionYear: "desc" }, { section: "asc" }],
    }),
    db.program.findMany({ where: programScope(user), orderBy: { code: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Academics" subtitle="Admission batches and sections; promote batches at the end of each semester" />
      {typeof done === "string" && <p role="status" className="mb-4 rounded-xl bg-success-soft px-4 py-2.5 text-sm text-success">Done: {done}.</p>}
      <AcademicsTabs active="/academics/batches" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Batches">
          <Table>
            <thead><tr><Th>Batch</Th><Th>Programme</Th><Th>Year / semester</Th><Th className="text-right">Active students</Th><Th /></tr></thead>
            <tbody>
              {batches.map((b) => {
                const final = b.currentSemester >= b.program.totalSemesters;
                return (
                  <tr key={b.id}>
                    <Td><Link className="font-medium hover:text-brand" href={`/students?batch=${b.id}`}>{b.program.code} {b.admissionYear}-{b.section}</Link></Td>
                    <Td className="text-xs text-muted">{b.program.name}</Td>
                    <Td>Year {yearOfSemester(b.currentSemester)} · Sem {b.currentSemester}/{b.program.totalSemesters} {final && <Badge tone="warning">Final</Badge>}</Td>
                    <Td className="text-right">{b._count.students}</Td>
                    <Td className="text-right whitespace-nowrap">{user.role === "ADMIN" && (
                      <span className="inline-flex items-center gap-2">
                        <LinkButton variant="secondary" size="sm" href={`/academics/batches/${b.id}/promote`}>{final ? "Graduate…" : "Promote…"}</LinkButton>
                        <ActionButton action={deleteRecord} fields={{ model: "batch", id: b.id }} variant="ghost" confirm="Delete this batch?">Delete</ActionButton>
                      </span>
                    )}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        <Card title="New batch / section">
          <ActionForm action={createBatch} className="space-y-4" resetOnSuccess>
            <Field label="Programme" name="programId">
              <select id="programId" name="programId" className="input" required><option value="">Select</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Admission year" name="admissionYear"><input id="admissionYear" name="admissionYear" type="number" defaultValue={new Date().getFullYear()} className="input" /></Field>
              <Field label="Section" name="section"><input id="section" name="section" defaultValue="A" className="input uppercase" /></Field>
              <Field label="Semester" name="currentSemester"><input id="currentSemester" name="currentSemester" type="number" min={1} defaultValue={1} className="input" /></Field>
            </div>
            <SubmitButton>Create batch</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
