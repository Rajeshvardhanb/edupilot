import Link from "next/link";
import { isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchLabel, fmtDate, titleCase } from "@/lib/format";
import { requestCertificate, reviewCertificate, issueBatchCertificates } from "@/actions/services";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { batchOptions } from "@/lib/options";

export const metadata = { title: "Certificates" };
const TONE: Record<string, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const LABEL: Record<string, string> = { BONAFIDE: "Bonafide certificate", STUDY: "Study certificate", CONDUCT: "Conduct certificate", TRANSFER: "Transfer certificate (TC)" };

export default async function CertificatesPage() {
  const user = await requireUser(["ADMIN", "OFFICE", "STUDENT"]);
  const batches = user.role === "STUDENT" ? [] : await batchOptions();
  const rows = await db.certificateRequest.findMany({
    where: user.role === "STUDENT" ? { studentId: user.studentId! } : {},
    include: { student: { include: { user: { select: { name: true } }, batch: { include: { program: true } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200,
  });
  return (
    <>
      <PageHeader title="Certificates" subtitle={user.role === "STUDENT" ? "Request a certificate; print it here once the office approves." : "Review requests. Approved certificates get a serial number and can be printed."} />
      <div className="grid gap-6 lg:grid-cols-3">
        {user.role === "STUDENT" && (
          <Card title="New request">
            <ActionForm action={requestCertificate} className="space-y-3" resetOnSuccess>
              <Field label="Certificate" name="type"><select id="type" name="type" className="input">{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Purpose" name="purpose"><input id="purpose" name="purpose" className="input" placeholder="Bank loan / passport / scholarship" required /></Field>
              <SubmitButton>Request</SubmitButton>
            </ActionForm>
          </Card>
        )}
        {user.role !== "STUDENT" && (
          <Card title="Issue to a whole batch" className="lg:col-span-3">
            <ActionForm action={issueBatchCertificates} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_2fr_auto]">
              <Field label="Batch" name="batchId"><select name="batchId" className="input">{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Field>
              <Field label="Certificate" name="type"><select name="type" className="input"><option value="BONAFIDE">Bonafide</option><option value="STUDY">Study</option></select></Field>
              <Field label="Purpose (printed on each certificate)" name="purpose"><input name="purpose" className="input" placeholder="State scholarship renewal 2026-27" required /></Field>
              <div className="flex items-end"><SubmitButton variant="secondary" confirm="Issue this certificate to every active student of the batch? Each gets its own serial number.">Issue and print</SubmitButton></div>
            </ActionForm>
            <p className="mt-2 text-xs text-muted">Students who already hold this certificate for the same purpose are not issued another; they are still included in the print run.</p>
          </Card>
        )}
        <Card className={user.role === "STUDENT" ? "lg:col-span-2" : "lg:col-span-3"} title="Requests">
          {rows.length === 0 ? <EmptyState title="No certificate requests" /> : (
            <Table>
              <thead><tr>{isOffice(user) && <Th>Student</Th>}<Th>Certificate</Th><Th>Purpose</Th><Th>Requested</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  {isOffice(user) && <Td><Link href={`/students/${r.studentId}`} className="font-medium hover:text-brand">{r.student.user.name}</Link><p className="text-xs text-muted">{r.student.rollNo} · {batchLabel(r.student.batch)}</p></Td>}
                  <Td>{LABEL[r.type]}{r.serialNo && <p className="font-mono text-xs text-muted">{r.serialNo}</p>}</Td>
                  <Td className="text-sm">{r.purpose}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.createdAt)}</Td>
                  <Td><Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge></Td>
                  <Td className="whitespace-nowrap">
                    {r.status === "APPROVED" && <Link href={`/certificates/${r.id}`} className="text-sm text-brand">View / print →</Link>}
                    {r.status === "PENDING" && isOffice(user) && (
                      <span className="flex gap-1">
                        <ActionButton action={reviewCertificate} fields={{ id: r.id, decision: "APPROVED" }} variant="primary">Issue</ActionButton>
                        <ActionButton action={reviewCertificate} fields={{ id: r.id, decision: "REJECTED" }} variant="ghost" confirm="Reject this request?">Reject</ActionButton>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
