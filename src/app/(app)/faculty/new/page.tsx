import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui-server";
import { isoDate } from "@/lib/format";
import { FacultyForm } from "../faculty-form";

export const metadata = { title: "Add faculty" };

export default async function NewFacultyPage() {
  const user = await requireUser(["ADMIN", "HOD"]);
  const depts = await db.department.findMany({ where: user.role === "HOD" ? { id: user.departmentId ?? "-" } : {}, orderBy: { code: "asc" } });
  return (
    <>
      <PageHeader title="Add faculty" subtitle="Initial password is the employee ID in lowercase." />
      <Card><FacultyForm departments={depts.map((d) => ({ id: d.id, label: `${d.code} — ${d.name}` }))} defaults={{ departmentId: user.departmentId, joiningDate: isoDate(new Date()) }} /></Card>
    </>
  );
}
