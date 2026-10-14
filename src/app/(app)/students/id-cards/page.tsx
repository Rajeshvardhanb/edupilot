import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { programScope } from "@/lib/scope";
import { batchLabel } from "@/lib/format";
import { IdCard } from "@/components/id-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Filters } from "@/components/filters";
import { PrintButton } from "@/components/print-button";
import { EmptyState, PageHeader } from "@/components/ui-server";

export const metadata = { title: "ID cards" };

/** Every student's ID card for one batch on a single page, ready to print and cut. */
export default async function BatchIdCards(props: PageProps<"/students/id-cards">) {
  const user = await requireUser(["ADMIN", "HOD", "OFFICE"]);
  const sp = await props.searchParams;
  const batches = await db.batch.findMany({ where: { program: programScope(user), students: { some: { status: "ACTIVE" } } }, include: { program: true }, orderBy: [{ program: { code: "asc" } }, { admissionYear: "desc" }, { section: "asc" }] });
  const batchId = typeof sp.batch === "string" && batches.some((b) => b.id === sp.batch) ? sp.batch : batches[0]?.id;
  const students = batchId ? await db.student.findMany({ where: { batchId, status: "ACTIVE" }, select: { id: true }, orderBy: { rollNo: "asc" } }) : [];
  const batch = batches.find((b) => b.id === batchId);
  return (
    <>
      <Breadcrumbs items={[{ label: "Students", href: "/students" }, { label: "ID cards" }]} />
      <PageHeader title="ID cards" subtitle={batch ? `${batchLabel(batch)} · ${students.length} cards, front and back` : "Choose a batch"} actions={students.length > 0 && <PrintButton label="Print all" />} />
      <Filters><select name="batch" aria-label="Batch" defaultValue={batchId} className="input w-auto">{batches.map((b) => <option key={b.id} value={b.id}>{batchLabel(b)}</option>)}</select></Filters>
      {students.length === 0 ? <EmptyState title="No active students in this batch" /> : (
        <div className="space-y-6 print:space-y-4">{students.map((s) => <div key={s.id} className="break-inside-avoid"><IdCard studentId={s.id} /></div>)}</div>
      )}
    </>
  );
}
