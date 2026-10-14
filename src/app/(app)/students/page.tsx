import { Download, Upload, UserPlus, MessagesSquare } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentScope, programScope } from "@/lib/scope";
import { batchOptions } from "@/lib/options";
import { batchLabel, titleCase } from "@/lib/format";
import { LinkButton, Pagination } from "@/components/ui";
import { Card, EmptyState, PageHeader } from "@/components/ui-server";
import { Filters, SearchInput } from "@/components/filters";
import { StudentTable } from "./student-table";
import { SavedFilters } from "@/components/saved-filters";
import { STATUS_TONE, studentFilter } from "./filter";

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
        subtitle={`${total.toLocaleString("en-IN")} students match`}
        actions={
          <>
            <a href={`/students/export?${query}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:bg-surface-2"><Download className="size-4" /> Export CSV</a>
            {isOffice(user) && <LinkButton variant="secondary" href="/students/changes">Profile corrections</LinkButton>}
            {(isOffice(user) || user.role === "HOD") && <LinkButton variant="secondary" href="/students/id-cards">ID cards by batch</LinkButton>}
            <LinkButton variant="secondary" href="/students/contacts"><MessagesSquare className="size-4" /> Parent contact log</LinkButton>
            {isOffice(user) && <LinkButton variant="secondary" href="/students/import"><Upload className="size-4" /> Bulk import</LinkButton>}
            {isOffice(user) && <LinkButton href="/students/new"><UserPlus className="size-4" /> New admission</LinkButton>}
          </>
        }
      />
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
            rows={students.map((x) => ({ id: x.id, userId: x.userId, hasPhoto: !!x.user.photoType, rollNo: x.rollNo, name: x.user.name, email: x.user.email, phone: x.user.phone, batch: batchLabel(x.batch), semester: x.batch.currentSemester, admissionType: x.admissionType, status: x.status }))}
          />
        )}
        <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} makeHref={href} />
      </Card>
    </>
  );
}
