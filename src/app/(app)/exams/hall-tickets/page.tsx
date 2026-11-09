import { reviewCondonation } from "@/actions/condonation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";
import { Badge,buttonClass,Td } from "@/components/ui";
import { Card,EmptyState,PageHeader,StatCard,Table,Th } from "@/components/ui-server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hallTicketStatus } from "@/lib/eligibility";
import { batchOptions } from "@/lib/options";
import { getRules } from "@/lib/rules";
import { currentTerm, studentScope } from "@/lib/scope";
import { CheckCircle2,Download,XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Hall tickets" };

export default async function HallTicketsPage(props: PageProps<"/exams/hall-tickets">) {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT"]);
  if (user.role === "STUDENT") redirect(`/exams/hall-tickets/${user.studentId}`);
  const sp = await props.searchParams;
  const batches = await batchOptions(user.role === "HOD" ? user : undefined);
  const batchId = (typeof sp.batch === "string" && sp.batch) || batches[0]?.id;
  const term = await currentTerm();
  const rules = await getRules();
  const students = await db.student.findMany({ where: { AND: [{ batchId: batchId ?? "-", status: "ACTIVE" }, studentScope(user)] }, include: { user: { select: { name: true } } }, orderBy: { rollNo: "asc" } });
  const status = await hallTicketStatus(students.map((s) => s.id), term?.id);
  const decisions = term ? await db.attendanceCondonation.findMany({ where: { termId: term.id, studentId: { in: students.map(s => s.id) } }, include: { reviewedBy: { select: { name: true } } } }) : [];
  const eligible = students.filter((s) => status.get(s.id)?.eligible).length;
  return (
    <>
      <PageHeader title="Hall tickets" subtitle={`Issued only when attendance is ${rules.attendanceRequired}% or more (or condoned).`} actions={eligible > 0 && batchId && <a href={`/exams/hall-tickets/batch/${batchId}/pdf`} className={buttonClass("secondary")}><Download className="size-4" /> All {eligible} hall tickets (PDF)</a>} />
      <Filters><select name="batch" aria-label="Batch" defaultValue={batchId} className="input w-auto">{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Filters>
      <SavedFilters storageKey="edupilot-filters-exams-hall-tickets" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={students.length} />
        <StatCard label="Eligible" value={eligible} tone="success" />
        <StatCard label="Withheld" value={students.length - eligible} tone="danger" />
      </div>
      <Card>
        {students.length === 0 ? <EmptyState title="No students in this batch" /> : (
          <Table>
            <thead><tr><Th>Roll no</Th><Th>Name</Th><Th className="text-right">Attendance</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{students.map((s) => {
              const st = status.get(s.id)!;
              return (
                <tr key={s.id}>
                  <Td className="font-mono text-xs">{s.rollNo}</Td>
                  <Td><Link href={`/students/${s.id}`} className="hover:text-brand">{s.user.name}</Link></Td>
                  <Td className="text-right tabular-nums">{st.attendance}%{st.condoned && <Badge tone="info">Condoned</Badge>}</Td>
                  <Td>{st.eligible ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="size-4" /> Eligible</span> : <span className="flex items-start gap-1 text-xs text-danger"><XCircle className="mt-0.5 size-4 shrink-0" />{st.reasons.join("; ")}</span>}</Td>
                  <Td>
                    {term && st.attendance >= rules.attendanceCondonable && st.attendance < rules.attendanceRequired && <details className="mb-2 min-w-56 text-sm"><summary className="cursor-pointer text-brand">Review condonation</summary>
                      {decisions.filter(d => d.studentId === s.id).map(d => <p key={d.id} className="my-2 text-xs text-muted">{d.status} · {d.reviewedBy?.name ?? "Administration"}: {d.reason}</p>)}
                      <ActionForm action={reviewCondonation} className="mt-3 space-y-2">
                        <input type="hidden" name="studentId" value={s.id} />
                        <select className="input" name="decision" aria-label={`Condonation decision for ${s.rollNo}`}><option value="APPROVED">Approve hall ticket release</option><option value="REJECTED">Reject condonation</option><option value="REVOKED">Revoke prior approval</option></select>
                        <textarea className="input" name="reason" aria-label={`Condonation reason for ${s.rollNo}`} placeholder="Reason / Administration acknowledgement" minLength={5} maxLength={1000} required />
                        <SubmitButton variant="secondary">Save decision</SubmitButton>
                      </ActionForm>
                    </details>}
                    {st.eligible && <Link className="text-sm text-brand" href={`/exams/hall-tickets/${s.id}`}>Hall ticket →</Link>}</Td>
                </tr>
              );
            })}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
