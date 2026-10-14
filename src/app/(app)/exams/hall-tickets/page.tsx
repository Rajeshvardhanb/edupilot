import { getRules } from "@/lib/rules";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { batchOptions } from "@/lib/options";
import { hallTicketStatus } from "@/lib/eligibility";
import { inr } from "@/lib/format";
import { Badge, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Hall tickets" };

export default async function HallTicketsPage(props: PageProps<"/exams/hall-tickets">) {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT"]);
  if (user.role === "STUDENT") redirect(`/exams/hall-tickets/${user.studentId}`);
  const sp = await props.searchParams;
  const batches = await batchOptions(user.role === "HOD" ? user : undefined);
  const batchId = (typeof sp.batch === "string" && sp.batch) || batches[0]?.id;
  const term = await currentTerm();
  const rules = await getRules();
  const students = await db.student.findMany({ where: { batchId, status: "ACTIVE" }, include: { user: { select: { name: true } } }, orderBy: { rollNo: "asc" } });
  const status = await hallTicketStatus(students.map((s) => s.id), term?.id);
  const eligible = students.filter((s) => status.get(s.id)?.eligible).length;
  return (
    <>
      <PageHeader title="Hall tickets" subtitle={`Issued only when attendance is ${rules.attendanceRequired}% or more (or condoned) and no fee is overdue.`} actions={eligible > 0 && batchId && <a href={`/exams/hall-tickets/batch/${batchId}/pdf`} className={buttonClass("secondary")}><Download className="size-4" /> All {eligible} hall tickets (PDF)</a>} />
      <Filters><select name="batch" aria-label="Batch" defaultValue={batchId} className="input w-auto">{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Filters>
      <SavedFilters storageKey="edupilot-filters-exams-hall-tickets" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={students.length} />
        <StatCard label="Eligible" value={eligible} tone="success" />
        <StatCard label="Withheld" value={students.length - eligible} tone="danger" />
      </div>
      <Card>
        {students.length === 0 ? <EmptyState title="No students in this batch" /> : (
          <Table>
            <thead><tr><Th>Roll no</Th><Th>Name</Th><Th className="text-right">Attendance</Th><Th className="text-right">Overdue fee</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{students.map((s) => {
              const st = status.get(s.id)!;
              return (
                <tr key={s.id}>
                  <Td className="font-mono text-xs">{s.rollNo}</Td>
                  <Td><Link href={`/students/${s.id}`} className="hover:text-brand">{s.user.name}</Link></Td>
                  <Td className="text-right tabular-nums">{st.attendance}%{st.condoned && <Badge tone="info">Condoned</Badge>}</Td>
                  <Td className="text-right tabular-nums">{st.feeDue ? inr(st.feeDue) : "—"}</Td>
                  <Td>{st.eligible ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="size-4" /> Eligible</span> : <span className="flex items-start gap-1 text-xs text-danger"><XCircle className="mt-0.5 size-4 shrink-0" />{st.reasons.join("; ")}</span>}</Td>
                  <Td>{st.eligible && <Link className="text-sm text-brand" href={`/exams/hall-tickets/${s.id}`}>Hall ticket →</Link>}</Td>
                </tr>
              );
            })}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
