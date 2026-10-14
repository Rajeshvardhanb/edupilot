import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { batchLabel } from "@/lib/format";
import { Badge, Td, LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Examinations" };

export default async function ExamsPage(props: PageProps<"/exams">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const sp = await props.searchParams;
  const [terms, cur] = await Promise.all([db.term.findMany({ orderBy: { startDate: "desc" } }), currentTerm()]);
  const termId = (typeof sp.term === "string" && sp.term) || cur?.id;
  const offerings = await db.courseOffering.findMany({
    where: { ...offeringScope(user), termId },
    include: { subject: true, faculty: { include: { user: true } }, batch: { include: { program: true } }, assessments: { select: { type: true, _count: { select: { marks: true } } } } },
    orderBy: [{ batch: { program: { code: "asc" } } }, { batch: { admissionYear: "desc" } }, { subject: { code: "asc" } }],
  });
  return (
    <>
      <PageHeader title="Examinations" subtitle="Continuous internal evaluation, end-semester marks and result publication" />
      <Filters>
        <select name="term" aria-label="Term" defaultValue={termId} className="input w-auto">{terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (current)" : ""}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-exams" />
      <Card>
        {offerings.length === 0 ? <EmptyState title="No courses this term" action={(user.role === "ADMIN" || user.role === "HOD") && <LinkButton variant="secondary" href="/academics/allocation">Allocate courses</LinkButton>}>Marks are entered per course. Courses appear here once they are allocated for the term.</EmptyState> : (
          <Table>
            <thead><tr><Th>Subject</Th><Th>Batch</Th>{user.role !== "FACULTY" && <Th>Faculty</Th>}<Th>Assessments</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {offerings.map((o) => {
                const hasEnd = o.assessments.some((a) => a.type === "END_SEM");
                return (
                  <tr key={o.id}>
                    <Td><p className="font-medium">{o.subject.name}</p><p className="text-xs text-muted">{o.subject.code}</p></Td>
                    <Td className="whitespace-nowrap">{batchLabel(o.batch)}</Td>
                    {user.role !== "FACULTY" && <Td>{o.faculty?.user.name ?? "—"}</Td>}
                    <Td>{o.assessments.length} {hasEnd && <Badge tone="brand">SEE</Badge>}</Td>
                    <Td>{o.resultsPublished ? <Badge tone="success">Published</Badge> : hasEnd ? <Badge tone="warning">Ready to publish</Badge> : <Badge tone="neutral">Internals in progress</Badge>}</Td>
                    <Td><Link href={`/exams/${o.id}`} className="text-sm text-brand">Open →</Link></Td>
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
