import { createTeacher } from "@/actions/faculty";
import { ActionForm,SubmitButton } from "@/components/forms";
import { Field,Td } from "@/components/ui";
import { Card,PageHeader,Table,Th } from "@/components/ui-server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

import { AcademicsTabs } from "../tabs";

export const metadata = { title: "Teacher accounts" };
export default async function TeachersPage() {
  const me = await requireUser(["ADMIN", "HOD"]);
  const department = me.role === "HOD" ? { id: me.departmentId ?? "-" } : {};
  const [departments, teachers] = await Promise.all([
    db.department.findMany({ where: department, orderBy: { name: "asc" } }),
    db.faculty.findMany({ where: { department }, select: { id: true, employeeId: true, department: { select: { code: true } }, user: { select: { name: true, email: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);
  return <>
    <PageHeader title="Teacher accounts" subtitle="Basic accounts for timetable, marks, attendance, and exam duties." />
    <AcademicsTabs active="/academics/teachers" />
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Add teacher"><ActionForm action={createTeacher} className="space-y-3" resetOnSuccess>
        <Field label="Name" name="name"><input name="name" className="input" required /></Field>
        <Field label="Email" name="email"><input name="email" type="email" className="input" required /></Field>
        <Field label="Employee ID" name="employeeId"><input name="employeeId" className="input" required /></Field>
        <Field label="Department" name="departmentId"><select name="departmentId" className="input" required>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <SubmitButton>Create account</SubmitButton>
      </ActionForm></Card>
      <Card title="Teaching accounts" className="lg:col-span-2"><Table><thead><tr><Th>Name</Th><Th>Employee ID</Th><Th>Department</Th><Th>Email</Th></tr></thead><tbody>{teachers.map((t) => <tr key={t.id}><Td>{t.user.name}</Td><Td>{t.employeeId}</Td><Td>{t.department.code}</Td><Td>{t.user.email}</Td></tr>)}</tbody></Table></Card>
    </div>
  </>;
}
