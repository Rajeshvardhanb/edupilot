import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentScope } from "@/lib/scope";
import { IdCard } from "@/components/id-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/ui-server";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Student ID card" };

export default async function StudentIdCard(props: PageProps<"/students/[id]/id-card">) {
  const user = await requireUser(["ADMIN", "HOD", "OFFICE"]);
  const { id } = await props.params;
  const s = await db.student.findFirst({ where: { AND: [{ id }, studentScope(user)] }, include: { user: { select: { name: true } } } });
  if (!s) notFound();
  return (
    <>
      <Breadcrumbs items={[{ label: "Students", href: "/students" }, { label: s.user.name, href: `/students/${id}` }, { label: "ID card" }]} />
      <PageHeader title="Student ID card" actions={<PrintButton />} />
      <IdCard studentId={id} />
    </>
  );
}
