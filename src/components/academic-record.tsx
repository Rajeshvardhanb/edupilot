import { getT } from "@/lib/i18n-server";
import { db } from "@/lib/db";
import { gpa, standing } from "@/lib/grading";
import { Badge, Td } from "./ui";
import { Card, EmptyState, Th, Table } from "./ui-server";

/** Semester-wise grade sheet with SGPA, plus overall CGPA. Server component. */
export async function AcademicRecord({ studentId }: { studentId: string }) {
  const tr = await getT();
  const results = await db.subjectResult.findMany({
    where: { studentId, offering: { resultsPublished: true } },
    include: { offering: { include: { subject: true, term: true } } },
    orderBy: [{ offering: { term: { startDate: "asc" } } }, { offering: { subject: { code: "asc" } } }],
  });
  if (results.length === 0) return <EmptyState title="No published results yet" />;
  const st = standing(results.map((r) => ({ ...r, subjectId: r.offering.subjectId, termId: r.offering.termId })));
  const terms = [...new Map(results.map((r) => [r.offering.termId, r.offering.term])).values()];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <Badge tone="brand">CGPA {st.cgpa.toFixed(2)}</Badge>
        <Badge tone={st.backlogs ? "danger" : "success"}>{st.backlogs} active backlog{st.backlogs === 1 ? "" : "s"}</Badge>
        <Badge tone="info">{st.creditsEarned} credits earned</Badge>
      </div>
      {terms.map((t) => {
        const rows = results.filter((r) => r.offering.termId === t.id);
        const sem = rows[0].offering.subject.semester;
        return (
          <Card key={t.id} title={`Semester ${sem} · ${t.name}`} actions={<span className="text-sm font-semibold">SGPA {gpa(rows).toFixed(2)}</span>}>
            <Table>
              <thead><tr><Th>{tr("Code")}</Th><Th>{tr("Subject")}</Th><Th className="text-right">{tr("Credits")}</Th><Th className="text-right">{tr("Internal")}</Th><Th className="text-right">{tr("External")}</Th><Th className="text-right">{tr("Total")}</Th><Th>{tr("Grade")}</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-mono text-xs">{r.offering.subject.code}</Td>
                    <Td>{r.offering.subject.name}</Td>
                    <Td className="text-right">{r.credits}</Td>
                    <Td className="text-right tabular-nums">{r.internal}/{r.offering.subject.internalMax}</Td>
                    <Td className="text-right tabular-nums">{r.external}/{r.offering.subject.externalMax}</Td>
                    <Td className="text-right tabular-nums">{r.total}</Td>
                    <Td><Badge tone={r.passed ? (r.gradePoint >= 8 ? "success" : "neutral") : "danger"}>{r.grade}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        );
      })}
    </div>
  );
}
