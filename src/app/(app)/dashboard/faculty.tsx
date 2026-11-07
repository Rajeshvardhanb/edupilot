import { Suspense } from "react";
import { banner } from "@/lib/images";
import Link from "next/link";
import { BookOpen, ClipboardCheck, Users, AlertTriangle, FileSpreadsheet, CalendarDays, Megaphone } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { attendanceSummary } from "@/lib/attendance";
import { getRules, toneFor } from "@/lib/rules";
import { dailyAttendance, greeting, termProgress } from "@/lib/insights";
import { batchLabel, isoDate, pct, titleCase } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Badge, DashboardBodySkeleton, TasksSkeleton } from "@/components/ui";
import { Card, StatCard } from "@/components/ui-server";
import { Sparkline, TrendChart } from "@/components/charts";
import { Gauge } from "@/components/infographics";
import { ScheduleIllustration } from "@/components/illustrations";
import { MyTasks } from "@/components/my-tasks";
import { Hero, HeroAction, TermProgress } from "@/components/hero";
import { NowCard, RecentNotices, TodaySchedule } from "./widgets";

async function FacultyHero({ user }: { user: CurrentUser }) {
  const term = await currentTerm();
  const mine = { facultyId: user.facultyId ?? "-", termId: term?.id };
  const [slots, courses] = await Promise.all([
    db.timetableSlot.findMany({ where: { dayOfWeek: new Date().getDay(), offering: mine }, include: { offering: { include: { subject: true, batch: { include: { program: true, _count: { select: { students: true } } } } } } } }),
    db.courseOffering.count({ where: mine }),
  ]);
  const classes = slots.length;
  return (
    <Hero
      phone={<>
        <p className="mb-3 text-[1.35rem] font-bold">{greeting(user.name)}</p>
        <NowCard teacher slots={slots} students={slots[0]?.offering.batch._count.students} />
      </>}
      eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
      title={greeting(user.name)}
      subtitle={<>You have <b>{classes}</b> class{classes === 1 ? "" : "es"} today across <b>{courses}</b> courses · {term?.name}</>}
      {...banner("hero-faculty")}
      art={<ScheduleIllustration className="w-full [--surface:rgba(255,255,255,.95)] [--brand-soft:rgba(199,210,254,.6)] [--line:rgba(255,255,255,.4)]" />}
    >
      <TermProgress {...termProgress(term)} />
      <div className="mt-5 flex flex-wrap gap-2">
        <HeroAction primary href="/attendance"><ClipboardCheck className="size-4" /> Take attendance</HeroAction>
        <HeroAction href="/exams"><FileSpreadsheet className="size-4" /> Enter marks</HeroAction>
        <HeroAction href="/timetable"><CalendarDays className="size-4" /> My timetable</HeroAction>
        <HeroAction href="/notices"><Megaphone className="size-4" /> Post notice</HeroAction>
      </div>
    </Hero>
  );
}

export function FacultyDashboard({ user }: { user: CurrentUser }) {
  return (
    <>
      <FacultyHero user={user} />
      <Suspense fallback={<TasksSkeleton />}><MyTasks user={user} /></Suspense>
      <Suspense fallback={<DashboardBodySkeleton />}><FacultyBody user={user} /></Suspense>
    </>
  );
}

async function FacultyBody({ user }: { user: CurrentUser }) {
  const rules = await getRules();
  const { attendanceRequired: ATTENDANCE_REQUIRED } = rules;
  const attendanceTone = toneFor(rules);
  const term = await currentTerm();
  const offerings = await db.courseOffering.findMany({
    where: { facultyId: user.facultyId ?? "-", termId: term?.id },
    include: {
      subject: true,
      batch: { include: { program: true, students: { where: { status: "ACTIVE" }, include: { user: { select: { name: true, photoType: true, id: true } } } } } },
      _count: { select: { sessions: true } },
    },
  });
  const ids = offerings.map((o) => o.id);
  const [slots, summary, daily] = await Promise.all([
    db.timetableSlot.findMany({
      where: { dayOfWeek: new Date().getDay(), offering: { facultyId: user.facultyId ?? "-", termId: term?.id } },
      include: { offering: { include: { subject: true, batch: { include: { program: true } } } } },
      orderBy: { period: "asc" },
    }),
    attendanceSummary({ offeringIds: ids }),
    dailyAttendance(ids, 30),
  ]);
  const perOffering = new Map<string, { a: number; t: number; short: number }>();
  const atRisk: { name: string; userId: string; hasPhoto: boolean; subject: string; p: number; studentId: string }[] = [];
  for (const o of offerings) {
    const x = { a: 0, t: 0, short: 0 };
    for (const s of o.batch.students) {
      const v = summary.get(`${s.id}:${o.id}`);
      if (!v) continue;
      x.a += v.attended; x.t += v.total;
      const p = pct(v.attended, v.total);
      if (p < ATTENDANCE_REQUIRED) { x.short++; atRisk.push({ name: s.user.name, userId: s.user.id, hasPhoto: !!s.user.photoType, subject: o.subject.code, p, studentId: s.id }); }
    }
    perOffering.set(o.id, x);
  }
  atRisk.sort((a, b) => a.p - b.p);
  const students = new Set(offerings.flatMap((o) => o.batch.students.map((s) => s.id))).size;
  const all = [...perOffering.values()].reduce((s, v) => ({ a: s.a + v.a, t: s.t + v.t }), { a: 0, t: 0 });
  const today = isoDate(new Date());

  return (
    <>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard href="/attendance" label="Courses this term" value={offerings.length} icon={<BookOpen className="size-5" />} hint={`${offerings.reduce((s, o) => s + o._count.sessions, 0)} classes held`} />
        <StatCard label="Students taught" value={students} icon={<Users className="size-5" />} tone="info" hint={`${new Set(offerings.map((o) => o.batchId)).size} batches`} />
        <StatCard href="/attendance/report" label="Avg. attendance" value={`${pct(all.a, all.t)}%`} icon={<ClipboardCheck className="size-5" />} tone="success" chart={<Sparkline data={daily.slice(-14).map((d) => d.value)} color="var(--success)" />} />
        <StatCard href="/attendance/report" label={`Students below ${ATTENDANCE_REQUIRED}%`} value={atRisk.length} icon={<AlertTriangle className="size-5" />} tone="danger" hint="subject-wise, across your courses" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="My courses">
            <div className="grid gap-4 sm:grid-cols-2">
              {offerings.map((o) => {
                const v = perOffering.get(o.id)!;
                const p = pct(v.a, v.t);
                return (
                  <div key={o.id} className="rounded-[var(--radius-card)] border border-line p-4 transition hover:border-brand/40 hover:shadow-lift">
                    <div className="flex items-start gap-3">
                      <Gauge value={v.t ? p : 0} size={64} tone={v.t ? attendanceTone(p) : "neutral"}><span className="text-xs font-semibold tabular-nums">{v.t ? `${Math.round(p)}%` : "—"}</span></Gauge>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{o.subject.name}</p>
                        <p className="text-xs text-muted">{o.subject.code} · {titleCase(o.subject.type)}</p>
                        <p className="mt-1 text-xs"><Badge tone="brand">{batchLabel(o.batch)}</Badge> <span className="text-muted">{o._count.sessions} classes</span></p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
                      {!v.t ? <span className="text-muted">No classes yet</span> : v.short ? <span className="text-danger">{v.short} below {ATTENDANCE_REQUIRED}%</span> : <span className="text-success">Everyone on track</span>}
                      <span className="flex gap-3">
                        <Link className="font-medium text-brand" href={`/attendance/${o.id}?date=${today}`}>Attendance</Link>
                        <Link className="font-medium text-brand" href={`/exams/${o.id}`}>Marks</Link>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {offerings.length === 0 && <p className="text-sm text-muted">No courses allocated to you this term.</p>}
          </Card>
          <Card title="Class attendance — last 30 days">
            <TrendChart unit="%" domain={[50, 100]} height={220} data={daily.map((d) => ({ label: d.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }), value: d.value }))} />
          </Card>
        </div>
        <div className="space-y-6">
          <TodaySchedule slots={slots} showBatch />
          <Card title="Students needing attention" actions={<Link href="/attendance/report" className="text-xs text-brand">Report →</Link>}>
            {atRisk.length === 0 ? <p className="text-sm text-muted">No attendance shortages. 🎉</p> : (
              <ul className="space-y-3">
                {atRisk.slice(0, 7).map((r) => (
                  <li key={`${r.studentId}${r.subject}`}>
                    <Link href={`/students/${r.studentId}`} className="flex items-center gap-3 rounded-lg hover:bg-surface-2">
                      <Avatar name={r.name} userId={r.userId} hasPhoto={r.hasPhoto} size={32} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.name}</span><span className="text-xs text-muted">{r.subject}</span></span>
                      <Badge tone={attendanceTone(r.p)}>{r.p}%</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <div className="mt-6"><RecentNotices audiences={["ALL", "FACULTY"]} /></div>
    </>
  );
}
