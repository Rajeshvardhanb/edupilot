import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { offeringScope } from "@/lib/scope";
import { batchLabel, pct } from "@/lib/format";
import { deleteOutcome, mapAssessments, saveOutcome } from "@/actions/exams";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BarsChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";

export const metadata = { title: "CO-PO attainment" };
const TARGET = 60; // a student "attains" a CO by scoring at least 60% in its mapped assessments
const level = (p: number) => (p >= 70 ? 3 : p >= 60 ? 2 : p >= 50 ? 1 : 0);

export default async function OutcomePage(props: PageProps<"/exams/outcomes/[offeringId]">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const { offeringId } = await props.params;
  const offering = await db.courseOffering.findFirst({
    where: { id: offeringId, ...offeringScope(user) },
    include: {
      subject: { include: { outcomes: { orderBy: { code: "asc" } } } }, batch: { include: { program: true } },
      assessments: { orderBy: { createdAt: "asc" }, include: { marks: true, outcomes: true } },
    },
  });
  if (!offering) notFound();
  const cos = offering.subject.outcomes;

  const rows = cos.map((co) => {
    const mapped = offering.assessments.filter((a) => a.outcomes.some((o) => o.outcomeId === co.id));
    const max = mapped.reduce((s, a) => s + a.maxMarks, 0);
    const byStudent = new Map<string, number>();
    for (const a of mapped) for (const m of a.marks) byStudent.set(m.studentId, (byStudent.get(m.studentId) ?? 0) + (m.marks ?? 0));
    const attained = [...byStudent.values()].filter((v) => max > 0 && (v / max) * 100 >= TARGET).length;
    const p = pct(attained, byStudent.size);
    return { co, mapped: mapped.length, students: byStudent.size, attained, p, level: mapped.length ? level(p) : 0 };
  });
  // PO attainment = Σ(CO level × mapping strength) / Σ strength, on the 0–3 scale.
  const po = Array.from({ length: 12 }, (_, i) => {
    let num = 0, den = 0;
    for (const r of rows) { const s = (r.co.poMap as Record<string, number> | null)?.[String(i + 1)]; if (s && r.mapped) { num += r.level * s; den += s; } }
    return { label: `PO${i + 1}`, value: den ? Math.round((num / den) * 100) / 100 : 0, mapped: den > 0 };
  }).filter((x) => x.mapped);

  return (
    <>
      <Breadcrumbs items={[{ label: "Outcomes (CO-PO)", href: "/exams/outcomes" }, { label: offering.subject.name }]} />
      <PageHeader title={`${offering.subject.name} — attainment`} subtitle={`${offering.subject.code} · ${batchLabel(offering.batch)} · target ${TARGET}% of marks · levels: 3 ≥ 70%, 2 ≥ 60%, 1 ≥ 50% of students`} actions={<PrintButton />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Course outcome attainment">
            {cos.length === 0 ? <EmptyState title="No course outcomes defined">Add CO1, CO2 … using the form.</EmptyState> : (
              <Table>
                <thead><tr><Th>CO</Th><Th>Statement</Th><Th>PO mapping</Th><Th className="text-right">Students ≥ {TARGET}%</Th><Th>Level</Th><Th /></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.co.id}>
                    <Td className="font-mono font-semibold">{r.co.code}</Td>
                    <Td className="max-w-sm text-sm">{r.co.description}</Td>
                    <Td className="text-xs">{Object.entries((r.co.poMap as Record<string, number> | null) ?? {}).map(([k, v]) => `PO${k}(${v})`).join(" ") || "—"}</Td>
                    <Td className="text-right tabular-nums">{r.mapped ? `${r.attained}/${r.students} · ${r.p}%` : <span className="text-xs text-muted">no assessment mapped</span>}</Td>
                    <Td><Badge tone={r.level === 3 ? "success" : r.level === 2 ? "info" : r.level === 1 ? "warning" : "danger"}>{r.mapped ? r.level : "—"}</Badge></Td>
                    <Td className="no-print"><ActionButton action={deleteOutcome} fields={{ id: r.co.id }} variant="ghost" confirm={`Delete ${r.co.code}?`}>×</ActionButton></Td>
                  </tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
          {cos.length > 0 && offering.assessments.length > 0 && (
            <Card title="Assessment → outcome mapping" className="no-print">
              <ActionForm action={mapAssessments}>
                <input type="hidden" name="offeringId" value={offeringId} />
                <Table>
                  <thead><tr><Th>Assessment</Th>{cos.map((c) => <Th key={c.id} className="text-center">{c.code}</Th>)}</tr></thead>
                  <tbody>{offering.assessments.map((a) => (
                    <tr key={a.id}>
                      <Td>{a.name} <span className="text-xs text-muted">/ {a.maxMarks}</span></Td>
                      {cos.map((c) => <Td key={c.id} className="text-center"><input type="checkbox" name="map" value={`${a.id}|${c.id}`} defaultChecked={a.outcomes.some((o) => o.outcomeId === c.id)} className="size-4" aria-label={`${a.name} measures ${c.code}`} /></Td>)}
                    </tr>
                  ))}</tbody>
                </Table>
                <div className="mt-4 flex justify-end"><SubmitButton>Save mapping</SubmitButton></div>
              </ActionForm>
            </Card>
          )}
          {po.length > 0 && <Card title="Programme outcome attainment (0–3)"><BarsChart data={po.map(({ label, value }) => ({ label, value }))} /></Card>}
        </div>
        <Card title="Add / update a course outcome" className="no-print h-fit">
          <ActionForm action={saveOutcome} className="space-y-3" resetOnSuccess>
            <input type="hidden" name="offeringId" value={offeringId} />
            <Field label="Code" name="code"><input id="code" name="code" className="input uppercase" placeholder="CO1" required /></Field>
            <Field label="Outcome statement" name="description"><textarea id="description" name="description" rows={3} className="input" placeholder="Analyse routing algorithms and compare their performance" required /></Field>
            <Field label="PO mapping (PO : strength 1–3)" name="poMap"><input id="poMap" name="poMap" className="input" placeholder="1:3, 2:2, 5:1" /></Field>
            <SubmitButton>Save outcome</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
