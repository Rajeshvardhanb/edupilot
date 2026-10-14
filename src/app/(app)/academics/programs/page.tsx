import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { programScope } from "@/lib/scope";
import { saveProgram, deleteRecord } from "@/actions/academics";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";
import { AcademicsTabs } from "../tabs";

export const metadata = { title: "Programmes" };
const LEVEL = { DIPLOMA: "Diploma", UG: "UG (B.Tech / B.E.)", PG: "PG (M.Tech)" } as const;

export default async function ProgramsPage(props: PageProps<"/academics/programs">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const { edit } = await props.searchParams;
  const [programs, depts] = await Promise.all([
    db.program.findMany({ where: programScope(user), include: { department: true, _count: { select: { subjects: true, batches: true } }, batches: { include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } } }, orderBy: [{ level: "asc" }, { code: "asc" }] }),
    db.department.findMany({ orderBy: { code: "asc" } }),
  ]);
  const e = programs.find((p) => p.id === edit);
  return (
    <>
      <PageHeader title="Academics" subtitle="B.Tech, Diploma and M.Tech programmes offered" />
      <AcademicsTabs active="/academics/programs" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Programmes">
          <Table>
            <thead><tr><Th>Code</Th><Th>Programme</Th><Th>Level</Th><Th>Duration</Th><Th className="text-right">Intake</Th><Th className="text-right">Students</Th><Th className="text-right">Subjects</Th><Th /></tr></thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id}>
                  <Td className="font-mono text-xs">{p.code}</Td>
                  <Td><p className="font-medium">{p.name}</p><p className="text-xs text-muted">{p.department.name}</p></Td>
                  <Td><Badge tone={p.level === "DIPLOMA" ? "warning" : p.level === "PG" ? "info" : "brand"}>{LEVEL[p.level]}</Badge></Td>
                  <Td className="whitespace-nowrap">{p.durationYears} yrs · {p.totalSemesters} sem</Td>
                  <Td className="text-right">{p.intake}</Td>
                  <Td className="text-right">{p.batches.reduce((s, b) => s + b._count.students, 0)}</Td>
                  <Td className="text-right"><Link className="text-brand" href={`/academics/subjects?program=${p.id}`}>{p._count.subjects}</Link></Td>
                  <Td className="text-right whitespace-nowrap">{user.role === "ADMIN" && (
                    <span className="inline-flex items-center gap-2">
                      <Link href={`/academics/programs?edit=${p.id}`} className="text-xs text-brand">Edit</Link>
                      <ActionButton action={deleteRecord} fields={{ model: "program", id: p.id }} variant="ghost" confirm={`Delete ${p.code}?`}>Delete</ActionButton>
                    </span>
                  )}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        {user.role === "ADMIN" && (
          <Card title={e ? `Edit ${e.code}` : "Add programme"}>
            <ActionForm key={e?.id ?? "new"} action={saveProgram} className="space-y-4" resetOnSuccess={!e}>
              {e && <input type="hidden" name="id" value={e.id} />}
              <Field label="Code" name="code"><input id="code" name="code" defaultValue={e?.code} className="input uppercase" placeholder="BTCSE" required /></Field>
              <Field label="Name" name="name"><input id="name" name="name" defaultValue={e?.name} className="input" placeholder="B.Tech — Computer Science & Engineering" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Level" name="level">
                  <select id="level" name="level" defaultValue={e?.level ?? "UG"} className="input">{Object.entries(LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </Field>
                <Field label="Duration (years)" name="durationYears"><input id="durationYears" name="durationYears" type="number" min={1} max={6} defaultValue={e?.durationYears ?? 4} className="input" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Annual intake" name="intake"><input id="intake" name="intake" type="number" min={1} defaultValue={e?.intake ?? 60} className="input" /></Field>
                <Field label="Department" name="departmentId">
                  <select id="departmentId" name="departmentId" defaultValue={e?.departmentId ?? ""} className="input" required>
                    <option value="">Select</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                  </select>
                </Field>
              </div>
              <SubmitButton>{e ? "Save" : "Add programme"}</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
