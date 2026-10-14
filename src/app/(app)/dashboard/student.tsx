import { Suspense } from "react";
import { banner } from "@/lib/images";
import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { Award, ClipboardCheck, Wallet, AlertTriangle, Briefcase, CalendarDays, FileText } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { attendanceSummary } from "@/lib/attendance";
import { getRules, toneFor } from "@/lib/rules";
import { studentStandings } from "@/lib/results";
import { invoiceStatus } from "@/lib/fees";
import { ineligibility } from "@/lib/placements";
import { gpa } from "@/lib/grading";
import { greeting, termProgress } from "@/lib/insights";
import { batchLabel, fmtDate, inr, pct } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Badge, DashboardBodySkeleton, TasksSkeleton } from "@/components/ui";
import { Card, StatCard } from "@/components/ui-server";
import { GpaTrend } from "@/components/charts";
import { Gauge } from "@/components/infographics";
import { GraduationIllustration } from "@/components/illustrations";
import { MyTasks } from "@/components/my-tasks";
import { Hero, HeroAction, TermProgress } from "@/components/hero";
import { RecentNotices, TodaySchedule } from "./widgets";

async function StudentHero({ user }: { user: CurrentUser }) {
  const [term, student] = await Promise.all([currentTerm(), db.student.findUniqueOrThrow({ where: { id: user.studentId ?? "-" }, select: { rollNo: true, user: { select: { id: true, name: true, photoType: true } }, batch: { include: { program: true } } } })]);
  const parent = user.role === "PARENT";
  return (
    <Hero
      eyebrow={`${student.rollNo} · ${batchLabel(student.batch)} · Semester ${student.batch.currentSemester}`}
      title={`${greeting(user.name)} 👋`}
      subtitle={parent ? <>You are viewing <b>{student.user.name}</b>&apos;s record · {student.batch.program.name}</> : student.batch.program.name}
      {...banner(parent ? "hero-parent" : "hero-student")}
      art={<GraduationIllustration className="w-full [--brand-soft:rgba(255,255,255,.15)] [--brand:#ffffff] [--brand-2:#c7d2fe] [--surface:rgba(255,255,255,.9)] [--line:rgba(255,255,255,.3)]" />}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={student.user.name} userId={student.user.id} hasPhoto={!!student.user.photoType} size={56} className="ring-line" />
        <TermProgress {...termProgress(term)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <HeroAction href="/results"><FileText className="size-4" /> Grade card</HeroAction>
        <HeroAction href="/timetable"><CalendarDays className="size-4" /> Timetable</HeroAction>
        {!parent && <HeroAction href="/placements"><Briefcase className="size-4" /> Placements</HeroAction>}
      </div>
    </Hero>
  );
}

export function StudentDashboard({ user }: { user: CurrentUser }) {
  return (
    <>
      <StudentHero user={user} />
      <Suspense fallback={<TasksSkeleton />}><MyTasks user={user} /></Suspense>
      <Suspense fallback={<DashboardBodySkeleton />}><StudentBody user={user} /></Suspense>
    </>
  );
}

async function StudentBody({ user }: { user: CurrentUser }) {
  const rules = await getRules();
  const { attendanceRequired: ATTENDANCE_REQUIRED } = rules;
  const attendanceTone = toneFor(rules);
  const t = await getT();
  const term = await currentTerm();
  const student = await db.student.findUniqueOrThrow({
    where: { id: user.studentId ?? "-" },
    include: { user: { select: { id: true, name: true, photoType: true } }, batch: { include: { program: true } }, invoices: { include: { payments: true, instalments: true } } },
  });
  const offerings = await db.courseOffering.findMany({ where: { batchId: student.batchId, termId: term?.id }, include: { subject: true, faculty: { include: { user: { select: { name: true } } } } } });
  const [summary, standings, slots, results, drives] = await Promise.all([
    attendanceSummary({ studentIds: [student.id], offeringIds: offerings.map((o) => o.id) }),
    studentStandings([student.id]),
    db.timetableSlot.findMany({
      where: { batchId: student.batchId, dayOfWeek: new Date().getDay(), offering: { termId: term?.id } },
      include: { offering: { include: { subject: true } } }, orderBy: { period: "asc" },
    }),
    db.subjectResult.findMany({ where: { studentId: student.id }, include: { offering: { include: { term: true, subject: { select: { semester: true } } } } } }),
    db.placementDrive.findMany({ where: { status: "OPEN" }, include: { company: true }, orderBy: { driveDate: "asc" } }),
  ]);
  const st = standings.get(student.id)!;
  const parent = user.role === "PARENT";
  const totals = [...summary.values()].reduce((a, v) => ({ a: a.a + v.attended, t: a.t + v.total }), { a: 0, t: 0 });
  const overall = pct(totals.a, totals.t);
  const fee = student.invoices.reduce((acc, i) => { const s = invoiceStatus(i); return { due: acc.due + s.balance, paid: acc.paid + s.paid, payable: acc.payable + s.payable }; }, { due: 0, paid: 0, payable: 0 });
  const canMiss = Math.max(0, Math.floor(totals.a / (ATTENDANCE_REQUIRED / 100) - totals.t));
  const mustAttend = Math.max(0, Math.ceil(((ATTENDANCE_REQUIRED / 100) * totals.t - totals.a) / (1 - ATTENDANCE_REQUIRED / 100)));
  const bySem = new Map<number, typeof results>();
  for (const r of results) bySem.set(r.offering.subject.semester, [...(bySem.get(r.offering.subject.semester) ?? []), r]);
  const sgpaTrend = [...bySem].sort((a, b) => a[0] - b[0]).map(([sem, rows]) => ({ label: `Sem ${sem}`, value: gpa(rows) }));
  const eligibleDrives = drives.filter((d) => !ineligibility(d, student, st, rules.placementSemestersLeft));

  return (
    <>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t("Overall attendance")} value={`${overall}%`} tone={attendanceTone(overall)} icon={<ClipboardCheck className="size-5" />} href="/attendance"
          hint={overall >= ATTENDANCE_REQUIRED ? `You can miss ${canMiss} more classes` : `Attend the next ${mustAttend} classes to reach ${ATTENDANCE_REQUIRED}%`} />
        <StatCard label="CGPA" value={st.cgpa.toFixed(2)} icon={<Award className="size-5" />} tone="info" href="/results" hint={`${st.creditsEarned} credits earned`} />
        <StatCard label={t("Active backlogs")} value={st.backlogs} tone={st.backlogs ? "danger" : "success"} icon={<AlertTriangle className="size-5" />} href={st.backlogs && !parent ? "/exams/supplementary" : "/results"} hint={st.backlogs ? "Register for supplementary exams" : "All clear — keep it up!"} />
        <StatCard label={t("Fee due")} value={inr(fee.due)} tone={fee.due ? "warning" : "success"} icon={<Wallet className="size-5" />} href="/fees" hint={fee.due ? "Pay before the due date to avoid fine" : "Fully paid for 2026-27"} />
      </div>

      {/* Today's classes first: it is what a student opens the app for most days. Each number above opens its page,
          so attendance and fees are not repeated below. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <TodaySchedule slots={slots} />
        <Card title={t("Subject-wise attendance")} className="lg:col-span-2" actions={<Link href="/attendance" className="text-xs text-brand">Details →</Link>}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {offerings.map((o) => {
              const v = summary.get(`${student.id}:${o.id}`) ?? { attended: 0, total: 0 };
              const p = pct(v.attended, v.total);
              return (
                <li key={o.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <Gauge value={v.total ? p : 0} size={56} tone={v.total ? attendanceTone(p) : "neutral"}><span className="text-[11px] font-semibold tabular-nums">{v.total ? `${Math.round(p)}%` : "—"}</span></Gauge>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.subject.name}</p>
                    <p className="truncate text-xs text-muted">{o.faculty?.user.name ?? "TBA"}</p>
                    <p className="text-xs text-muted tabular-nums">{v.total ? `${v.attended}/${v.total} attended` : "No classes yet"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t("Academic progress · SGPA by semester")} className="lg:col-span-2" actions={<Badge tone="brand">CGPA {st.cgpa.toFixed(2)}</Badge>}>
          {sgpaTrend.length ? <GpaTrend data={sgpaTrend} /> : <p className="text-sm text-muted">Results will appear after your first semester.</p>}
        </Card>
        <Card className="lg:col-span-1" title={parent ? "Open placement drives (eligible)" : "Open placement drives for you"} actions={!parent && <Link href="/placements" className="text-xs text-brand">All drives →</Link>}>
          {eligibleDrives.length === 0 ? <p className="text-sm text-muted">No open drives match your eligibility right now.</p> : (
            <ul className="space-y-3">
              {eligibleDrives.map((d) => (
                <li key={d.id} className="flex items-center gap-3">
                  <span className="chip size-10 text-sm font-semibold">{d.company.name[0]}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.company.name} · {d.role}</p><p className="text-xs text-muted">{d.ctcLpa} LPA · drive on {fmtDate(d.driveDate)}</p></div>
                  <Badge tone="success">Eligible</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-6"><RecentNotices audiences={["ALL", "STUDENTS"]} /></div>
    </>
  );
}
