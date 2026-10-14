import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { offeringScope } from "@/lib/scope";
import { db } from "@/lib/db";
import { offeringResults } from "@/lib/results";
import { getRules } from "@/lib/rules";
import { createAssessment, deleteAssessment, publishResults, unpublishResults } from "@/actions/teaching";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { batchLabel, fmtDate, pct, titleCase } from "@/lib/format";
import { BarsChart } from "@/components/charts";
import { MarksGrid } from "./marks-grid";

export const metadata = { title: "Marks & results" };

export default async function OfferingExamPage(props: PageProps<"/exams/[offeringId]">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const { offeringId } = await props.params;
  if (!(await db.courseOffering.findFirst({ where: { id: offeringId, ...offeringScope(user) } }))) notFound();
  const { offering, rows } = await offeringResults(offeringId);
  const rules = await getRules();
  const term = await db.term.findUniqueOrThrow({ where: { id: offering.termId } });
  const eligible = rows.filter((r) => offering.subject.semester >= r.student.entrySemester);
  const locked = offering.resultsPublished;
  const hasEnd = offering.assessments.some((a) => a.type === "END_SEM");
  const passed = eligible.filter((r) => r.result.passed).length;
  const avg = eligible.length ? Math.round(eligible.reduce((s, r) => s + r.result.percent, 0) / eligible.length) : 0;
  const dist = [...rules.gradeScale.map((g) => g.grade), "AB"].map((g) => ({ label: g, value: eligible.filter((r) => r.result.grade === g).length })).filter((d) => d.value || d.label !== "AB");

  return (
    <>
      <PageHeader
        title={offering.subject.name}
        subtitle={<>{offering.subject.code} · {batchLabel(offering.batch)} · {term.name} · CIE {offering.subject.internalMax} + SEE {offering.subject.externalMax} {locked && <Badge tone="success"><Lock className="mr-1 size-3" />Results published</Badge>}</>}
        actions={
          <>
            {!locked && (user.role === "ADMIN" || user.role === "HOD") && hasEnd && <ActionButton action={publishResults} fields={{ offeringId }} variant="primary" confirm="Publish results? Marks will be locked and SGPA/CGPA updated.">Publish results</ActionButton>}
            {locked && user.role === "ADMIN" && <ActionButton action={unpublishResults} fields={{ offeringId }} variant="danger" confirm="Withdraw published results?">Unpublish</ActionButton>}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={eligible.length} />
        <StatCard label={hasEnd ? "Pass percentage" : "Projected pass % (internals only)"} value={`${pct(passed, eligible.length)}%`} tone={pct(passed, eligible.length) >= 75 ? "success" : "warning"} />
        <StatCard label="Class average" value={`${avg}%`} tone="info" />
        <StatCard label="Assessments" value={offering.assessments.length} hint={hasEnd ? "incl. end semester" : "end semester pending"} tone="neutral" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Assessment plan" className="lg:col-span-2">
          <Table>
            <thead><tr><Th>Assessment</Th><Th>Type</Th><Th className="text-right">Max</Th><Th>Date</Th><Th className="text-right">Entered</Th><Th /></tr></thead>
            <tbody>
              {offering.assessments.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium">{a.name}</Td>
                  <Td><Badge tone={a.type === "END_SEM" ? "brand" : "neutral"}>{titleCase(a.type)}</Badge></Td>
                  <Td className="text-right">{a.maxMarks}</Td>
                  <Td>{fmtDate(a.date)}</Td>
                  <Td className="text-right">{a.marks.length}/{eligible.length}</Td>
                  <Td className="text-right">{!locked && <ActionButton action={deleteAssessment} fields={{ id: a.id }} variant="ghost" confirm={`Delete ${a.name} and all its marks?`}>Delete</ActionButton>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-muted">Internal assessments are scaled to {offering.subject.internalMax}; end-semester to {offering.subject.externalMax}. Pass: ≥{rules.passPercent}% total and ≥{rules.minExternalPercent}% in the end-semester exam.</p>
        </Card>
        {!locked ? (
          <Card title="Add assessment">
            <ActionForm action={createAssessment} className="space-y-3" resetOnSuccess>
              <input type="hidden" name="offeringId" value={offeringId} />
              <Field label="Name" name="name"><input id="name" name="name" className="input" placeholder="Mid Term 2" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type" name="type"><select id="type" name="type" className="input">{["MID_TERM", "ASSIGNMENT", "QUIZ", "LAB_INTERNAL", "END_SEM"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></Field>
                <Field label="Max marks" name="maxMarks"><input id="maxMarks" name="maxMarks" type="number" step="0.5" defaultValue={30} className="input" required /></Field>
              </div>
              <Field label="Date" name="date"><input id="date" name="date" type="date" className="input" /></Field>
              <SubmitButton>Add</SubmitButton>
            </ActionForm>
          </Card>
        ) : (
          <Card title="Grade distribution"><BarsChart data={dist} height={220} /></Card>
        )}
      </div>

      {offering.assessments.length > 0 && (
        <Card title="Marks entry" className="mt-6">
          <MarksGrid
            offeringId={offeringId} locked={locked}
            assessments={offering.assessments.map((a) => ({ id: a.id, name: a.name, maxMarks: a.maxMarks }))}
            students={eligible.map((r) => ({
              id: r.student.id, rollNo: r.student.rollNo, name: r.student.user.name,
              marks: Object.fromEntries([...r.marks].map(([aid, m]) => [aid, m.isAbsent ? "AB" : m.marks == null ? "" : String(m.marks)])),
            }))}
          />
        </Card>
      )}

      {offering.assessments.length > 0 && (
        <Card title={locked ? "Published results" : "Result preview (live)"} className="mt-6">
          <Table>
            <thead><tr><Th>Roll no</Th><Th>Name</Th><Th className="text-right">Internal /{offering.subject.internalMax}</Th><Th className="text-right">External /{offering.subject.externalMax}</Th><Th className="text-right">Total</Th><Th className="text-right">%</Th><Th>Grade</Th><Th>Result</Th></tr></thead>
            <tbody>
              {eligible.map(({ student, result: r }) => (
                <tr key={student.id}>
                  <Td className="font-mono text-xs">{student.rollNo}</Td>
                  <Td>{student.user.name}</Td>
                  <Td className="text-right tabular-nums">{r.internal}</Td>
                  <Td className="text-right tabular-nums">{hasEnd ? r.external : "—"}</Td>
                  <Td className="text-right tabular-nums">{r.total}</Td>
                  <Td className="text-right tabular-nums">{r.percent}</Td>
                  <Td>{hasEnd ? <Badge tone={r.passed ? "success" : "danger"}>{r.grade}</Badge> : <span className="text-muted">—</span>}</Td>
                  <Td>{!r.complete ? <Badge tone="warning">Incomplete</Badge> : hasEnd ? (r.passed ? "Pass" : <span className="text-danger">Fail</span>) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
