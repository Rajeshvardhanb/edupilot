import { MyTasks } from "@/components/my-tasks";
import { AcademicWelcome } from "@/components/academic-welcome";
import { Gauge } from "@/components/infographics";
import { ROLE_LABEL } from "@/components/nav";
import { Badge,LinkButton } from "@/components/ui";
import { Card,EmptyState,StatCard } from "@/components/ui-server";
import { attendanceSummary } from "@/lib/attendance";
import { isLearner,requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchLabel,fmtDate,pct } from "@/lib/format";
import { studentStandings } from "@/lib/results";
import { currentTerm,offeringScope,studentScope } from "@/lib/scope";
import Link from "next/link";
import { TodaySchedule } from "./widgets";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const { denied } = await props.searchParams;
  const term = await currentTerm();
  const learner = isLearner(user);
  const academicStaff = ["ADMIN", "HOD", "FACULTY"].includes(user.role);
  if (learner && !user.studentId) return <EmptyState title="No student linked">Ask the administrator to link a student record.</EmptyState>;
  const student = learner ? await db.student.findUnique({ where: { id: user.studentId! }, include: { batch: { include: { program: true } }, user: { select: { name: true } } } }) : null;
  const scope = studentScope(user);
  const courses = student ? { batchId: student.batchId, termId: term?.id } : { ...offeringScope(user), termId: term?.id };
  const offerings = academicStaff || student ? await db.courseOffering.findMany({ where: courses, include: { subject: true } }) : [];
  const summary = academicStaff || student ? await attendanceSummary({ offeringIds: offerings.map((o) => o.id), ...(student ? { studentIds: [student.id] } : {}) }) : new Map<string, { attended: number; total: number }>();
  const total = [...summary.values()].reduce((a, v) => ({ a: a.a + v.attended, t: a.t + v.total }), { a: 0, t: 0 });
  const standing = student ? (await studentStandings([student.id])).get(student.id) : null;
  const [students, active, drives, slots, events] = await Promise.all([
    learner ? 0 : db.student.count({ where: scope }),
    learner ? 0 : db.student.count({ where: { AND: [scope, { status: "ACTIVE" }] } }),
    student || academicStaff ? db.placementDrive.findMany({ where: { status: "OPEN" }, include: { company: true }, orderBy: { driveDate: "asc" }, take: 4 }) : [],
    student || user.facultyId ? db.timetableSlot.findMany({ where: { dayOfWeek: new Date().getUTCDay(), ...(student ? { batchId: student.batchId } : {}), offering: { termId: term?.id, ...(!student ? { facultyId: user.facultyId! } : {}) } }, include: { offering: { include: { subject: true } } }, orderBy: { period: "asc" } }) : [],
    db.calendarEvent.findMany({ where: { date: { gte: new Date(new Date().toISOString().slice(0, 10)) } }, orderBy: { date: "asc" }, take: 5 }),
  ]);
  return <>
    {denied && <p role="alert" className="mb-4 rounded-xl bg-warning-soft p-3 text-sm">You don&apos;t have access to that page.</p>}
    <AcademicWelcome title={`Welcome, ${user.name}`} subtitle={`${ROLE_LABEL[user.role]} · ${term?.name ?? "No current term"}${student ? ` · ${student.user.name} · ${batchLabel(student.batch)}` : ""}`} />
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {standing ? <>
        <StatCard label="CGPA" value={standing.cgpa.toFixed(2)} href="/results" />
        <StatCard label="Active backlogs" value={standing.backlogs} href="/results" tone={standing.backlogs ? "warning" : "success"} />
      </> : <>
        <StatCard label="Students" value={students} href="/students" />
        <StatCard label="Active students" value={active} href="/students?status=ACTIVE" tone="success" />
      </>}
      {(academicStaff || learner) && <>
        <StatCard label="Current courses" value={offerings.length} tone="info" href={learner ? "/timetable" : "/exams"} />
        <StatCard label="Attendance" value={total.t ? `${pct(total.a, total.t)}%` : "—"} tone="warning" href={learner ? "/attendance" : "/attendance/report"} />
      </>}
    </div>
    <MyTasks user={user} />
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {(academicStaff || learner) && <Card title="Academic overview" actions={<Link href={learner ? "/attendance" : "/attendance/report"} className="text-xs font-semibold text-brand">View attendance →</Link>}>
        {total.t ? <div className="flex flex-wrap items-center justify-center gap-6 py-2 sm:justify-start">
          <Gauge value={pct(total.a, total.t)} label="Attendance" size={124} />
          <div className="min-w-0 flex-1 space-y-3 text-sm">
            <p className="text-xs text-muted">Recorded attendance · {term?.name ?? "Current term"}</p>
            <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-success" />Attended</span><b className="tabular-nums">{total.a.toLocaleString("en-IN")}</b></p>
            <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-danger" />Absent</span><b className="tabular-nums">{(total.t - total.a).toLocaleString("en-IN")}</b></p>
            <p className="border-t border-line pt-2 text-xs text-muted">{student ? "Your linked student's attendance records" : "Attendance records across your permitted courses"}</p>
          </div>
        </div> : <p className="py-5 text-sm text-muted">No attendance recorded for the selected courses yet.</p>}
      </Card>}
      <Card title="Quick links"><div className="flex flex-wrap gap-3">
        {learner ? <><LinkButton href="/results">Student results</LinkButton><LinkButton href="/attendance">Attendance</LinkButton><LinkButton href="/timetable">Timetable</LinkButton></> : <><LinkButton href="/students">Students</LinkButton>{["ADMIN", "OFFICE"].includes(user.role) && <LinkButton href="/students/new">Register student</LinkButton>}{academicStaff && <LinkButton href="/exams">Marks management</LinkButton>}</>}
        <LinkButton variant="secondary" href="/calendar">Calendar</LinkButton>
      </div></Card>
      {(student || user.facultyId) && <TodaySchedule slots={slots} />}
      {(student || academicStaff) && <Card title="Open placement drives" actions={user.role !== "PARENT" && <Link href="/placements" className="text-sm text-brand">View drives →</Link>}>
        {drives.length ? <ul className="space-y-3">{drives.map((d) => <li key={d.id}><p className="font-medium">{d.company.name} — {d.role}</p><p className="text-sm text-muted">{fmtDate(d.driveDate)} · {d.ctcLpa} LPA</p></li>)}</ul> : <p className="text-sm text-muted">No open drives.</p>}
      </Card>}
      <Card title="Upcoming academic events">{events.length ? <ul className="space-y-3">{events.map((e) => <li key={e.id} className="flex items-center justify-between gap-3"><span>{e.title}<span className="block text-xs text-muted">{fmtDate(e.date)}</span></span><Badge>{e.type}</Badge></li>)}</ul> : <p className="text-sm text-muted">No upcoming events.</p>}</Card>
    </div>
  </>;
}
