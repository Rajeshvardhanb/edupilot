import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attendanceSummary } from "@/lib/attendance";
import { studentStandings } from "@/lib/results";
import { getRules } from "@/lib/rules";
import { currentTerm } from "@/lib/scope";
import { batchLabel, pct } from "@/lib/format";
import { promoteReviewed } from "@/actions/academics";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge, LinkButton, Td } from "@/components/ui";
import { Card, PageHeader, StatCard, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Promote batch" };

/** Review before promoting: who moves up and who is held back, with the college's rule applied as the starting point. */
export default async function PromotePage(props: PageProps<"/academics/batches/[id]/promote">) {
  await requireUser(["ADMIN"]);
  const { id } = await props.params;
  const batch = await db.batch.findUnique({ where: { id }, include: { program: true, students: { where: { status: { in: ["ACTIVE", "DETAINED"] } }, include: { user: { select: { name: true } } }, orderBy: { rollNo: "asc" } } } });
  if (!batch) notFound();
  const [rules, term] = await Promise.all([getRules(), currentTerm()]);
  const ids = batch.students.map((s) => s.id);
  const offerings = await db.courseOffering.findMany({ where: { batchId: batch.id, termId: term?.id }, select: { id: true } });
  const [standings, att, junior] = await Promise.all([
    studentStandings(ids),
    attendanceSummary({ studentIds: ids, offeringIds: offerings.map((o) => o.id) }),
    db.batch.findFirst({ where: { programId: batch.programId, admissionYear: batch.admissionYear + 1 }, include: { program: true }, orderBy: { section: "asc" } }),
  ]);
  const attendance = new Map<string, { a: number; t: number }>();
  for (const [k, v] of att) { const sid = k.split(":")[0]; const x = attendance.get(sid) ?? { a: 0, t: 0 }; x.a += v.attended; x.t += v.total; attendance.set(sid, x); }
  const final = batch.currentSemester >= batch.program.totalSemesters;
  const limit = rules.promoteMaxBacklogs;
  const rows = batch.students.map((s) => {
    const st = standings.get(s.id)!, a = attendance.get(s.id);
    // A graduating student must have cleared everything; otherwise the college's backlog limit decides.
    const hold = final ? st.backlogs > 0 : limit !== null && st.backlogs > limit;
    return { s, st, att: a?.t ? pct(a.a, a.t) : null, hold };
  });
  const held = rows.filter((r) => r.hold).length;

  return (
    <>
      <Breadcrumbs items={[{ label: "Academics", href: "/academics" }, { label: "Batches", href: "/academics/batches" }, { label: batchLabel(batch) }]} />
      <PageHeader title={final ? `Graduate ${batchLabel(batch)}` : `Promote ${batchLabel(batch)}`} subtitle={final ? `Final semester (${batch.currentSemester}). Students who graduate become alumni.` : `Semester ${batch.currentSemester} → ${batch.currentSemester + 1}. Review who is held back, then confirm.`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Students in the batch" value={rows.length} />
        <StatCard label={final ? "Ready to graduate" : "To be promoted"} value={rows.length - held} tone="success" />
        <StatCard label="Suggested to hold back" value={held} tone={held ? "warning" : "neutral"} hint={final ? "have a backlog to clear" : limit === null ? "no backlog limit is set" : `more than ${limit} active backlog${limit === 1 ? "" : "s"}`} />
      </div>
      <ActionForm action={promoteReviewed}>
        <input type="hidden" name="id" value={batch.id} />
        <Card title="Students" actions={<span className="text-xs text-muted">Tick a student to hold them back</span>}>
          <Table>
            <thead><tr><Th>Hold back</Th><Th>Roll no</Th><Th>Name</Th><Th className="text-right">CGPA</Th><Th className="text-right">Backlogs</Th><Th className="text-right">Attendance</Th><Th>Now</Th></tr></thead>
            <tbody>
              {rows.map(({ s, st, att: a, hold }) => (
                <tr key={s.id}>
                  <Td><input type="checkbox" name="detain" value={s.id} defaultChecked={hold} aria-label={`Hold back ${s.user.name}`} className="size-4 accent-[var(--danger)]" /></Td>
                  <Td className="font-mono text-xs">{s.rollNo}</Td>
                  <Td className="font-medium">{s.user.name}</Td>
                  <Td className="text-right tabular-nums">{st.cgpa ? st.cgpa.toFixed(2) : "—"}</Td>
                  <Td className="text-right tabular-nums">{st.backlogs ? <Badge tone={hold ? "danger" : "warning"}>{st.backlogs}</Badge> : "0"}</Td>
                  <Td className="text-right tabular-nums">{a === null ? "—" : `${a}%`}</Td>
                  <Td>{s.status === "DETAINED" ? <Badge tone="warning">Detained</Badge> : <Badge tone="success">Active</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5">
            <p className="max-w-2xl text-xs text-muted">
              {final ? "Students you hold back stay on the rolls as detained." : "Everyone not ticked moves to the next semester."}{" "}
              {junior ? `Held-back students join ${batchLabel(junior)} and repeat the year with that class.` : "There is no batch a year below this one, so held-back students stay in this batch, marked as detained."}{" "}
              {limit === null && !final && "Set a backlog limit under Administration → Rules to have this list pre-ticked."}
            </p>
            <span className="flex gap-2">
              <LinkButton variant="secondary" href="/academics/batches">Cancel</LinkButton>
              <SubmitButton confirm={final ? "Graduate this batch? Graduated students become alumni." : `Promote this batch to semester ${batch.currentSemester + 1}?`}>{final ? "Graduate the batch" : "Promote the batch"}</SubmitButton>
            </span>
          </div>
        </Card>
      </ActionForm>
    </>
  );
}
