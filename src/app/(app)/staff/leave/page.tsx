import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEAVE_LABEL, LEAVE_QUOTA, leaveUsed, managedStaff, workingDays } from "@/lib/staff";
import { fmtDate, titleCase } from "@/lib/format";
import { applyStaffLeave, reviewStaffLeave } from "@/actions/staff";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Avatar } from "@/components/avatar";
import { Badge, Field, Progress, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, Tabs, Th, Table } from "@/components/ui-server";
import { staffTabs } from "../tabs";

export const metadata = { title: "Staff leave" };
const TONE: Record<string, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export default async function StaffLeavePage() {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const manager = user.role === "ADMIN" || user.role === "HOD";
  const canApply = user.role !== "ADMIN";
  const year = new Date().getFullYear();
  const [mine, used, team] = await Promise.all([
    db.staffLeave.findMany({ where: { userId: user.id }, include: { reviewedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    leaveUsed(user.id, year),
    manager ? db.staffLeave.findMany({ where: { user: managedStaff(user) }, include: { user: { select: { id: true, name: true, photoType: true, role: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 60 }) : [],
  ]);
  return (
    <>
      <PageHeader title="Staff" subtitle="Faculty leave is approved by the HOD; HOD and office-staff leave by the principal." />
      <Tabs active="/staff/leave" items={staffTabs(user.role)} />
      {manager && (
        <Card title={`Requests to review · ${team.filter((t) => t.status === "PENDING").length} pending`} className="mb-6">
          {team.length === 0 ? <EmptyState title="No requests" /> : (
            <Table>
              <thead><tr><Th>Staff member</Th><Th>Type</Th><Th>Dates</Th><Th>Reason</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>{team.map((r) => (
                <tr key={r.id}>
                  <Td><div className="flex items-center gap-3"><Avatar name={r.user.name} userId={r.user.id} hasPhoto={!!r.user.photoType} size={30} /><span className="font-medium">{r.user.name}</span></div></Td>
                  <Td>{LEAVE_LABEL[r.type]}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.fromDate)} – {fmtDate(r.toDate)}<p className="text-xs text-muted">{workingDays(r.fromDate, r.toDate)} working day(s)</p></Td>
                  <Td className="max-w-xs text-sm">{r.reason}</Td>
                  <Td><Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge></Td>
                  <Td className="whitespace-nowrap">{r.status === "PENDING" && <span className="flex gap-1"><ActionButton action={reviewStaffLeave} fields={{ id: r.id, decision: "APPROVED" }} variant="secondary">Approve</ActionButton><ActionButton action={reviewStaffLeave} fields={{ id: r.id, decision: "REJECTED" }} variant="ghost" confirm="Reject this leave request?">Reject</ActionButton></span>}</Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
      )}
      {canApply && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <Card title={`Leave balance ${year}`}>
              <ul className="space-y-3">{(["CASUAL", "SICK", "EARNED"] as const).map((k) => (
                <li key={k}><div className="mb-1 flex justify-between text-sm"><span>{LEAVE_LABEL[k]}</span><span className="tabular-nums"><b>{LEAVE_QUOTA[k] - used[k]}</b> of {LEAVE_QUOTA[k]} left</span></div><Progress value={(used[k] / LEAVE_QUOTA[k]) * 100} tone={used[k] >= LEAVE_QUOTA[k] ? "danger" : "brand"} /></li>
              ))}</ul>
              <p className="mt-3 text-xs text-muted">On-duty days used: {used.ON_DUTY} (no limit).</p>
            </Card>
            <Card title="Apply for leave">
              <ActionForm action={applyStaffLeave} className="space-y-3" resetOnSuccess>
                <Field label="Type" name="type"><select id="type" name="type" className="input">{Object.entries(LEAVE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From" name="fromDate"><input id="fromDate" type="date" name="fromDate" className="input" required /></Field>
                  <Field label="To" name="toDate"><input id="toDate" type="date" name="toDate" className="input" required /></Field>
                </div>
                <Field label="Reason" name="reason"><textarea id="reason" name="reason" rows={3} className="input" required /></Field>
                <SubmitButton>Submit</SubmitButton>
              </ActionForm>
            </Card>
          </div>
          <Card title="My requests" className="lg:col-span-2">
            {mine.length === 0 ? <EmptyState title="No leave requests yet" /> : (
              <Table>
                <thead><tr><Th>Type</Th><Th>Dates</Th><Th>Reason</Th><Th>Status</Th></tr></thead>
                <tbody>{mine.map((r) => (
                  <tr key={r.id}><Td>{LEAVE_LABEL[r.type]}</Td><Td className="whitespace-nowrap">{fmtDate(r.fromDate)} – {fmtDate(r.toDate)} <span className="text-xs text-muted">({workingDays(r.fromDate, r.toDate)}d)</span></Td><Td className="max-w-xs text-sm">{r.reason}</Td><Td><Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge>{r.reviewedBy && <p className="mt-0.5 text-[11px] text-muted">by {r.reviewedBy.name}</p>}</Td></tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
