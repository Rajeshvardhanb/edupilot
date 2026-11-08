import { requireUser } from "@/lib/auth";
import { batchOptions } from "@/lib/options";
import { createStudent } from "@/actions/students";
import { Card, PageHeader } from "@/components/ui-server";
import { isoDate } from "@/lib/format";
import { StudentForm } from "../student-form";

export const metadata = { title: "New admission" };

export default async function NewStudentPage() {
  const user = await requireUser(["ADMIN", "OFFICE"]);
  return (
    <>
      <PageHeader illustration="students" title="New admission" subtitle="Initial login password will be the roll number in lowercase." />
      <Card><StudentForm action={createStudent} batches={await batchOptions(user)} defaults={{ admissionDate: isoDate(new Date()) }} submitLabel="Admit student" /></Card>
    </>
  );
}
