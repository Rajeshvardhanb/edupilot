import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { termProgress } from "@/lib/insights";
import { batchLabel, pct } from "@/lib/format";
import { Badge, Progress, Td, LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Syllabus coverage" };

export default async function SyllabusPage() {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const term = await currentTerm();
  const offerings = await db.courseOffering.findMany({
    where: { ...offeringScope(user), termId: term?.id },
    include: { subject: { include: { _count: { select: { topics: true } } } }, batch: { include: { program: true } }, faculty: { include: { user: { select: { name: true } } } }, _count: { select: { coverage: true } } },
    orderBy: [{ batch: { program: { code: "asc" } } }, { subject: { code: "asc" } }],
  });
  const expected = termProgress(term).percent;
  const planned = offerings.filter((o) => o.subject._count.topics > 0);
  const avg = planned.length ? Math.round(planned.reduce((s, o) => s + pct(o._count.coverage, o.subject._count.topics), 0) / planned.length) : 0;
  const behind = planned.filter((o) => pct(o._count.coverage, o.subject._count.topics) < expected - 15).length;
  return (
    <>
      <PageHeader title="Syllabus coverage" subtitle={`${term?.name} · ${expected}% of the term has elapsed`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Average coverage" value={`${avg}%`} tone="info" hint={`${planned.length} of ${offerings.length} courses have a lesson plan`} />
        <StatCard label="Expected by now" value={`${expected}%`} tone="neutral" />
        <StatCard label="Courses running behind" value={behind} tone={behind ? "danger" : "success"} hint="more than 15 points behind the term" />
      </div>
      <Card>
        {offerings.length === 0 ? <EmptyState title="No courses this term" action={(user.role === "ADMIN" || user.role === "HOD") && <LinkButton variant="secondary" href="/academics/allocation">Allocate courses</LinkButton>}>A lesson plan belongs to a course.</EmptyState> : (
          <Table>
            <thead><tr><Th>Subject</Th><Th>Batch</Th>{user.role !== "FACULTY" && <Th>Faculty</Th>}<Th className="w-56">Coverage</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{offerings.map((o) => {
              const total = o.subject._count.topics, p = pct(o._count.coverage, total);
              return (
                <tr key={o.id}>
                  <Td><p className="font-medium">{o.subject.name}</p><p className="text-xs text-muted">{o.subject.code}</p></Td>
                  <Td>{batchLabel(o.batch)}</Td>
                  {user.role !== "FACULTY" && <Td>{o.faculty?.user.name ?? "—"}</Td>}
                  <Td>{total ? <div className="flex items-center gap-2"><Progress value={p} tone={p < expected - 15 ? "danger" : "success"} /><span className="w-20 text-xs tabular-nums">{o._count.coverage}/{total} · {Math.round(p)}%</span></div> : <span className="text-xs text-muted">No lesson plan</span>}</Td>
                  <Td>{!total ? <Badge>Plan needed</Badge> : p < expected - 15 ? <Badge tone="danger">Behind</Badge> : <Badge tone="success">On track</Badge>}</Td>
                  <Td><Link href={`/syllabus/${o.id}`} className="text-sm text-brand">Open →</Link></Td>
                </tr>
              );
            })}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
