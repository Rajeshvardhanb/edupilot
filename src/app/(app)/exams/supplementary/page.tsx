import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { backlogSubjects } from "@/lib/eligibility";
import { getInstitution } from "@/lib/institution";
import { batchLabel, fmtDate, inr } from "@/lib/format";
import { registerSupplementary } from "@/actions/exams";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Supplementary exams" };

export default async function SupplementaryPage() {
  const user = await requireUser(["ADMIN", "STUDENT"]);
  const term = await currentTerm();
  const inst = await getInstitution();

  if (user.role === "STUDENT") {
    const [backlogs, regs] = await Promise.all([
      backlogSubjects(user.studentId!),
      db.supplementaryRegistration.findMany({ where: { studentId: user.studentId!, termId: term?.id }, include: { subject: true } }),
    ]);
    const done = new Set(regs.map((r) => r.subjectId));
    const open = backlogs.filter((b) => !done.has(b.offering.subjectId));
    return (
      <>
        <PageHeader title="Supplementary exam registration" subtitle={`${term?.name} · ${inr(inst.supplementaryFee)} per subject`} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Your backlogs">
            {backlogs.length === 0 ? <EmptyState title="No backlogs — all clear!" /> : open.length === 0 ? <p className="text-sm text-muted">You have registered for all your backlog subjects.</p> : (
              <ActionForm action={registerSupplementary} className="space-y-3" toastSuccess>
                {open.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 hover:bg-surface-2">
                    <input type="checkbox" name="subjectId" value={b.offering.subjectId} defaultChecked className="size-4" />
                    <span className="flex-1"><span className="block text-sm font-medium">{b.offering.subject.name}</span><span className="text-xs text-muted">{b.offering.subject.code} · Semester {b.offering.subject.semester} · failed in {b.offering.term.name}</span></span>
                    <Badge tone="danger">{b.grade}</Badge>
                  </label>
                ))}
                <SubmitButton confirm="Register for the selected subjects? A fee invoice will be raised.">Register & raise invoice</SubmitButton>
              </ActionForm>
            )}
          </Card>
          <Card title="Registered this term">
            {regs.length === 0 ? <p className="text-sm text-muted">Nothing registered yet.</p> : (
              <ul className="space-y-2 text-sm">{regs.map((r) => <li key={r.id} className="flex justify-between"><span>{r.subject.name} <span className="font-mono text-xs text-muted">{r.subject.code}</span></span><span className="text-xs text-muted">{fmtDate(r.createdAt)}</span></li>)}</ul>
            )}
            <p className="mt-4 text-xs text-muted">Pay the supplementary fee invoice under <Link href="/fees" className="text-brand">Fees</Link> to confirm your registration.</p>
          </Card>
        </div>
      </>
    );
  }

  const regs = await db.supplementaryRegistration.findMany({
    where: { termId: term?.id },
    include: { subject: true, student: { include: { user: { select: { name: true } }, batch: { include: { program: true } } } } },
    orderBy: [{ subject: { code: "asc" } }, { student: { rollNo: "asc" } }],
  });
  const invoices = new Map((await db.feeInvoice.findMany({ where: { id: { in: regs.map((r) => r.invoiceId).filter((x): x is string => !!x) } }, include: { payments: { select: { amount: true } } } })).map((i) => [i.id, i]));
  const paid = (id: string | null) => { const i = id ? invoices.get(id) : null; return !!i && i.payments.reduce((s, p) => s + p.amount, 0) >= i.amount - i.concession; };
  const subjects = new Set(regs.map((r) => r.subjectId)).size;
  return (
    <>
      <PageHeader title="Supplementary registrations" subtitle={term?.name} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard label="Registrations" value={regs.length} />
        <StatCard label="Subjects" value={subjects} tone="info" />
        <StatCard label="Fee paid" value={regs.filter((r) => paid(r.invoiceId)).length} tone="success" hint={`${regs.filter((r) => !paid(r.invoiceId)).length} awaiting payment`} />
      </div>
      <Card>
        {regs.length === 0 ? <EmptyState title="No registrations yet" /> : (
          <Table>
            <thead><tr><Th>Subject</Th><Th>Student</Th><Th>Batch</Th><Th>Registered</Th><Th>Fee</Th></tr></thead>
            <tbody>{regs.map((r) => (
              <tr key={r.id}>
                <Td>{r.subject.name}<p className="font-mono text-xs text-muted">{r.subject.code}</p></Td>
                <Td><Link className="hover:text-brand" href={`/students/${r.studentId}`}>{r.student.user.name}</Link><p className="font-mono text-xs text-muted">{r.student.rollNo}</p></Td>
                <Td>{batchLabel(r.student.batch)}</Td>
                <Td>{fmtDate(r.createdAt)}</Td>
                <Td>{paid(r.invoiceId) ? <Badge tone="success">Paid</Badge> : r.invoiceId ? <Link href={`/fees/${r.invoiceId}`}><Badge tone="warning">Pending</Badge></Link> : "—"}</Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
