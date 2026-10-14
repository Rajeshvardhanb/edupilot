import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, inr, titleCase } from "@/lib/format";
import { saveScholarship, setScholarshipStatus } from "@/actions/campus";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Scholarships" };
const TONE: Record<string, Tone> = { APPLIED: "warning", SANCTIONED: "info", RECEIVED: "success", REJECTED: "danger" };
const SCHEMES = ["State fee reimbursement (RTF)", "Post-matric scholarship", "National Scholarship Portal", "Merit scholarship", "Minority welfare", "EWS fee waiver"];

export default async function ScholarshipsPage() {
  await requireUser(["ADMIN", "ACCOUNTANT"]);
  const rows = await db.scholarship.findMany({ include: { student: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } });
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((t, r) => t + r.amount, 0);
  const year = new Date().getFullYear();
  return (
    <>
      <PageHeader title="Scholarships & fee reimbursement" subtitle="Track government and college scheme claims. Marking a claim received credits the student's fee invoice." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Claimed (awaiting sanction)" value={inr(sum("APPLIED"))} tone="warning" />
        <StatCard label="Sanctioned (awaiting funds)" value={inr(sum("SANCTIONED"))} tone="info" />
        <StatCard label="Received" value={inr(sum("RECEIVED"))} tone="success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Claims">
          {rows.length === 0 ? <EmptyState title="No scholarship claims yet" /> : (
            <Table>
              <thead><tr><Th>Student</Th><Th>Scheme</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <Td><Link href={`/students/${r.studentId}`} className="font-medium hover:text-brand">{r.student.user.name}</Link><p className="font-mono text-xs text-muted">{r.student.rollNo}</p></Td>
                  <Td>{r.scheme}<p className="text-xs text-muted">{r.academicYear}{r.reference && ` · ${r.reference}`} · {fmtDate(r.createdAt)}</p></Td>
                  <Td className="text-right tabular-nums">{inr(r.amount)}</Td>
                  <Td><Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge></Td>
                  <Td className="whitespace-nowrap">
                    <span className="flex gap-1">
                      {r.status === "APPLIED" && <ActionButton action={setScholarshipStatus} fields={{ id: r.id, status: "SANCTIONED" }}>Sanctioned</ActionButton>}
                      {(r.status === "APPLIED" || r.status === "SANCTIONED") && <ActionButton action={setScholarshipStatus} fields={{ id: r.id, status: "RECEIVED" }} variant="secondary" confirm={`Mark ${inr(r.amount)} as received and credit it to the student's invoice?`}>Received</ActionButton>}
                      {r.status === "APPLIED" && <ActionButton action={setScholarshipStatus} fields={{ id: r.id, status: "REJECTED" }} variant="ghost" confirm="Mark this claim rejected?">Reject</ActionButton>}
                    </span>
                  </Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        <Card title="Record a claim" className="h-fit">
          <ActionForm action={saveScholarship} className="space-y-3" resetOnSuccess>
            <Field label="Student roll number" name="rollNo"><input id="rollNo" name="rollNo" data-check="student" className="input font-mono uppercase" required /></Field>
            <Field label="Scheme" name="scheme"><select id="scheme" name="scheme" className="input">{SCHEMES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)" name="amount"><input id="amount" name="amount" type="number" min={1} className="input" required /></Field>
              <Field label="Academic year" name="academicYear"><input id="academicYear" name="academicYear" defaultValue={`${year}-${String(year + 1).slice(2)}`} className="input" /></Field>
            </div>
            <Field label="Application / sanction no." name="reference"><input id="reference" name="reference" className="input" /></Field>
            <SubmitButton>Save claim</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
