import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInstitution } from "@/lib/institution";
import { fmtDate } from "@/lib/format";
import { Letterhead, Sheet } from "@/components/letterhead";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Placement confirmation" };

export default async function OfferPage(props: PageProps<"/placements/offer/[id]">) {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT"]);
  const { id } = await props.params;
  const a = await db.placementApplication.findFirst({
    where: { id, status: "SELECTED", ...(user.role === "STUDENT" && { studentId: user.studentId! }) },
    include: { drive: { include: { company: true } }, student: { include: { user: { select: { name: true } }, batch: { include: { program: true } } } } },
  });
  if (!a) notFound();
  const inst = await getInstitution();
  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end"><PrintButton label="Print" /></div>
      <Sheet>
        <Letterhead title="Training & Placement Cell" serial={`TPC/${a.drive.driveDate.getUTCFullYear()}/${a.id.slice(-6).toUpperCase()}`} />
        <h1 className="mt-10 text-center text-lg font-bold tracking-widest uppercase underline underline-offset-8">Placement confirmation</h1>
        <p className="mt-8 text-[15px] leading-8">
          This is to confirm that <b>{a.student.user.name}</b> (Roll No. <b>{a.student.rollNo}</b>), a student of <b>{a.student.batch.program.name}</b>, has been
          selected by <b>{a.drive.company.name}</b> for the position of <b>{a.drive.role}</b> through the campus recruitment drive held on {fmtDate(a.drive.driveDate)},
          with an annual compensation of <b>₹{a.drive.ctcLpa} lakh</b>.
        </p>
        <p className="mt-4 text-[15px] leading-8">The formal offer letter will be issued by the company. This confirmation is provided by the institution for the student&apos;s records.</p>
        <div className="mt-24 flex justify-between text-sm"><span>Date: {fmtDate(new Date())}</span><span className="text-center">Training &amp; Placement Officer<br /><span className="text-xs text-muted">{inst.name}</span></span></div>
      </Sheet>
    </>
  );
}
