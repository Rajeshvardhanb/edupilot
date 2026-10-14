import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchLabel, titleCase } from "@/lib/format";
import { CertificateSheet } from "@/components/certificate-sheet";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PrintButton } from "@/components/print-button";
import { EmptyState } from "@/components/ui-server";

export const metadata = { title: "Certificates for a batch" };

/** All certificates of one kind issued to a batch for one purpose, one per printed page. */
export default async function BatchCertificates(props: PageProps<"/certificates/batch/[batchId]">) {
  await requireUser(["ADMIN", "OFFICE"]);
  const { batchId } = await props.params;
  const sp = await props.searchParams;
  const type = sp.type === "STUDY" ? "STUDY" : "BONAFIDE", purpose = typeof sp.purpose === "string" ? sp.purpose : "";
  const batch = await db.batch.findUnique({ where: { id: batchId }, include: { program: true } });
  if (!batch) notFound();
  const certs = await db.certificateRequest.findMany({ where: { type, purpose, status: "APPROVED", student: { batchId } }, select: { id: true }, orderBy: { student: { rollNo: "asc" } } });
  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <Breadcrumbs items={[{ label: "Certificates", href: "/certificates" }, { label: `${batchLabel(batch)} · ${titleCase(type)} · ${certs.length}` }]} />
        {certs.length > 0 && <PrintButton label={`Print all ${certs.length}`} />}
      </div>
      {certs.length === 0 ? <EmptyState title="No certificates were issued to this batch for that purpose" /> : (
        <div className="space-y-8 print:space-y-0">{certs.map((c) => <div key={c.id} className="break-after-page"><CertificateSheet id={c.id} /></div>)}</div>
      )}
    </>
  );
}
