import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";
import { batchLabel, isoDate } from "@/lib/format";
import { FacultyForm } from "../faculty-form";

export const metadata = { title: "Edit faculty" };

export default async function EditFacultyPage(props: PageProps<"/faculty/[id]">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const { id } = await props.params;
  const f = await db.faculty.findUnique({
    where: { id },
    include: { user: true, offerings: { include: { subject: true, term: true, batch: { include: { program: true } } }, orderBy: { term: { startDate: "desc" } } } },
  });
  if (!f || (user.role === "HOD" && f.departmentId !== user.departmentId)) notFound();
  const depts = await db.department.findMany({ where: user.role === "HOD" ? { id: user.departmentId ?? "-" } : {}, orderBy: { code: "asc" } });
  return (
    <>
      <PageHeader title={f.user.name} subtitle={`${f.employeeId} · ${f.designation}`} />
      <Card>
        <FacultyForm
          departments={depts.map((d) => ({ id: d.id, label: `${d.code} — ${d.name}` }))}
          defaults={{ id: f.id, name: f.user.name, email: f.user.email, phone: f.user.phone, employeeId: f.employeeId, departmentId: f.departmentId, designation: f.designation, qualification: f.qualification, specialization: f.specialization, joiningDate: isoDate(f.joiningDate) }}
        />
      </Card>
      <Card title="Teaching history" className="mt-6">
        <Table>
          <thead><tr><Th>Term</Th><Th>Subject</Th><Th>Batch</Th><Th>Results</Th></tr></thead>
          <tbody>
            {f.offerings.map((o) => (
              <tr key={o.id}>
                <Td className="whitespace-nowrap">{o.term.name}</Td>
                <Td>{o.subject.name} <span className="font-mono text-xs text-muted">{o.subject.code}</span></Td>
                <Td>{batchLabel(o.batch)}</Td>
                <Td><Badge tone={o.resultsPublished ? "success" : "neutral"}>{o.resultsPublished ? "Published" : "In progress"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
