import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentScope } from "@/lib/scope";
import { batchLabel, fmtDate, titleCase } from "@/lib/format";
import { applyLeave, reviewLeave } from "@/actions/daily";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Avatar } from "@/components/avatar";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Leave & on-duty" };
const TONE: Record<string, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const TYPE: Record<string, string> = { LEAVE: "Leave", MEDICAL: "Medical leave", ON_DUTY: "On duty (OD)" };
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5) + 1;

export default async function LeavePage(props: PageProps<"/leave">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "STUDENT"]);
  const sp = await props.searchParams;

  if (user.role === "STUDENT") {
    const mine = await db.leaveRequest.findMany({ where: { studentId: user.studentId! }, include: { reviewedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
    return (
      <>
        <PageHeader title="Leave & on-duty" subtitle="Approved on-duty days count as present. Medical leave supports a condonation request." />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="New request">
            <ActionForm action={applyLeave} className="space-y-3" resetOnSuccess>
              <Field label="Type" name="type"><select id="type" name="type" className="input">{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" name="fromDate"><input id="fromDate" type="date" name="fromDate" className="input" required /></Field>
                <Field label="To" name="toDate"><input id="toDate" type="date" name="toDate" className="input" required /></Field>
              </div>
              <Field label="Reason" name="reason"><textarea id="reason" name="reason" rows={3} className="input" placeholder="e.g. Representing the college at SIH hackathon" required /></Field>
              <SubmitButton>Submit request</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="My requests" className="lg:col-span-2">
            {mine.length === 0 ? <EmptyState title="No requests yet" /> : (
              <Table>
                <thead><tr><Th>Type</Th><Th>Dates</Th><Th>Reason</Th><Th>Status</Th></tr></thead>
                <tbody>{mine.map((r) => (
                  <tr key={r.id}>
                    <Td>{TYPE[r.type]}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(r.fromDate)} – {fmtDate(r.toDate)} <span className="text-xs text-muted">({days(r.fromDate, r.toDate)}d)</span></Td>
                    <Td className="max-w-xs text-sm">{r.reason}{r.reviewNote && <p className="text-xs text-muted">Note: {r.reviewNote}</p>}</Td>
                    <Td><Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge>{r.reviewedBy && <p className="mt-0.5 text-[11px] text-muted">by {r.reviewedBy.name}</p>}</Td>
                  </tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
        </div>
      </>
    );
  }

  const status = typeof sp.status === "string" && sp.status ? sp.status : "PENDING";
  const where = { student: studentScope(user) };
  const [rows, counts] = await Promise.all([
    db.leaveRequest.findMany({ where: { ...where, ...(status !== "ALL" && { status: status as "PENDING" }) }, include: { student: { include: { user: { select: { id: true, name: true, photoType: true } }, batch: { include: { program: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.leaveRequest.groupBy({ by: ["status"], where, _count: true }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader title="Leave & on-duty requests" subtitle="Approving an on-duty request converts the student's absences on those dates to On-duty." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={c("PENDING")} tone="warning" />
        <StatCard label="Approved" value={c("APPROVED")} tone="success" />
        <StatCard label="Rejected" value={c("REJECTED")} tone="danger" />
      </div>
      <Filters>
        <select name="status" aria-label="Status" defaultValue={status} className="input w-auto">{["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-leave" />
      <Card>
        {rows.length === 0 ? <EmptyState title="Nothing to review" /> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>Type</Th><Th>Dates</Th><Th>Reason</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <Td><div className="flex items-center gap-3"><Avatar name={r.student.user.name} userId={r.student.user.id} hasPhoto={!!r.student.user.photoType} size={32} /><div><p className="font-medium">{r.student.user.name}</p><p className="text-xs text-muted">{r.student.rollNo} · {batchLabel(r.student.batch)}</p></div></div></Td>
                <Td><Badge tone={r.type === "ON_DUTY" ? "info" : "neutral"}>{TYPE[r.type]}</Badge></Td>
                <Td className="whitespace-nowrap">{fmtDate(r.fromDate)} – {fmtDate(r.toDate)}<p className="text-xs text-muted">{days(r.fromDate, r.toDate)} day(s)</p></Td>
                <Td className="max-w-xs text-sm">{r.reason}</Td>
                <Td><Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge></Td>
                <Td className="whitespace-nowrap">{r.status === "PENDING" && (
                  <span className="flex gap-1">
                    <ActionButton action={reviewLeave} fields={{ id: r.id, decision: "APPROVED" }} variant="primary">Approve</ActionButton>
                    <ActionButton action={reviewLeave} fields={{ id: r.id, decision: "REJECTED" }} variant="ghost" confirm="Reject this request?">Reject</ActionButton>
                  </span>
                )}</Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
