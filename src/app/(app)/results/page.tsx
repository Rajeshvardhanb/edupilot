import { PublishedAssessmentMarks } from "@/components/published-assessment-marks";
import { banner } from "@/lib/images";
import { getT } from "@/lib/i18n-server";
import { learnerId } from "@/lib/learner";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gpa } from "@/lib/grading";
import { studentStandings } from "@/lib/results";
import { batchOptions } from "@/lib/options";
import { batchLabel, pct, fmtDate } from "@/lib/format";
import { Badge, Td, LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { AcademicRecord } from "@/components/academic-record";
import { PrintButton } from "@/components/print-button";
import { Letterhead } from "@/components/letterhead";
import { Hero } from "@/components/hero";
import { GraduationIllustration } from "@/components/illustrations";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Results" };

export default async function ResultsPage(props: PageProps<"/results">) {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT", "PARENT"]);
  if (user.role === "STUDENT" || user.role === "PARENT") {
    const s = await db.student.findUniqueOrThrow({ where: { id: learnerId(user) }, include: { user: true, batch: { include: { program: true } } } });
    return (
      <>
        <Hero phone={false} {...banner("results")} eyebrow={`${s.rollNo} · ${s.batch.program.code}`} title={(await getT())("My academic record")} subtitle={s.batch.program.name} art={<GraduationIllustration className="w-full [--brand-soft:rgba(255,255,255,.15)] [--brand:#ffffff] [--brand-2:#c7d2fe] [--surface:rgba(255,255,255,.9)] [--line:rgba(255,255,255,.3)]" />} className="no-print">
          <PrintButton label="Print grade card" />
        </Hero>
        <div className="mb-6 hidden print:block"><Letterhead title="Grade card" serial={s.rollNo} /><p className="mt-3 text-sm"><b>{s.user.name}</b> · {s.batch.program.name}</p></div>
        <PublishedAssessmentMarks student={s} />
        <AcademicRecord studentId={s.id} />
      </>
    );
  }
  return <BatchResults user={user} searchParams={await props.searchParams} />;
}

async function BatchResults({ user, searchParams: sp }: { user: CurrentUser; searchParams: Record<string, string | string[] | undefined> }) {
  const batches = await batchOptions(user.role === "HOD" ? user : undefined);
  const batchId = (typeof sp.batch === "string" && batches.some(b => b.id === sp.batch) && sp.batch) || batches[0]?.id || "-";
  const terms = await db.term.findMany({ where: { offerings: { some: { batchId, OR: [{ resultsPublished: true }, { assessments: { some: { publishedAt: { not: null }, type: { not: "END_SEM" } } } }] } } }, orderBy: { startDate: "desc" } });
  const termId = (typeof sp.term === "string" && terms.some((t) => t.id === sp.term) && sp.term) || terms[0]?.id;
  const batch = await db.batch.findUnique({ where: { id: batchId ?? "-" }, include: { program: true, students: { include: { user: true }, orderBy: { rollNo: "asc" } } } });
  const offerings = await db.courseOffering.findMany({
    where: { batchId, termId, resultsPublished: true },
    include: { subject: true, results: true },
    orderBy: { subject: { code: "asc" } },
  });
  const assessments = await db.assessment.findMany({ where: { publishedAt: { not: null }, type: { not: "END_SEM" }, offering: { batchId, termId: termId ?? "-" } }, include: { offering: { include: { subject: true } }, _count: { select: { marks: true } } }, orderBy: { publishedAt: "desc" } });
  const students = (batch?.students ?? []).filter((s) => offerings.some((o) => o.results.some((r) => r.studentId === s.id)));
  const standings = await studentStandings(students.map((s) => s.id));
  const rows = students.map((s) => {
    const rs = offerings.map((o) => o.results.find((r) => r.studentId === s.id));
    const present = rs.filter((r): r is NonNullable<typeof r> => !!r);
    return { s, rs, sgpa: gpa(present), failed: present.filter((r) => !r.passed).length, st: standings.get(s.id)! };
  });
  const allPass = rows.filter((r) => r.failed === 0).length;
  const toppers = [...rows].sort((a, b) => b.sgpa - a.sgpa).slice(0, 3);
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.sgpa, 0) / rows.length) * 100) / 100 : 0;

  return (
    <>
      <PageHeader illustration="graduation" title="Results" subtitle="Semester result sheet with SGPA, CGPA and backlogs" actions={<PrintButton />} />
      <Filters>
        <select name="batch" aria-label="Batch" defaultValue={batchId} className="input w-auto">{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
        <select name="term" aria-label="Term" defaultValue={termId} className="input w-auto">{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-results" />
      <Card title="Published mid/internal assessments" className="mb-6">
        <p className="mb-3 text-sm text-muted">Assessment marks are released independently during the semester. Final grades and SGPA/CGPA use final course results only.</p>
        {assessments.length === 0 ? <p className="text-sm text-muted">No mid/internal marks published for this batch and term yet.</p> : <Table><thead><tr><Th>Course</Th><Th>Assessment</Th><Th>Published</Th><Th>Marks</Th><Th /></tr></thead><tbody>{assessments.map(a => <tr key={a.id}><Td>{a.offering.subject.name}</Td><Td>{a.name}</Td><Td>{fmtDate(a.publishedAt)}</Td><Td>{a._count.marks}</Td><Td><Link className="text-brand" href={`/exams/${a.offeringId}`}>Review marks →</Link></Td></tr>)}</tbody></Table>}
      </Card>
      {!offerings.length ? <EmptyState title="No final course results for this batch yet" action={<LinkButton variant="secondary" href="/exams">Go to marks entry</LinkButton>}>Final grade cards appear after final course publication. Released mid/internal marks are shown separately above.</EmptyState> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Students appeared" value={rows.length} />
            <StatCard label="All-clear pass %" value={`${pct(allPass, rows.length)}%`} tone="success" hint={`${allPass} passed all subjects`} />
            <StatCard label="Average SGPA" value={avg.toFixed(2)} tone="info" />
            <StatCard label="Top SGPA" value={toppers[0]?.sgpa.toFixed(2) ?? "—"} tone="warning" icon={<Trophy className="size-4" />} hint={toppers[0]?.s.user.name} />
          </div>
          <Card title={`${batch ? batchLabel(batch) : ""} · ${terms.find((t) => t.id === termId)?.name}`} className="mt-6">
            <Table>
              <thead>
                <tr>
                  <Th>Roll no</Th><Th>Name</Th>
                  {offerings.map((o) => <Th key={o.id} className="text-center"><span title={`${o.subject.name} (${o.subject.credits} cr)`}>{o.subject.code}</span></Th>)}
                  <Th className="text-right">SGPA</Th><Th className="text-right">CGPA</Th><Th className="text-right">Backlogs</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, rs, sgpa, st }) => (
                  <tr key={s.id}>
                    <Td className="font-mono text-xs">{s.rollNo}</Td>
                    <Td className="whitespace-nowrap"><Link href={`/students/${s.id}`} className="hover:text-brand">{s.user.name}</Link></Td>
                    {rs.map((r, i) => <Td key={i} className={`text-center text-xs font-medium ${r && !r.passed ? "text-danger" : ""}`}>{r?.grade ?? "—"}</Td>)}
                    <Td className="text-right font-semibold tabular-nums">{sgpa.toFixed(2)}</Td>
                    <Td className="text-right tabular-nums">{st.cgpa.toFixed(2)}</Td>
                    <Td className="text-right">{st.backlogs ? <Badge tone="danger">{st.backlogs}</Badge> : "0"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-3 text-xs text-muted">Grades: O (10) · A+ (9) · A (8) · B+ (7) · B (6) · C (5) · P (4) · F/AB (0). SGPA = Σ(credits × grade point) / Σ credits.</p>
          </Card>
        </>
      )}
    </>
  );
}
