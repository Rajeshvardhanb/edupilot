import { DoorOpen, LogIn, LogOut, UserCheck } from "lucide-react";
import { isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysAgo, fmtDate, fmtDateTime, isoDate } from "@/lib/format";
import { requestGatePass, signInVisitor, signOutVisitor, updateGatePass } from "@/actions/office";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Gate pass" };

const STATUS: Record<string, [string, Tone]> = { PENDING: ["Waiting", "warning"], APPROVED: ["Approved", "info"], REJECTED: ["Not approved", "danger"], OUT: ["Out of campus", "brand"], RETURNED: ["Returned", "success"] };
const time = (d: Date) => d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
/** Value for a datetime-local input, in India time. */
const local = (d: Date) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16);

export default async function GatePage() {
  const user = await requireUser(["ADMIN", "OFFICE", "STUDENT"]);
  return isOffice(user) ? <OfficeView /> : <StudentView studentId={user.studentId!} />;
}

async function StudentView({ studentId }: { studentId: string }) {
  const passes = await db.gatePass.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 20 });
  const live = passes.find((p) => ["PENDING", "APPROVED", "OUT"].includes(p.status));
  const soon = daysAgo(-1 / 24); // an hour from now
  return (
    <>
      <PageHeader title="Gate pass" subtitle="Ask for permission to leave the campus. Show the approved pass at the gate." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="My gate passes" className="lg:col-span-2">
          {passes.length === 0 ? <EmptyState title="No gate passes yet">Use the form to ask for one.</EmptyState> : (
            <Table>
              <thead><tr><Th>Reason</Th><Th>Leaving</Th><Th>Back by</Th><Th>Status</Th></tr></thead>
              <tbody>{passes.map((p) => (
                <tr key={p.id}><Td className="font-medium">{p.reason}</Td><Td className="whitespace-nowrap">{time(p.outAt)}</Td><Td className="whitespace-nowrap">{time(p.expectedBack)}</Td><Td><Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge></Td></tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        <Card title="New request">
          {live ? <p className="text-sm text-muted">You have a gate pass that is {STATUS[live.status][0].toLowerCase()}. You can ask for another once it is finished.</p> : (
            <ActionForm action={requestGatePass} className="space-y-3" resetOnSuccess toastSuccess>
              <Field label="Reason" name="reason"><input name="reason" className="input" placeholder="e.g. Going home for the weekend" minLength={5} required /></Field>
              <Field label="Leaving at" name="outAt"><input name="outAt" type="datetime-local" defaultValue={local(soon)} className="input" required /></Field>
              <Field label="Back by" name="expectedBack"><input name="expectedBack" type="datetime-local" className="input" required /></Field>
              <SubmitButton>Send request</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}

async function OfficeView() {
  const today = new Date(isoDate(new Date()));
  const [inside, todays, passes, lateCount] = await Promise.all([
    db.visitor.findMany({ where: { outAt: null }, orderBy: { inAt: "desc" } }),
    db.visitor.findMany({ where: { inAt: { gte: today }, outAt: { not: null } }, orderBy: { inAt: "desc" }, take: 30 }),
    db.gatePass.findMany({ where: { OR: [{ status: { in: ["PENDING", "APPROVED", "OUT"] } }, { createdAt: { gte: daysAgo(3) } }] }, include: { student: { select: { rollNo: true, user: { select: { name: true } }, hostel: { where: { vacatedOn: null }, select: { room: { select: { number: true, hostel: { select: { name: true } } } } } } } } }, orderBy: [{ status: "asc" }, { outAt: "asc" }], take: 80 }),
    db.gatePass.count({ where: { status: "OUT", expectedBack: { lt: new Date() } } }),
  ]);
  const of = (s: string) => passes.filter((p) => p.status === s);
  return (
    <>
      <PageHeader title="Gate and visitors" subtitle="Who is on campus as a visitor, and which students are out on a gate pass" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Visitors on campus" value={inside.length} icon={<UserCheck className="size-5" />} hint={`${todays.length} left today`} />
        <StatCard label="Gate passes to decide" value={of("PENDING").length} tone={of("PENDING").length ? "warning" : "success"} icon={<DoorOpen className="size-5" />} />
        <StatCard label="Students out" value={of("OUT").length} tone="info" icon={<LogOut className="size-5" />} />
        <StatCard label="Late to return" value={lateCount} tone={lateCount ? "danger" : "success"} icon={<LogIn className="size-5" />} hint="past the time they gave" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Gate passes">
            {passes.length === 0 ? <EmptyState title="No gate passes">Students ask for one from their Gate pass page.</EmptyState> : (
              <Table>
                <thead><tr><Th>Student</Th><Th>Reason</Th><Th>Out and back</Th><Th>Status</Th><Th /></tr></thead>
                <tbody>{passes.map((p) => { const room = p.student.hostel[0]?.room; const late = p.status === "OUT" && p.expectedBack < new Date(); return (
                  <tr key={p.id}>
                    <Td className="font-medium">{p.student.user.name}<p className="font-mono text-xs font-normal text-muted">{p.student.rollNo}{room && <span className="font-sans"> · {room.hostel.name} {room.number}</span>}</p></Td>
                    <Td className="max-w-56 text-sm">{p.reason}</Td>
                    <Td className="text-xs whitespace-nowrap">{time(p.outAt)}<span className={`block ${late ? "font-semibold text-danger" : "text-muted"}`}>back by {time(p.expectedBack)}{late && " · late"}</span></Td>
                    <Td><Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge></Td>
                    <Td className="text-right whitespace-nowrap">
                      <span className="inline-flex gap-1">
                        {p.status === "PENDING" && <><ActionButton action={updateGatePass} fields={{ id: p.id, to: "APPROVED" }} variant="primary">Approve</ActionButton><ActionButton action={updateGatePass} fields={{ id: p.id, to: "REJECTED" }} variant="ghost">Reject</ActionButton></>}
                        {p.status === "APPROVED" && <ActionButton action={updateGatePass} fields={{ id: p.id, to: "OUT" }}>Mark out</ActionButton>}
                        {p.status === "OUT" && <ActionButton action={updateGatePass} fields={{ id: p.id, to: "RETURNED" }} variant="primary">Mark returned</ActionButton>}
                      </span>
                    </Td>
                  </tr>
                ); })}</tbody>
              </Table>
            )}
          </Card>
          <Card title="Visitors on campus now">
            {inside.length === 0 ? <p className="text-sm text-muted">No visitor is signed in.</p> : (
              <Table>
                <thead><tr><Th>Visitor</Th><Th>Purpose</Th><Th>Meeting</Th><Th>In at</Th><Th /></tr></thead>
                <tbody>{inside.map((v) => (
                  <tr key={v.id}><Td className="font-medium">{v.name}<p className="text-xs font-normal text-muted">{v.phone}{v.idProof && ` · ${v.idProof}`}</p></Td><Td>{v.purpose}</Td><Td>{v.toMeet}</Td><Td className="whitespace-nowrap">{fmtDateTime(v.inAt)}</Td><Td className="text-right"><ActionButton action={signOutVisitor} fields={{ id: v.id }}>Sign out</ActionButton></Td></tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
          {todays.length > 0 && (
            <Card title={`Left today · ${fmtDate(today)}`}>
              <Table>
                <thead><tr><Th>Visitor</Th><Th>Purpose</Th><Th>Meeting</Th><Th>In</Th><Th>Out</Th></tr></thead>
                <tbody>{todays.map((v) => <tr key={v.id}><Td className="font-medium">{v.name}</Td><Td>{v.purpose}</Td><Td>{v.toMeet}</Td><Td className="whitespace-nowrap">{time(v.inAt)}</Td><Td className="whitespace-nowrap">{v.outAt && time(v.outAt)}</Td></tr>)}</tbody>
              </Table>
            </Card>
          )}
        </div>
        <Card title="Sign in a visitor" className="h-fit">
          <ActionForm action={signInVisitor} className="space-y-3" resetOnSuccess>
            <Field label="Name" name="name"><input name="name" className="input" required /></Field>
            <Field label="Phone" name="phone"><input name="phone" className="input" inputMode="tel" minLength={10} required /></Field>
            <Field label="Purpose" name="purpose"><input name="purpose" className="input" placeholder="Parent meeting, vendor, interview…" required /></Field>
            <Field label="Meeting whom" name="toMeet"><input name="toMeet" className="input" required /></Field>
            <Field label="ID shown (optional)" name="idProof"><input name="idProof" className="input" placeholder="Aadhaar ending 1234" /></Field>
            <SubmitButton>Sign in</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
