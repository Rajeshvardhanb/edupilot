import "server-only";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Badge, Td } from "./ui";
import { Card, Table, Th } from "./ui-server";
export async function PublishedAssessmentMarks({ student }: { student: { id: string } }) {
  const marks = await db.mark.findMany({ where: { studentId: student.id, assessment: { publishedAt: { not: null }, type: { not: "END_SEM" } } }, include: { assessment: { include: { offering: { include: { subject: true, term: true } } } } }, orderBy: { assessment: { publishedAt: "desc" } } });
  return <Card title="Mid exam & internal results" className="mb-6">
    <p className="mb-4 text-sm text-muted">Your released assessment marks appear here during the semester. These releases do not change final grades, SGPA or CGPA.</p>
    {marks.length === 0 ? <p className="text-sm text-muted">No mid/internal assessment marks have been published yet.</p> : <Table>
      <thead><tr><Th>Course</Th><Th>Assessment</Th><Th>Term</Th><Th>Marks</Th><Th>Published</Th></tr></thead>
      <tbody>{marks.map(m => <tr key={m.id}><Td>{m.assessment.offering.subject.name}</Td><Td>{m.assessment.name}</Td><Td>{m.assessment.offering.term.name}</Td><Td>{m.isAbsent ? <Badge tone="warning">AB</Badge> : <strong>{m.marks} / {m.assessment.maxMarks}</strong>}</Td><Td>{fmtDate(m.assessment.publishedAt)}</Td></tr>)}</tbody>
    </Table>}
  </Card>;
}
