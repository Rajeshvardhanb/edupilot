import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CertificateSheet } from "@/components/certificate-sheet";
import { PrintButton } from "@/components/print-button";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Certificate" };

export default async function CertificatePage(props: PageProps<"/certificates/[id]">) {
  const user = await requireUser(["ADMIN", "OFFICE", "STUDENT"]);
  const { id } = await props.params;
  const c = await db.certificateRequest.findFirst({
    where: { id, status: "APPROVED", ...(user.role === "STUDENT" && { studentId: user.studentId! }) },
    include: { student: { include: { user: { select: { name: true } }, batch: { include: { program: { include: { department: true } } } } } } },
  });
  if (!c) notFound();
  return (
    <>
      <div className="no-print mx-auto flex max-w-3xl items-center justify-between"><Breadcrumbs items={[{ label: "Certificates", href: "/certificates" }, { label: c.serialNo ?? "" }]} /><span className="flex gap-2"><a href={`/certificates/${c.id}/pdf`} className={buttonClass("secondary")}>Download PDF</a><PrintButton label="Print" /></span></div>
      <CertificateSheet id={c.id} />
    </>
  );
}
