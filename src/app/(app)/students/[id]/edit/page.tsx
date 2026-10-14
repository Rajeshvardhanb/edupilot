import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchOptions } from "@/lib/options";
import { updateStudent } from "@/actions/students";
import { Card, PageHeader } from "@/components/ui-server";
import { isoDate } from "@/lib/format";
import { StudentForm } from "../../student-form";

export const metadata = { title: "Edit student" };

export default async function EditStudentPage(props: PageProps<"/students/[id]/edit">) {
  const user = await requireUser(["ADMIN", "OFFICE"]);
  const { id } = await props.params;
  const s = await db.student.findUnique({ where: { id }, include: { user: true } });
  if (!s) notFound();
  return (
    <>
      <PageHeader title={`Edit · ${s.user.name}`} subtitle={s.rollNo} />
      <Card>
        <StudentForm
          action={updateStudent}
          batches={await batchOptions(user)}
          submitLabel="Save changes"
          defaults={{
            id: s.id, name: s.user.name, email: s.user.email, phone: s.user.phone, rollNo: s.rollNo, batchId: s.batchId,
            admissionType: s.admissionType, admissionDate: isoDate(s.admissionDate), dob: isoDate(s.dob), gender: s.gender,
            category: s.category, bloodGroup: s.bloodGroup, address: s.address, guardianName: s.guardianName,
            guardianPhone: s.guardianPhone, guardianEmail: s.guardianEmail, previousSchool: s.previousSchool, previousScore: s.previousScore, status: s.status,
          }}
        />
      </Card>
    </>
  );
}
