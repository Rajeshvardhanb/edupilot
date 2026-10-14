import Image from "next/image";
import { photo, type PhotoSlot } from "@/lib/images";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveDepartment, deleteRecord } from "@/actions/academics";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Field, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";
import { AcademicsTabs } from "./tabs";

export const metadata = { title: "Departments" };

const deptPhoto = (code: string) => (["CSE", "ECE", "EEE", "ME", "CE"].includes(code) ? photo(`dept-${code.toLowerCase()}` as PhotoSlot) : null);

export default async function DepartmentsPage(props: PageProps<"/academics">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const { edit } = await props.searchParams;
  const depts = await db.department.findMany({
    include: { hod: { include: { user: true } }, faculty: { include: { user: true } }, programs: { include: { batches: { include: { _count: { select: { students: true } } } } } } },
    orderBy: { code: "asc" },
  });
  const editing = depts.find((d) => d.id === edit);
  return (
    <>
      <PageHeader title="Academics" subtitle="Institution structure, curriculum and teaching allocation" />
      <AcademicsTabs active="/academics" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Departments">
          <Table>
            <thead><tr><Th>Code</Th><Th>Department</Th><Th>HOD</Th><Th className="text-right">Faculty</Th><Th className="text-right">Programmes</Th><Th className="text-right">Students</Th><Th /></tr></thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.id}>
                  <Td className="font-mono text-xs">{d.code}</Td>
                  <Td className="font-medium"><span className="flex items-center gap-3">{deptPhoto(d.code) && <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5"><Image src={deptPhoto(d.code)!} alt="" fill sizes="56px" className="object-cover" /></span>}{d.name}</span></Td>
                  <Td className="whitespace-nowrap">{d.hod?.user.name ?? <span className="text-muted">Not assigned</span>}</Td>
                  <Td className="text-right">{d.faculty.length}</Td>
                  <Td className="text-right">{d.programs.length}</Td>
                  <Td className="text-right">{d.programs.flatMap((p) => p.batches).reduce((s, b) => s + b._count.students, 0)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {user.role === "ADMIN" && (
                      <span className="inline-flex items-center gap-2">
                        <Link href={`/academics?edit=${d.id}`} className="text-xs text-brand">Edit</Link>
                        <ActionButton action={deleteRecord} fields={{ model: "department", id: d.id }} variant="ghost" confirm={`Delete ${d.name}?`}>Delete</ActionButton>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        {user.role === "ADMIN" && (
          <Card title={editing ? `Edit ${editing.code}` : "Add department"}>
            <ActionForm key={editing?.id ?? "new"} action={saveDepartment} className="space-y-4" resetOnSuccess={!editing}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Code" name="code"><input id="code" name="code" defaultValue={editing?.code} className="input uppercase" placeholder="CSE" required /></Field>
              <Field label="Name" name="name"><input id="name" name="name" defaultValue={editing?.name} className="input" placeholder="Computer Science & Engineering" required /></Field>
              {editing && (
                <Field label="Head of department" name="hodId">
                  <select id="hodId" name="hodId" defaultValue={editing.hodId ?? ""} className="input">
                    <option value="">— none —</option>
                    {editing.faculty.map((f) => <option key={f.id} value={f.id}>{f.user.name} · {f.designation}</option>)}
                  </select>
                </Field>
              )}
              <div className="flex gap-2">
                <SubmitButton>{editing ? "Save" : "Add department"}</SubmitButton>
                {editing && <Link href="/academics" className="px-3 py-2 text-sm text-muted">Cancel</Link>}
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
