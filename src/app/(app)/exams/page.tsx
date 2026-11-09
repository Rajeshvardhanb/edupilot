import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { batchLabel } from "@/lib/format";
import { Badge, Td, LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { visibleStudentWhere } from "@/lib/student-visibility";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Examinations" };

export default async function ExamsPage(props: PageProps<"/exams">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const sp = await props.searchParams;
  const [terms, cur] = await Promise.all([db.term.findMany({ orderBy: { startDate: "desc" } }), currentTerm()]);
  const termId = (typeof sp.term === "string" && sp.term) || cur?.id;
  const batchId = typeof sp.batch === "string" ? sp.batch : "";
  const courses = await db.courseOffering.findMany({
    where: { AND: [offeringScope(user), { termId, batch: { students: { some: { ...visibleStudentWhere, status: { in: ["ACTIVE", "DETAINED"] } } } } }] },
    include: { subject: true, faculty: { include: { user: true } }, batch: { include: { program: true, students: { where: { status: { in: ["ACTIVE", "DETAINED"] } }, select: { id: true, entrySemester: true } } } }, assessments: { select: { type: true, _count: { select: { marks: true } } } } },
    orderBy: [{ batch: { program: { code: "asc" } } }, { batch: { admissionYear: "desc" } }, { subject: { code: "asc" } }],
  });
  const enrolled = courses.filter(o => o.batch.students.some(s => s.entrySemester <= o.subject.semester));
  const batches = [...new Map(enrolled.map(o => [o.batch.id, o.batch])).values()];
  const offerings = batchId ? enrolled.filter(o => o.batchId === batchId) : enrolled;
  return (
    <>
      <PageHeader illustration="graduation" title="Marks entry" subtitle="Choose a batch and course to enter student marks, then review and publish results." />
      <Filters>
        <select name="term" aria-label="Term" defaultValue={termId} className="input w-auto">{terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (current)" : ""}</option>)}</select>
        <select name="batch" aria-label="Batch" defaultValue={batchId} className="input w-auto"><option value="">All enrolled batches</option>{batches.map(b => <option key={b.id} value={b.id}>{batchLabel(b)}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-exams" />
      <Card>
        {offerings.length === 0 ? <EmptyState title="No courses this term" action={(user.role === "ADMIN" || user.role === "HOD") && <LinkButton variant="secondary" href="/academics/allocation">Allocate courses</LinkButton>}>No enrolled students match the selected course and term. Check the batch filter, student admission status and course allocations. Courses containing only hidden sample students are excluded.</EmptyState> : (
          <Table>
            <thead><tr><Th>Subject</Th><Th>Batch</Th>{user.role !== "FACULTY" && <Th>Faculty</Th>}<Th>Students</Th><Th>Assessments</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {offerings.map((o) => {
                const hasEnd = o.assessments.some((a) => a.type === "END_SEM");
                return (
                  <tr key={o.id}>
                    <Td><p className="font-medium">{o.subject.name}</p><p className="text-xs text-muted">{o.subject.code}</p></Td>
                    <Td className="whitespace-nowrap">{batchLabel(o.batch)}</Td>
                    {user.role !== "FACULTY" && <Td>{o.faculty?.user.name ?? "—"}</Td>}
                    <Td>{o.batch.students.filter(s => s.entrySemester <= o.subject.semester).length}</Td>
                    <Td>{o.assessments.length} {hasEnd && <Badge tone="brand">SEE</Badge>}</Td>
                    <Td>{o.resultsPublished ? <Badge tone="success">Published</Badge> : hasEnd ? <Badge tone="warning">Complete marks to publish</Badge> : <Badge tone="neutral">Internals in progress</Badge>}</Td>
                    <Td><Link href={`/exams/${o.id}`} className="text-sm text-brand">{o.resultsPublished ? "Review results →" : "Enter marks →"}</Link></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
