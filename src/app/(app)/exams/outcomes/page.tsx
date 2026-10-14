import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { batchLabel } from "@/lib/format";
import { Badge, Td, LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Course outcomes" };

export default async function OutcomesPage(props: PageProps<"/exams/outcomes">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const sp = await props.searchParams;
  const [terms, cur] = await Promise.all([db.term.findMany({ orderBy: { startDate: "desc" } }), currentTerm()]);
  const termId = (typeof sp.term === "string" && sp.term) || cur?.id;
  const offerings = await db.courseOffering.findMany({
    where: { ...offeringScope(user), termId },
    include: { subject: { include: { _count: { select: { outcomes: true } } } }, batch: { include: { program: true } }, faculty: { include: { user: { select: { name: true } } } } },
    orderBy: [{ batch: { program: { code: "asc" } } }, { subject: { code: "asc" } }],
  });
  return (
    <>
      <PageHeader title="Outcome attainment (CO-PO)" subtitle="Define course outcomes, map assessments to them and read attainment for NBA / NAAC files." />
      <Filters><select name="term" aria-label="Term" defaultValue={termId} className="input w-auto">{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Filters>
      <SavedFilters storageKey="edupilot-filters-exams-outcomes" />
      <Card>
        {offerings.length === 0 ? <EmptyState title="No courses this term" action={(user.role === "ADMIN" || user.role === "HOD") && <LinkButton variant="secondary" href="/academics/allocation">Allocate courses</LinkButton>}>Outcomes are defined per course.</EmptyState> : (
          <Table>
            <thead><tr><Th>Subject</Th><Th>Batch</Th><Th>Faculty</Th><Th>Outcomes</Th><Th /></tr></thead>
            <tbody>{offerings.map((o) => (
              <tr key={o.id}>
                <Td>{o.subject.name}<p className="font-mono text-xs text-muted">{o.subject.code}</p></Td>
                <Td>{batchLabel(o.batch)}</Td><Td>{o.faculty?.user.name ?? "—"}</Td>
                <Td>{o.subject._count.outcomes ? <Badge tone="success">{o.subject._count.outcomes} COs</Badge> : <Badge>Not defined</Badge>}</Td>
                <Td><Link href={`/exams/outcomes/${o.id}`} className="text-sm text-brand">Open →</Link></Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
