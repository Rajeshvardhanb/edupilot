import { Suspense } from "react";
import { getInstitution } from "@/lib/institution";
import { banner, photo } from "@/lib/images";
import Image from "next/image";
import Link from "next/link";
import {
  GraduationCap, Users, Wallet, AlertTriangle, UserPlus, Megaphone, FileWarning, IndianRupee,
  Cpu, Radio, Zap, Cog, HardHat, Building2, Activity, ArrowRight, SlidersHorizontal,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { Filters } from "@/components/filters";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveDashboardPrefs } from "@/actions/prefs";
import { db } from "@/lib/db";
import { currentTerm, offeringScope, studentScope } from "@/lib/scope";
import { attendanceSummary } from "@/lib/attendance";
import { getRules } from "@/lib/rules";
import { cgpaDistribution, dailyAttendance, demographics, departmentSnapshots, feeStatusSplit, greeting, termProgress, weeklyCollections } from "@/lib/insights";
import { fmtDateTime, inr, pct, titleCase } from "@/lib/format";
import { Badge, DashboardBodySkeleton, TasksSkeleton } from "@/components/ui";
import { Card, StatCard, Tabs } from "@/components/ui-server";
import { BarsChart, DonutChart, Sparkline, TrendChart } from "@/components/charts";
import { Funnel, Gauge, StackedBar } from "@/components/infographics";
import { CampusIllustration } from "@/components/illustrations";
import { MyTasks } from "@/components/my-tasks";
import { Hero, HeroAction, TermProgress } from "@/components/hero";
import { RecentNotices } from "./widgets";

const DEPT_ICON: Record<string, typeof Cpu> = { CSE: Cpu, ECE: Radio, EEE: Zap, ME: Cog, CE: HardHat };
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const lakh = (n: number) => `₹${(n / 1e5).toFixed(n >= 1e7 ? 0 : 1)}L`;

const SECTIONS = [["kpis", "Key numbers"], ["attendance", "Attendance trend & health"], ["demographics", "Student demographics"], ["departments", "Department cards"], ["academics", "Programmes & CGPA"], ["finance", "Fees, placements & activity"], ["notices", "Notice board"]] as const;

/** The banner needs only the term and the college name, so it is on screen while the figures below are still being worked out. */
async function AdminHero({ user }: { user: CurrentUser }) {
  const [term, inst, dept] = await Promise.all([currentTerm(), getInstitution(), user.role === "HOD" && user.departmentId ? db.department.findUnique({ where: { id: user.departmentId }, select: { name: true } }) : null]);
  const progress = termProgress(term);
  return (
    <Hero
      eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      title={greeting(user.name)}
      subtitle={<>{user.role === "HOD" ? dept?.name ?? inst.name : inst.name} · {term?.name ?? "No active term"}</>}
      {...banner("hero-admin")}
      art={<CampusIllustration className="w-full drop-shadow-xl" />}
    >
      <TermProgress {...progress} />
      <div className="mt-5 flex flex-wrap gap-2">
        {user.role === "ADMIN" && <HeroAction primary href="/students/new"><UserPlus className="size-4" /> Admit student</HeroAction>}
        <HeroAction primary={user.role !== "ADMIN"} href="/attendance/report"><FileWarning className="size-4" /> Shortage report</HeroAction>
        <HeroAction href="/notices"><Megaphone className="size-4" /> Post notice</HeroAction>
        {user.role === "ADMIN" && <HeroAction href="/fees"><IndianRupee className="size-4" /> Fees</HeroAction>}
      </div>
    </Hero>
  );
}

export function AdminDashboard(props: { user: CurrentUser; searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <>
      <AdminHero user={props.user} />
      <Suspense fallback={<TasksSkeleton />}><MyTasks user={props.user} /></Suspense>
      <Suspense fallback={<DashboardBodySkeleton />}><AdminBody {...props} /></Suspense>
    </>
  );
}

async function AdminBody({ user, searchParams: sp }: { user: CurrentUser; searchParams: Record<string, string | string[] | undefined> }) {
  const rules = await getRules();
  const { attendanceRequired: ATTENDANCE_REQUIRED, attendanceCondonable: ATTENDANCE_CONDONABLE } = rules;
  const term = await currentTerm();
  const days = [30, 60, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  // HODs are fixed to their department; the principal can focus on one with the filter.
  const deptId = user.role === "HOD" ? user.departmentId ?? "-" : typeof sp.dept === "string" && sp.dept ? sp.dept : undefined;
  const sScope: Prisma.StudentWhereInput = deptId ? { batch: { program: { departmentId: deptId } } } : studentScope(user);
  const oScope: Prisma.CourseOfferingWhereInput = deptId ? { batch: { program: { departmentId: deptId } } } : offeringScope(user);
  const [me, allDepts] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { prefs: true } }),
    user.role === "ADMIN" ? db.department.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true } }) : [],
  ]);
  const hidden = new Set(((me?.prefs as { hiddenCards?: string[] } | null)?.hiddenCards) ?? []);
  // "Today" holds what needs attention; the slower-moving charts are one click away under "College insights".
  const insights = sp.view === "insights";
  const INSIGHTS = ["demographics", "departments", "academics"];
  const show = (k: string) => !hidden.has(k) && INSIGHTS.includes(k) === insights;
  const keep = new URLSearchParams(Object.entries({ dept: sp.dept, days: sp.days }).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1]));
  const tabHref = (view?: string) => { const q = new URLSearchParams(keep); if (view) q.set("view", view); return `/dashboard${q.size ? `?${q}` : ""}`; };
  const deptFilter = deptId ? { departmentId: deptId } : {};

  const lastTerm = await db.term.findFirst({ where: { isCurrent: false, endDate: { lt: term?.startDate ?? new Date() } }, orderBy: { endDate: "desc" } });
  const [activeStudents, facultyCount, programs, offerings, drives, apps, activity, studentIds, newAdmissions] = await Promise.all([
    db.student.count({ where: { ...sScope, status: "ACTIVE" } }),
    db.faculty.count({ where: deptFilter }),
    db.program.findMany({ where: deptFilter, include: { batches: { include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } } }, orderBy: { code: "asc" } }),
    db.courseOffering.findMany({ where: { ...oScope, termId: term?.id }, select: { id: true } }),
    db.placementDrive.findMany({ where: { status: { in: ["OPEN", "UPCOMING"] } }, include: { company: true, _count: { select: { applications: true } } }, orderBy: { driveDate: "asc" }, take: 4 }),
    db.placementApplication.groupBy({ by: ["status"], where: { student: sScope }, _count: true }),
    db.auditLog.findMany({ where: { action: { not: "LOGIN" } }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.student.findMany({ where: { ...sScope, status: "ACTIVE" }, select: { id: true } }),
    db.student.count({ where: { ...sScope, admissionDate: { gte: new Date(`${new Date().getFullYear()}-01-01`) } } }),
  ]);

  const offeringIds = offerings.map((o) => o.id);
  const [summary, daily, demo, cgpa, fees, weekly, depts] = await Promise.all([
    attendanceSummary({ offeringIds }),
    dailyAttendance(offeringIds, days),
    demographics(sScope),
    cgpaDistribution(studentIds.map((s) => s.id)),
    feeStatusSplit(deptId ? { departmentId: deptId } : {}),
    weeklyCollections(10, deptId ? { departmentId: deptId } : {}),
    departmentSnapshots(term?.id, lastTerm?.id, deptId),
  ]);

  // Attendance standing bands per student.
  const perStudent = new Map<string, { a: number; t: number }>();
  for (const [k, v] of summary) {
    const sid = k.split(":")[0];
    const cur = perStudent.get(sid) ?? { a: 0, t: 0 };
    perStudent.set(sid, { a: cur.a + v.attended, t: cur.t + v.total });
  }
  const bands = { ok: 0, condonable: 0, shortage: 0 };
  let attA = 0, attT = 0;
  for (const { a, t } of perStudent.values()) {
    attA += a; attT += t;
    const p = pct(a, t);
    if (p >= ATTENDANCE_REQUIRED) bands.ok++; else if (p >= ATTENDANCE_CONDONABLE) bands.condonable++; else bands.shortage++;
  }
  const overallAtt = pct(attA, attT);
  const last14 = daily.slice(-14).map((d) => d.value);
  const thisWeek = daily.slice(-6), prevWeek = daily.slice(-12, -6);
  const avg = (xs: { value: number }[]) => (xs.length ? xs.reduce((s, x) => s + x.value, 0) / xs.length : 0);
  const attDelta = Math.round((avg(thisWeek) - avg(prevWeek)) * 10) / 10;
  const collDelta = weekly.at(-2) ? Math.round(((weekly.at(-1)! - weekly.at(-2)!) / weekly.at(-2)!) * 100) : 0;
  const appCount = (s: string) => apps.find((a) => a.status === s)?._count ?? 0;
  const applied = apps.reduce((s, a) => s + a._count, 0);
  const deptPhoto: Record<string, string | null> = { CSE: photo("dept-cse"), ECE: photo("dept-ece"), EEE: photo("dept-eee"), ME: photo("dept-me"), CE: photo("dept-ce") };
  const intake = new Map<number, number>();
  for (const b of programs.flatMap((p) => p.batches)) intake.set(b.admissionYear, (intake.get(b.admissionYear) ?? 0) + b._count.students);
  const intakeByYear = [...intake].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
  const gender = (g: string) => demo.gender.find((x) => x.gender === g)?._count ?? 0;

  return (
    <>

      <Tabs items={[{ href: tabHref(), label: "Today" }, { href: tabHref("insights"), label: "College insights" }]} active={tabHref(insights ? "insights" : undefined)} />
      <div className="no-print mb-4 flex flex-wrap items-start justify-between gap-3">
        <Filters>
          {user.role === "ADMIN" && <select name="dept" defaultValue={deptId ?? ""} className="input w-auto" aria-label="Department"><option value="">All departments</option>{allDepts.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>}
          <select name="days" defaultValue={String(days)} className="input w-auto" aria-label="Trend period">{[30, 60, 90].map((n) => <option key={n} value={n}>Last {n} days</option>)}</select>
        </Filters>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-surface-2"><SlidersHorizontal className="size-4" /> Customise</summary>
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-lift">
            <p className="mb-2 text-sm font-semibold">Show on my dashboard</p>
            <ActionForm action={saveDashboardPrefs} className="space-y-2">
              <input type="hidden" name="all" value={SECTIONS.map(([k]) => k).join(",")} />
              {SECTIONS.map(([k, label]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name="show" value={k} defaultChecked={show(k)} /> {label}</label>)}
              <SubmitButton size="sm">Save</SubmitButton>
            </ActionForm>
          </div>
        </details>
      </div>

      {show("kpis") && <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard href="/students" label="Active students" value={activeStudents.toLocaleString("en-IN")} icon={<GraduationCap className="size-5" />} hint={`${newAdmissions} admitted this year`} chart={<Sparkline data={intakeByYear} />} />
        <StatCard href="/attendance/report" label="Attendance (term)" value={`${overallAtt}%`} tone="success" icon={<Activity className="size-5" />} trend={{ value: `${Math.abs(attDelta)} pts`, up: attDelta >= 0 }} hint="vs previous week" chart={<Sparkline data={last14} color="var(--success)" />} />
        <StatCard href={user.role === "ADMIN" ? "/fees/payments" : undefined} label="Fees collected" value={lakh(fees.paid)} tone="info" icon={<Wallet className="size-5" />} trend={{ value: `${Math.abs(collDelta)}%`, up: collDelta >= 0 }} hint="week on week" chart={<Sparkline data={weekly} color="var(--info)" />} />
        <StatCard href="/faculty" label="Faculty" value={facultyCount} tone="warning" icon={<Users className="size-5" />} hint={`Student–faculty ratio ${facultyCount ? Math.round(activeStudents / facultyCount) : 0}:1 · ${depts.length} depts`} />
      </div>}

      {show("attendance") && <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={`Daily attendance — last ${days} days`} className="lg:col-span-2" actions={<Badge tone="brand">{daily.length} working days</Badge>}>
          <TrendChart unit="%" domain={[50, 100]} data={daily.map((d) => ({ label: d.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }), value: d.value }))} />
        </Card>
        <Card title="Attendance health" actions={<Link href="/attendance/report" className="text-xs text-brand">Report →</Link>}>
          <div className="flex items-center gap-5">
            <Gauge value={overallAtt} label="overall" tone={overallAtt >= ATTENDANCE_REQUIRED ? "success" : "warning"} threshold={ATTENDANCE_REQUIRED} />
            <ul className="flex-1 space-y-3 text-sm">
              {[
                { l: `≥ ${ATTENDANCE_REQUIRED}% · eligible`, v: bands.ok, c: "var(--success)", href: "/attendance/report?below=101" },
                { l: `${ATTENDANCE_CONDONABLE}–${ATTENDANCE_REQUIRED}% · condonable`, v: bands.condonable, c: "var(--warning)", href: `/attendance/report?below=${ATTENDANCE_REQUIRED}` },
                { l: `< ${ATTENDANCE_CONDONABLE}% · at risk`, v: bands.shortage, c: "var(--danger)", href: `/attendance/report?below=${ATTENDANCE_CONDONABLE}` },
              ].map((b) => (
                <li key={b.l}>
                  <Link href={b.href} title="Open this list" className="block rounded-md hover:bg-surface-2">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{b.l}</span><span className="font-semibold tabular-nums">{b.v}</span></div>
                    <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${pct(b.v, perStudent.size)}%`, background: b.c }} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted"><AlertTriangle className="mr-1 inline size-3.5 text-warning" /> {bands.shortage + bands.condonable} students need intervention before end-semester exams.</p>
        </Card>
      </div>}

      {show("demographics") && <><h2 className="mt-8 mb-3 text-base font-semibold">Student demographics</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Gender ratio">
          <DonutChart centerLabel="students" data={[
            { label: "Male", value: gender("MALE"), color: SERIES[0] },
            { label: "Female", value: gender("FEMALE"), color: SERIES[1] },
            ...(gender("OTHER") ? [{ label: "Other", value: gender("OTHER"), color: SERIES[2] }] : []),
          ]} />
        </Card>
        <Card title="Admission route">
          <DonutChart centerLabel="admissions" data={demo.admission.sort((a, b) => b._count - a._count).map((a, i) => ({ label: a.admissionType === "LATERAL" ? "Lateral entry" : titleCase(a.admissionType), value: a._count, color: SERIES[i] }))} />
        </Card>
        <Card title="Reservation category">
          <DonutChart centerLabel="students" data={demo.category.sort((a, b) => b._count - a._count).map((a, i) => ({ label: a.category, value: a._count, color: SERIES[i] }))} />
        </Card>
      </div></>}

      {show("departments") && <><h2 className="mt-8 mb-3 text-base font-semibold">Departments</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {depts.map((d) => {
          const Icon = DEPT_ICON[d.code] ?? Building2;
          return (
            <Link key={d.id} href={`/students?dept=${d.id}`} className="tile tile-hover group animate-fade-up p-5">
              {deptPhoto[d.code] && (
                <div className="relative -mx-5 -mt-5 mb-4 h-24 overflow-hidden rounded-t-[11px] border-b border-line">
                  <Image src={deptPhoto[d.code]!} alt="" fill sizes="(min-width: 1280px) 240px, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="chip size-9"><Icon className="size-4" /></span>
                <span className="text-xs font-semibold text-muted">{d.code}</span>
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{d.name}</p>
              <p className="mt-1 truncate text-xs text-muted">HOD: {d.hod ?? "—"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-surface-2 py-2"><dd className="text-base font-semibold tabular-nums">{d.students}</dd><dt className="text-[11px] text-muted">Students</dt></div>
                <div className="rounded-lg bg-surface-2 py-2"><dd className="text-base font-semibold tabular-nums">{d.faculty}</dd><dt className="text-[11px] text-muted">Faculty</dt></div>
              </dl>
              <div className="mt-3 space-y-2 text-xs">
                <div><div className="mb-1 flex justify-between"><span className="text-muted">Attendance</span><span className="font-medium">{d.attendance}%</span></div><div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-success" style={{ width: `${d.attendance}%` }} /></div></div>
                <div><div className="mb-1 flex justify-between"><span className="text-muted">Pass rate</span><span className="font-medium">{d.passRate}%</span></div><div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${d.passRate}%` }} /></div></div>
              </div>
            </Link>
          );
        })}
      </div></>}

      {show("academics") && <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Active students by programme" className="lg:col-span-2" actions={<span className="text-xs text-muted">Click a bar to open the list</span>}>
          <BarsChart horizontal height={Math.max(200, programs.length * 34)} data={programs.map((p) => ({ label: p.code, value: p.batches.reduce((s, b) => s + b._count.students, 0), href: `/students?program=${p.id}&status=ACTIVE` }))} />
        </Card>
        <Card title="CGPA distribution" actions={<Badge tone="info">avg {cgpa.average.toFixed(2)}</Badge>}>
          <BarsChart data={cgpa.bands} height={220} />
          <p className="mt-2 text-xs text-muted">{cgpa.withBacklogs} students currently carry one or more backlogs.</p>
        </Card>
      </div>}

      {show("finance") && <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Fee realisation 2026-27" actions={<Link href="/fees" className="text-xs text-brand">Fees →</Link>}>
          <div className="mb-5 flex items-end justify-between">
            <div><p className="text-3xl font-semibold tabular-nums">{pct(fees.paid, fees.payable)}%</p><p className="text-xs text-muted">{inr(fees.paid)} of {inr(fees.payable)}</p></div>
            <Badge tone="danger">{fees.split.OVERDUE} overdue</Badge>
          </div>
          <StackedBar data={[
            { label: "Paid", value: fees.split.PAID, color: "var(--success)" },
            { label: "Partial", value: fees.split.PARTIAL, color: "var(--info)" },
            { label: "Due", value: fees.split.DUE, color: "var(--warning)" },
            { label: "Overdue", value: fees.split.OVERDUE, color: "var(--danger)" },
          ]} />
        </Card>
        <Card title="Placement funnel" actions={<Link href="/placements" className="text-xs text-brand">Placements →</Link>}>
          <Funnel stages={[
            { label: "Applications", value: applied, color: "linear-gradient(90deg,#6366f1,#818cf8)" },
            { label: "Shortlisted + selected", value: appCount("SHORTLISTED") + appCount("SELECTED"), color: "linear-gradient(90deg,#8b5cf6,#c084fc)" },
            { label: "Offers", value: appCount("SELECTED"), color: "linear-gradient(90deg,#db2777,#f472b6)" },
          ]} />
          <ul className="mt-5 space-y-2 border-t border-line pt-4">
            {drives.map((d) => (
              <li key={d.id} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-bold text-brand">{d.company.name[0]}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.company.name}</span><span className="block truncate text-xs text-muted">{d.role} · {d.ctcLpa} LPA</span></span>
                <Badge tone={d.status === "OPEN" ? "success" : "info"}>{titleCase(d.status)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent activity" actions={user.role === "ADMIN" && <Link href="/admin/audit" className="text-xs text-brand">Audit log →</Link>}>
          <ol className="relative space-y-4 border-l border-line pl-5">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1 -left-[25px] size-2.5 rounded-full bg-brand ring-4 ring-surface" />
                <p className="text-sm"><span className="font-medium">{a.user?.name ?? "System"}</span> <span className="text-muted">{a.action.toLowerCase().replace(/_/g, " ")}</span> {a.entity}</p>
                <p className="text-xs text-muted">{a.details ? `${a.details} · ` : ""}{fmtDateTime(a.createdAt)}</p>
              </li>
            ))}
            {activity.length === 0 && <li className="text-sm text-muted">No recent activity.</li>}
          </ol>
        </Card>
      </div>}

      {show("notices") && <div className="mt-6"><RecentNotices audiences={["ALL", "FACULTY", "STUDENTS"]} /></div>}
      {insights && <Link href="/academics" className="mt-6 inline-flex items-center gap-1 text-sm text-brand">Manage academic structure <ArrowRight className="size-4" /></Link>}
    </>
  );
}
