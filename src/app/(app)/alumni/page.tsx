import { banner } from "@/lib/images";
import { PhotoBanner } from "@/components/hero";
import Link from "next/link";
import { Briefcase, GraduationCap, MapPin, ExternalLink } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { programScope } from "@/lib/scope";
import { pct } from "@/lib/format";
import { saveAlumni } from "@/actions/reports";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar } from "@/components/avatar";
import { BarsChart } from "@/components/charts";
import { Badge, Pagination, buttonClass, LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui-server";
import { Filters, SearchInput } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Alumni" };
const PAGE = 24;

export default async function AlumniPage(props: PageProps<"/alumni">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "", program = typeof sp.program === "string" ? sp.program : "", year = Number(sp.year) || 0;
  const page = Math.max(1, Number(sp.page) || 1), edit = typeof sp.edit === "string" ? sp.edit : "";
  const base: Prisma.StudentWhereInput = { status: "GRADUATED", batch: { program: programScope(user) } };
  const where: Prisma.StudentWhereInput = {
    ...base,
    ...(program && { batch: { programId: program, program: programScope(user) } }),
    ...(year && { alumni: { graduationYear: year } }),
    ...(q && { OR: [{ rollNo: { contains: q } }, { user: { name: { contains: q } } }, { alumni: { company: { contains: q } } }, { alumni: { location: { contains: q } } }] }),
  };
  const [rows, total, all, programs] = await Promise.all([
    db.student.findMany({ where, include: { user: { select: { id: true, name: true, photoType: true, email: true } }, alumni: true, batch: { include: { program: true } }, applications: { where: { status: "SELECTED" }, include: { drive: { include: { company: true } } } } }, orderBy: [{ batch: { admissionYear: "desc" } }, { rollNo: "asc" }], skip: (page - 1) * PAGE, take: PAGE }),
    db.student.count({ where }),
    db.student.findMany({ where: base, select: { alumni: { select: { graduationYear: true, company: true, higherStudies: true } }, batch: { select: { admissionYear: true, program: { select: { durationYears: true } } } } } }),
    db.program.findMany({ where: programScope(user), orderBy: { code: "asc" } }),
  ]);
  const gradYear = (s: (typeof all)[number]) => s.alumni?.graduationYear ?? s.batch.admissionYear + s.batch.program.durationYears;
  const byYear = new Map<number, number>();
  for (const s of all) byYear.set(gradYear(s), (byYear.get(gradYear(s)) ?? 0) + 1);
  const employed = all.filter((s) => s.alumni?.company).length, higher = all.filter((s) => s.alumni?.higherStudies).length;
  const query = new URLSearchParams(Object.entries({ q, program, year: year ? String(year) : "" }).filter(([, v]) => v));

  return (
    <>
      <PhotoBanner {...banner("alumni")} />
      <PageHeader title="Alumni" subtitle="Graduates of the institution. A batch becomes alumni when it is graduated under Academics → Batches." actions={<a href="/reports?dataset=alumni&run=1" className={buttonClass("secondary")}>Export</a>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Alumni" value={all.length} icon={<GraduationCap className="size-5" />} />
        <StatCard label="Working" value={employed} tone="success" icon={<Briefcase className="size-5" />} hint={`${pct(employed, all.length)}% with a known employer`} />
        <StatCard label="Higher studies" value={higher} tone="info" />
        <StatCard label="Not yet updated" value={all.length - all.filter((s) => s.alumni?.company || s.alumni?.higherStudies).length} tone="warning" hint="no current details on record" />
      </div>
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Filters>
            <SearchInput placeholder="Name, roll no, company or city" defaultValue={q} />
            <select name="program" aria-label="Program" defaultValue={program} className="input w-auto"><option value="">All programmes</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
            <select name="year" aria-label="Year" defaultValue={year ? String(year) : ""} className="input w-auto"><option value="">Any year</option>{[...byYear.keys()].sort((a, b) => b - a).map((y) => <option key={y} value={y}>Class of {y}</option>)}</select>
          </Filters>
      <SavedFilters storageKey="edupilot-filters-alumni" />
          {rows.length === 0 ? <EmptyState title="No alumni found" action={user.role === "ADMIN" && <LinkButton variant="secondary" href="/academics/batches">Graduate a final-year batch</LinkButton>}>A batch becomes alumni when it is graduated from Academics → Batches.</EmptyState> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((s) => {
                const placed = s.applications[0];
                const company = s.alumni?.company ?? placed?.drive.company.name;
                return (
                  <div key={s.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.user.name} userId={s.user.id} hasPhoto={!!s.user.photoType} size={44} />
                      <div className="min-w-0"><Link href={`/students/${s.id}`} className="block truncate font-medium hover:text-brand">{s.user.name}</Link><p className="text-xs text-muted">{s.batch.program.code} · Class of {s.alumni?.graduationYear ?? s.batch.admissionYear + s.batch.program.durationYears}</p></div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      {company ? <p className="flex items-center gap-1.5"><Briefcase className="size-3.5 text-muted" /><span className="truncate">{s.alumni?.designation ? `${s.alumni.designation}, ` : ""}{company}</span></p> : <p className="text-xs text-muted">No employer on record</p>}
                      {s.alumni?.higherStudies && <p className="flex items-center gap-1.5"><GraduationCap className="size-3.5 text-muted" /><span className="truncate">{s.alumni.higherStudies}</span></p>}
                      {s.alumni?.location && <p className="flex items-center gap-1.5 text-xs text-muted"><MapPin className="size-3.5" />{s.alumni.location}</p>}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex gap-1">{placed && !s.alumni?.company && <Badge tone="info">Campus placement</Badge>}{s.alumni?.linkedin && <a href={s.alumni.linkedin} target="_blank" rel="noopener noreferrer" className="text-brand" aria-label="LinkedIn"><ExternalLink className="size-4" /></a>}</span>
                      <Link href={`/alumni?${query}&edit=${s.id}`} scroll={false} className="text-xs text-brand">Update</Link>
                    </div>
                    {edit === s.id && (
                      <ActionForm action={saveAlumni} className="mt-3 space-y-2 border-t border-line pt-3">
                        <input type="hidden" name="studentId" value={s.id} />
                        <input name="company" defaultValue={s.alumni?.company ?? ""} placeholder="Current company" className="input" />
                        <input name="designation" defaultValue={s.alumni?.designation ?? ""} placeholder="Designation" className="input" />
                        <input name="location" defaultValue={s.alumni?.location ?? ""} placeholder="City" className="input" />
                        <input name="higherStudies" defaultValue={s.alumni?.higherStudies ?? ""} placeholder="Higher studies (e.g. M.Tech, IIT Madras)" className="input" />
                        <input name="personalEmail" type="email" defaultValue={s.alumni?.personalEmail ?? ""} placeholder="Personal email" className="input" />
                        <input name="phone" defaultValue={s.alumni?.phone ?? ""} placeholder="Phone" className="input" />
                        <input name="linkedin" defaultValue={s.alumni?.linkedin ?? ""} placeholder="LinkedIn URL" className="input" />
                        <SubmitButton size="sm">Save</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/alumni?${query}&page=${p}`} />
        </div>
        <Card title="Graduates by year" className="h-fit"><BarsChart data={[...byYear].sort((a, b) => a[0] - b[0]).map(([y, n]) => ({ label: String(y), value: n, href: `/alumni?year=${y}` }))} height={220} /></Card>
      </div>
    </>
  );
}
