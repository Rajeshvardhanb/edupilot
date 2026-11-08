import { Filters,SearchInput } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";
import { LinkButton,Pagination } from "@/components/ui";
import { Card,EmptyState,PageHeader,StatCard } from "@/components/ui-server";
import { attendanceSummary } from "@/lib/attendance";
import { isOffice,requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchLabel,pct,titleCase } from "@/lib/format";
import { batchOptions } from "@/lib/options";
import { studentStandings } from "@/lib/results";
import { getRules } from "@/lib/rules";
import { currentTerm,programScope,studentScope } from "@/lib/scope";
import type { Prisma } from "@prisma/client";
import { AlertTriangle,ClipboardCheck,Download,GraduationCap,PencilLine,Upload,UserPlus } from "lucide-react";
import { STATUS_TONE,studentFilter } from "./filter";
import { StudentTable } from "./student-table";

export const metadata = { title: "Students" };
const SORTS: Record<string, (dir: "asc" | "desc") => Prisma.StudentOrderByWithRelationInput[]> = {
  rollNo: (d) => [{ rollNo: d }],
  name: (d) => [{ user: { name: d } }],
  batch: (d) => [{ batch: { program: { code: d } } }, { batch: { admissionYear: d } }, { rollNo: "asc" }],
  semester: (d) => [{ batch: { currentSemester: d } }, { rollNo: "asc" }],
  status: (d) => [{ status: d }, { rollNo: "asc" }],
};

export default async function StudentsPage(props: PageProps<"/students">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const PAGE_SIZE = [25, 50, 100].includes(Number(sp.size)) ? Number(sp.size) : 25;
  const sort = typeof sp.sort === "string" && sp.sort in SORTS ? sp.sort : "rollNo";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const where: Prisma.StudentWhereInput = { AND: [studentScope(user), studentFilter(sp)] };

  const [students, total, programs, batches] = await Promise.all([
    db.student.findMany({
      where, include: { user: true, batch: { include: { program: true } } },
      orderBy: SORTS[sort](dir), skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    db.student.count({ where }),
    db.program.findMany({ where: programScope(user), orderBy: { code: "asc" } }),
    batchOptions(user),
  ]);
  // Headline figures across everyone this person can see, and attendance and CGPA for the rows on this page.
  const [term, rules, scopeIds, programCount] = await Promise.all([
    currentTerm(), getRules(),
    db.student.findMany({ where: { AND: [studentScope(user), { status: "ACTIVE" }] }, select: { id: true } }),
    db.program.count({ where: programScope(user) }),
  ]);
  const ids = scopeIds.map((x) => x.id);
  const offerings = term ? (await db.courseOffering.findMany({ where: { termId: term.id }, select: { id: true } })).map((o) => o.id) : [];
  const [summary, standings] = await Promise.all([attendanceSummary({ studentIds: ids, offeringIds: offerings }), studentStandings(ids)]);
  const overall = new Map<string, { a: number; t: number }>();
  for (const [k, v] of summary) { const sid = k.split(":")[0]; const c = overall.get(sid) ?? { a: 0, t: 0 }; overall.set(sid, { a: c.a + v.attended, t: c.t + v.total }); }
  const attOf = (sid: string) => { const v = overall.get(sid); return v && v.t ? pct(v.a, v.t) : null; };
  const below = ids.filter((sid) => { const a = attOf(sid); return a !== null && a < rules.attendanceRequired; }).length;
  const withBacklogs = ids.filter((sid) => (standings.get(sid)?.backlogs ?? 0) > 0).length;

  const query = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
  const href = (p: number) => { query.set("page", String(p)); return `/students?${query}`; };
  query.delete("page");
  const sortHref = Object.fromEntries(Object.keys(SORTS).map((k) => {
    const q = new URLSearchParams(query);
    q.set("sort", k); q.set("dir", sort === k && dir === "asc" ? "desc" : "asc");
    return [k, `/students?${q}`];
  }));

  return (
    <>
      <PageHeader
        title="Students"
        illustration="students"
        subtitle={`${total.toLocaleString("en-IN")} students match`}
        actions={
          <>
            <a href={`/students/export?${query}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:bg-surface-2"><Download className="size-4" /> Export CSV</a>
            {isOffice(user) && <LinkButton variant="secondary" href="/students/import"><Upload className="size-4" /> Bulk import</LinkButton>}
            {isOffice(user) && <LinkButton href="/students/new"><UserPlus className="size-4" /> New admission</LinkButton>}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Active" value={ids.length.toLocaleString("en-IN")} icon={<GraduationCap className="size-5" />} hint={`${programCount} programmes`} href="/students?status=ACTIVE" />
        <StatCard label={`Below ${rules.attendanceRequired}% attendance`} value={below} tone="danger" icon={<ClipboardCheck className="size-5" />} hint="across all batches" href="/attendance/report" />
        <StatCard label="With backlogs" value={withBacklogs} tone="warning" icon={<AlertTriangle className="size-5" />} hint="one or more" />
        <StatCard label="Average CGPA" value={(ids.reduce((s, sid) => s + (standings.get(sid)?.cgpa ?? 0), 0) / Math.max(1, ids.length)).toFixed(2)} tone="brand" icon={<PencilLine className="size-5" />} hint="active students" />
      </div>
      <Filters>
        <SearchInput placeholder="Search by name, roll no, email or phone" defaultValue={sp.q as string} />
        <select name="program" aria-label="Program" defaultValue={(sp.program as string) ?? ""} className="input w-auto">
          <option value="">All programmes</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
        <select name="batch" aria-label="Batch" defaultValue={(sp.batch as string) ?? ""} className="input w-auto">
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select name="status" aria-label="Status" defaultValue={(sp.status as string) ?? "ACTIVE"} className="input w-auto">
          <option value="ALL">Any status</option>
          {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select name="type" aria-label="Type" defaultValue={(sp.type as string) ?? ""} className="input w-auto">
          <option value="">Any admission</option>
          {["REGULAR", "LATERAL", "MANAGEMENT", "SPOT"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select name="size" defaultValue={String(PAGE_SIZE)} className="input w-auto" aria-label="Rows per page">
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} rows</option>)}
        </select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-students" />
      <Card>
        {students.length === 0 ? <EmptyState title="No students found" action={<><LinkButton variant="secondary" href="/students">Clear the filters</LinkButton>{isOffice(user) && <LinkButton href="/students/new">New admission</LinkButton>}</>}>Nobody matches this search and these filters.</EmptyState> : (
          <StudentTable
            canEdit={isOffice(user)} batches={batches} sortHref={sortHref} sort={sort} dir={dir}
            rows={students.map((x) => ({ id: x.id, userId: x.userId, hasPhoto: !!x.user.photoType, rollNo: x.rollNo, name: x.user.name, email: x.user.email, phone: x.user.phone, batch: batchLabel(x.batch), semester: x.batch.currentSemester, admissionType: x.admissionType, status: x.status, attendance: attOf(x.id), cgpa: standings.get(x.id)?.cgpa ?? null }))}
            attendanceRequired={rules.attendanceRequired}
          />
        )}
        <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} makeHref={href} />
      </Card>
    </>
  );
}
