import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { batchLabel, DAYS, fmtDate, titleCase } from "@/lib/format";
import { requestSwap, respondSwap } from "@/actions/staff";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, Tabs, Th, Table } from "@/components/ui-server";
import { STAFF_TABS } from "../tabs";

export const metadata = { title: "Class swaps" };
const TONE: Record<string, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

export default async function SwapsPage() {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const term = await currentTerm();
  const fid = user.facultyId ?? "-";
  const include = { slot: { include: { offering: { include: { subject: true, batch: { include: { program: true } } } } } }, from: { include: { user: { select: { name: true } } } }, to: { include: { user: { select: { name: true } } } } } as const;
  const [slots, colleagues, incoming, outgoing] = await Promise.all([
    db.timetableSlot.findMany({ where: { offering: { facultyId: fid, termId: term?.id } }, include: { offering: { include: { subject: true, batch: { include: { program: true } } } } }, orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }] }),
    db.faculty.findMany({ where: { id: { not: fid }, ...(user.departmentId && { departmentId: user.departmentId }), user: { isActive: true } }, include: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    db.swapRequest.findMany({ where: user.role === "ADMIN" ? {} : { toId: fid }, include, orderBy: [{ status: "asc" }, { date: "asc" }], take: 40 }),
    db.swapRequest.findMany({ where: { fromId: fid }, include, orderBy: { date: "desc" }, take: 30 }),
  ]);
  return (
    <>
      <PageHeader title="Staff" subtitle="Ask a colleague to take one of your periods. When they accept, the class appears on their Attendance page for that date." />
      <Tabs active="/staff/swaps" items={STAFF_TABS} />
      <div className="grid gap-6 lg:grid-cols-3">
        {user.facultyId && (
          <Card title="Request a swap" className="h-fit">
            {slots.length === 0 ? <p className="text-sm text-muted">You have no timetabled classes this term.</p> : (
              <ActionForm action={requestSwap} className="space-y-3" resetOnSuccess>
                <Field label="My class" name="slotId"><select id="slotId" name="slotId" className="input" required>{slots.map((s) => <option key={s.id} value={s.id}>{DAYS[s.dayOfWeek]} P{s.period} · {s.offering.subject.code} · {batchLabel(s.offering.batch)}</option>)}</select></Field>
                <Field label="Date (must fall on that weekday)" name="date"><input id="date" type="date" name="date" className="input" required /></Field>
                <Field label="Colleague" name="toId"><select id="toId" name="toId" className="input" required><option value="">Select</option>{colleagues.map((c) => <option key={c.id} value={c.id}>{c.user.name}</option>)}</select></Field>
                <Field label="Reason" name="reason"><input id="reason" name="reason" className="input" placeholder="Attending a workshop" /></Field>
                <SubmitButton>Send request</SubmitButton>
              </ActionForm>
            )}
          </Card>
        )}
        <div className={`space-y-6 ${user.facultyId ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <Card title={user.role === "ADMIN" ? "All swap requests" : "Requests for me"}>
            {incoming.length === 0 ? <EmptyState title="No requests" /> : (
              <Table>
                <thead><tr><Th>Date</Th><Th>Class</Th><Th>From</Th>{user.role === "ADMIN" && <Th>To</Th>}<Th>Status</Th><Th /></tr></thead>
                <tbody>{incoming.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{fmtDate(r.date)} · P{r.slot.period}</Td>
                    <Td>{r.slot.offering.subject.name}<p className="text-xs text-muted">{batchLabel(r.slot.offering.batch)}{r.reason && ` · ${r.reason}`}</p></Td>
                    <Td>{r.from.user.name}</Td>{user.role === "ADMIN" && <Td>{r.to.user.name}</Td>}
                    <Td><Badge tone={TONE[r.status]}>{r.status === "APPROVED" ? "Accepted" : titleCase(r.status)}</Badge></Td>
                    <Td className="whitespace-nowrap">{r.status === "PENDING" && r.toId === fid && <span className="flex gap-1"><ActionButton action={respondSwap} fields={{ id: r.id, decision: "APPROVED" }} variant="primary">Accept</ActionButton><ActionButton action={respondSwap} fields={{ id: r.id, decision: "REJECTED" }} variant="ghost">Decline</ActionButton></span>}</Td>
                  </tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
          {user.facultyId && (
            <Card title="My requests">
              {outgoing.length === 0 ? <p className="text-sm text-muted">You haven&apos;t asked for any swaps.</p> : (
                <ul className="space-y-2 text-sm">{outgoing.map((r) => <li key={r.id} className="flex items-center justify-between gap-3"><span>{fmtDate(r.date)} · P{r.slot.period} · {r.slot.offering.subject.code} → <b>{r.to.user.name}</b></span><Badge tone={TONE[r.status]}>{r.status === "APPROVED" ? "Accepted" : titleCase(r.status)}</Badge></li>)}</ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
