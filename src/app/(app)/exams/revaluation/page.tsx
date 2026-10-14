import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { offeringScope } from "@/lib/scope";
import { batchLabel, fmtDate } from "@/lib/format";
import { applyGrace, decideRevaluation, requestRevaluation } from "@/actions/revaluation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Revaluation" };

const STATUS: Record<string, [string, Tone]> = { PENDING: ["Waiting", "warning"], REVISED: ["Marks revised", "success"], NO_CHANGE: ["No change", "neutral"], REJECTED: ["Not taken up", "danger"] };

export default async function RevaluationPage() {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT"]);
  return user.role === "STUDENT" ? <StudentView studentId={user.studentId!} /> : <StaffView user={user} />;
}

/** A student sees their latest published results and can ask for an end-semester paper to be re-checked. */
async function StudentView({ studentId }: { studentId: string }) {
  const [results, requests] = await Promise.all([
    db.subjectResult.findMany({ where: { studentId, offering: { resultsPublished: true } }, include: { offering: { include: { subject: true, term: true } } }, orderBy: { offering: { term: { startDate: "desc" } } } }),
    db.revaluationRequest.findMany({ where: { studentId }, include: { offering: { include: { subject: true, term: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const asked = new Set(requests.map((r) => r.offeringId));
  // Only the most recent term with results is open for requests.
  const latest = results[0]?.offering.termId;
  const open = results.filter((r) => r.offering.termId === latest && r.offering.subject.externalMax > 0 && !asked.has(r.offeringId));
  return (
    <>
      <PageHeader title="Revaluation" subtitle="Ask for an end-semester paper to be re-checked. If the marks change, your grade, SGPA and CGPA are updated automatically." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="My requests" className="lg:col-span-2">
          {requests.length === 0 ? <EmptyState title="No requests yet">Choose a subject on the right if you think a paper was marked wrongly.</EmptyState> : (
            <Table>
              <thead><tr><Th>Subject</Th><Th>Requested</Th><Th className="text-right">End-sem marks</Th><Th>Grade</Th><Th>Status</Th></tr></thead>
              <tbody>{requests.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{r.offering.subject.name}<p className="text-xs font-normal text-muted">{r.offering.term.name}</p></Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.createdAt)}</Td>
                  <Td className="text-right tabular-nums">{r.oldExternal}{r.status === "REVISED" && <> → <b>{r.newExternal}</b></>}</Td>
                  <Td>{r.oldGrade}{r.status === "REVISED" && r.newGrade !== r.oldGrade && <> → <b>{r.newGrade}</b></>}</Td>
                  <Td><Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>{r.note && <p className="mt-1 max-w-56 text-xs text-muted">{r.note}</p>}</Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        <Card title="New request">
          {open.length === 0 ? <p className="text-sm text-muted">{results.length ? "You have already asked about every subject of your latest results, or none of them has an end-semester paper." : "Requests open once results are published."}</p> : (
            <ActionForm action={requestRevaluation} className="space-y-3" resetOnSuccess toastSuccess>
              <Field label="Subject" name="resultId"><select name="resultId" className="input">{open.map((r) => <option key={r.id} value={r.id}>{r.offering.subject.name} · {r.external}/{r.offering.subject.externalMax} · {r.grade}</option>)}</select></Field>
              <Field label="Why should it be re-checked?" name="reason"><textarea name="reason" rows={3} className="input" minLength={10} placeholder="e.g. Question 4 was answered in full but appears unmarked." required /></Field>
              <SubmitButton>Send request</SubmitButton>
              <p className="text-xs text-muted">One request per subject. Marks can go up or down.</p>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}

async function StaffView({ user }: { user: Awaited<ReturnType<typeof requireUser>> }) {
  const scope = { offering: offeringScope(user) };
  const [requests, published, graced] = await Promise.all([
    db.revaluationRequest.findMany({ where: scope, include: { student: { select: { id: true, rollNo: true, user: { select: { name: true } } } }, offering: { include: { subject: true, batch: { include: { program: true } }, term: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 }),
    user.role === "ADMIN" ? db.courseOffering.findMany({ where: { resultsPublished: true, results: { some: { passed: false } } }, include: { subject: true, batch: { include: { program: true } }, term: true, _count: { select: { results: { where: { passed: false } } } } }, orderBy: [{ term: { startDate: "desc" } }, { subject: { code: "asc" } }], take: 80 }) : [],
    db.subjectResult.count({ where: { ...scope, grace: { gt: 0 } } }),
  ]);
  const pending = requests.filter((r) => r.status === "PENDING");
  return (
    <>
      <PageHeader title="Revaluation" subtitle="Re-check requests from students, and grace marks for results already published" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Waiting for a decision" value={pending.length} tone={pending.length ? "warning" : "success"} />
        <StatCard label="Marks revised" value={requests.filter((r) => r.status === "REVISED").length} tone="success" />
        <StatCard label="No change" value={requests.filter((r) => r.status === "NO_CHANGE").length} tone="neutral" />
        <StatCard label="Passed with grace marks" value={graced} tone="info" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {requests.length === 0 && <Card><EmptyState title="No requests">Students ask for a re-check from their own Revaluation page after results are published.</EmptyState></Card>}
          {requests.map((r) => (
            <section key={r.id} className="tile p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.offering.subject.name} <span className="font-mono text-xs font-normal text-muted">{r.offering.subject.code}</span></p>
                  <p className="text-sm text-muted"><Link href={`/students/${r.student.id}`} className="text-brand">{r.student.user.name}</Link> · {r.student.rollNo} · {batchLabel(r.offering.batch)} · {r.offering.term.name}</p>
                </div>
                <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
              </div>
              <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{r.reason}</p>
              <p className="mt-3 text-sm">End-semester marks <b className="tabular-nums">{r.oldExternal}/{r.offering.subject.externalMax}</b> · total <b className="tabular-nums">{r.oldTotal}</b> · grade <b>{r.oldGrade}</b>{r.status === "REVISED" && <> → marks <b className="tabular-nums">{r.newExternal}</b>, grade <b>{r.newGrade}</b></>}</p>
              {r.note && r.status !== "PENDING" && <p className="mt-1 text-xs text-muted">Note: {r.note}</p>}
              {r.status === "PENDING" && (
                <ActionForm action={decideRevaluation} toastSuccess className="mt-4 grid gap-3 border-t border-line/70 pt-4 sm:grid-cols-[10rem_1fr_auto]">
                  <input type="hidden" name="id" value={r.id} />
                  <Field label={`Re-checked marks (of ${r.offering.subject.externalMax})`} name="newExternal"><input name="newExternal" type="number" min={0} max={r.offering.subject.externalMax} step="0.1" defaultValue={r.oldExternal} className="input" /></Field>
                  <Field label="Note to the student (optional)" name="note"><input name="note" className="input" /></Field>
                  <span className="flex items-end gap-2"><SubmitButton confirm="Record this decision? If the marks changed, the student's published result is updated.">Record</SubmitButton><button name="decision" value="reject" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft">Reject</button></span>
                </ActionForm>
              )}
            </section>
          ))}
        </div>
        {user.role === "ADMIN" && (
          <Card title="Grace marks" className="h-fit">
            <p className="mb-3 text-sm text-muted">Moderation for a published course: students who failed by a few marks get just enough end-semester marks to pass.</p>
            {published.length === 0 ? <p className="text-sm text-muted">No published course has a failed student.</p> : (
              <ActionForm action={applyGrace} className="space-y-3">
                <Field label="Course" name="offeringId"><select name="offeringId" className="input">{published.map((o) => <option key={o.id} value={o.id}>{o.subject.code} · {batchLabel(o.batch)} · {o.term.name.slice(0, 7)} · {o._count.results} failed</option>)}</select></Field>
                <Field label="Up to how many marks" name="max"><input name="max" type="number" min={1} max={10} defaultValue={3} className="input" required /></Field>
                <SubmitButton variant="secondary" confirm="Apply grace marks to this course? Students within the limit will pass, and their results are updated.">Apply grace marks</SubmitButton>
                <p className="text-xs text-muted">Each student gets the fewest marks needed, never more than the limit. The grace given is kept on the result.</p>
              </ActionForm>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
