import { publishAssessmentResults, withdrawAssessmentResults } from "@/actions/assessment-results";
import { missingAssessmentMarks } from "@/lib/assessment-release";
import Link from "next/link";
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
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
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
  const incomplete = eligible.filter(r => !r.result.complete).length;
  const ready = hasEnd && eligible.length > 0 && incomplete === 0;
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
            {!locked && (user.role === "ADMIN" || user.role === "HOD") && <ActionButton disabled={!ready} action={publishResults} fields={{ offeringId }} variant="primary" confirm="Publish final course results? All marks will be locked and SGPA/CGPA updated.">Publish final results</ActionButton>}
            {locked && user.role === "ADMIN" && <ActionButton action={unpublishResults} fields={{ offeringId }} variant="danger" confirm="Withdraw published results?">Unpublish</ActionButton>}
          </>
        }
      />
      <div className="mb-6 rounded-xl border border-line bg-surface-2 p-4 text-sm space-y-2">
        <p className="font-semibold">Publish mid exams during the semester</p>
        <p>Enter and save marks, then use <strong>Publish marks</strong> on the Mid Term 1, Mid Term 2 or other assessment card below. Each assessment can be released independently. No end-semester exam is needed for this.</p>
        <p className="text-muted">Published assessment columns are locked. Admin can withdraw an individual release for corrections. Faculty enters marks; HOD/Admin publishes.</p>
        <p className="font-semibold pt-2">Final course results and SGPA/CGPA</p>
        {locked ? <p>Final results are published and all marks are locked. Admin can unpublish final results for corrections.</p>
          : eligible.length === 0 ? <p>No enrolled students. Select the correct batch from <Link href="/exams" className="text-brand underline">Marks entry</Link>.</p>
          : !hasEnd ? <p><strong>Publish final results</strong> requires an End semester exam and all required marks. You can publish mid/internal marks using the assessment buttons now.</p>
          : incomplete > 0 ? <p>{incomplete} students have missing marks for final results. Save all required marks or AB before final publication.</p>
          : <p>All required marks are ready for final publication. Publishing a mid exam or final course result does not close the academic term.</p>}
      </div>
      <Card title="Publish mid/internal marks" className="mb-6">
        <p className="mb-4 text-sm text-muted">Release each assessment separately when its marks are saved. You do not need to wait for final exams.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {offering.assessments.filter(a => a.type !== "END_SEM").map(a => {
            const missing = missingAssessmentMarks(eligible.map(r => r.student.id), a.marks, a.maxMarks);
            return <div key={a.id} role="group" aria-label={`${a.name} result release`} className="rounded-xl border border-line bg-surface-2 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{a.name}</h3><Badge tone={a.publishedAt ? "success" : "neutral"}>{a.publishedAt ? "Published" : locked ? "In final grade card" : "Draft"}</Badge></div>
              <p className="text-xs text-muted">Out of {a.maxMarks}{a.publishedAt ? ` · Published ${fmtDate(a.publishedAt)}` : !locked ? ` · ${missing} students missing valid marks` : ""}</p>
              {!locked && !a.publishedAt && (user.role === "ADMIN" || user.role === "HOD") && <ActionButton action={publishAssessmentResults} fields={{ assessmentId: a.id }} disabled={eligible.length === 0 || missing > 0} confirm={`Publish ${a.name} marks to students and linked parents? Other assessments and semester status stay unchanged.`}>Publish marks</ActionButton>}
              {!locked && a.publishedAt && user.role === "ADMIN" && <ActionButton action={withdrawAssessmentResults} fields={{ assessmentId: a.id }} variant="danger" confirm={`Withdraw ${a.name} marks for review?`}>Withdraw marks</ActionButton>}
            </div>;
          })}
        </div>
        {offering.assessments.every(a => a.type === "END_SEM") && <p className="text-sm text-muted">Add a Mid term assessment in the form below to enter and release mid exam marks.</p>}
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
                  <Td className="text-right">{!locked && !a.publishedAt && <ActionButton action={deleteAssessment} fields={{ id: a.id }} variant="ghost" confirm={`Delete ${a.name} and all its marks?`}>Delete</ActionButton>}</Td>
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
                <Field label="Type" name="type"><select id="type" name="type" className="input">{["MID_TERM", "ASSIGNMENT", "QUIZ", "LAB_INTERNAL", "END_SEM"].map((t) => <option key={t} value={t}>{t === "END_SEM" ? "End semester exam" : titleCase(t)}</option>)}</select></Field>
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

      <Card title="Marks entry" className="mt-6">
        {eligible.length === 0 ? <EmptyState title="No students enrolled">Choose a course for the correct batch. Inactive, deleted and hidden sample students are not included.</EmptyState> : <>
          {offering.assessments.length === 0 && <p className="mb-4 text-sm text-muted">Your enrolled students are listed below. Add an assessment above to create marks columns.</p>}
          <MarksGrid key={offering.assessments.map(a => a.id).join(":")} offeringId={offeringId} locked={locked}
            assessments={offering.assessments.map(a => ({ id: a.id, name: a.name, maxMarks: a.maxMarks, published: !!a.publishedAt }))}
            students={eligible.map(r => ({ id: r.student.id, rollNo: r.student.rollNo, name: r.student.user.name,
              marks: Object.fromEntries([...r.marks].map(([aid, m]) => [aid, m.isAbsent ? "AB" : m.marks == null ? "" : String(m.marks)])) }))} />
        </>}
      </Card>

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
