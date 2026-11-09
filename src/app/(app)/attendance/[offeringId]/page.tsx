import { getRules } from "@/lib/rules";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { offeringScope } from "@/lib/scope";
import { attendanceSummary } from "@/lib/attendance";
import { deleteSession } from "@/actions/teaching";
import { batchLabel, fmtDate, isoDate, pct } from "@/lib/format";
import { ActionButton } from "@/components/forms";
import { Badge, buttonClass } from "@/components/ui";
import { Card, PageHeader } from "@/components/ui-server";
import { AttendanceSheet } from "./sheet";
import { holidayOn } from "@/lib/attendance-core";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const metadata = { title: "Mark attendance" };

export default async function MarkAttendancePage(props: PageProps<"/attendance/[offeringId]">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const rules = await getRules();
  const { offeringId } = await props.params;
  const sp = await props.searchParams;
  const offering = await db.courseOffering.findFirst({
    where: { id: offeringId, ...offeringScope(user) },
    include: { subject: true, term: true, faculty: { include: { user: true } }, batch: { include: { program: true, students: { where: { status: { in: ["ACTIVE", "DETAINED"] } }, include: { user: true }, orderBy: { rollNo: "asc" } } } } },
  });
  if (!offering) notFound();

  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDate(new Date());
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const slots = await db.timetableSlot.findMany({ where: { offeringId, dayOfWeek: dow }, orderBy: { period: "asc" } });
  const period = Number(sp.period) || slots[0]?.period || 1;

  const day = new Date(`${date}T00:00:00Z`);
  const [holiday, leaves] = await Promise.all([
    holidayOn(day),
    db.leaveRequest.findMany({ where: { status: "APPROVED", fromDate: { lte: day }, toDate: { gte: day }, student: { batchId: offering.batchId } }, select: { studentId: true, type: true } }),
  ]);
  const [existing, sessions, summary] = await Promise.all([
    db.attendanceSession.findUnique({ where: { offeringId_date_period: { offeringId, date: new Date(`${date}T00:00:00Z`), period } }, include: { records: true } }),
    db.attendanceSession.findMany({ where: { offeringId }, include: { records: { select: { status: true } } }, orderBy: [{ date: "desc" }, { period: "desc" }], take: 15 }),
    attendanceSummary({ offeringIds: [offeringId] }),
  ]);
  const students = offering.batch.students
    .filter((s) => offering.subject.semester >= s.entrySemester)
    .map((s) => {
      const v = summary.get(`${s.id}:${offeringId}`);
      return { id: s.id, userId: s.userId, hasPhoto: !!s.user.photoType, photoVersion: String(s.user.updatedAt.getTime()), rollNo: s.rollNo, name: s.user.name, pct: v ? pct(v.attended, v.total) : 100 };
    });
  const total = await db.attendanceSession.count({ where: { offeringId } });

  return (
    <>
      <Breadcrumbs items={[{ label: "Attendance", href: "/attendance" }, { label: offering.subject.name }]} />
      <PageHeader title={offering.subject.name} subtitle={`${offering.subject.code} · ${batchLabel(offering.batch)} · ${offering.faculty?.user.name ?? "No faculty"} · ${total} classes held`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={existing ? <span>Editing attendance <Badge tone="info">already marked</Badge></span> : "Mark attendance"}>
          <form className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="date">Date</label>
              <input id="date" type="date" name="date" defaultValue={date} max={isoDate(new Date())} min={isoDate(offering.term.startDate)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="period">Period</label>
              <select id="period" name="period" defaultValue={period} className="input">
                {[1, 2, 3, 4, 5, 6, 7].map((p) => <option key={p} value={p}>P{p}{slots.some((s) => s.period === p) ? " (scheduled)" : ""}</option>)}
              </select>
            </div>
            <button className={buttonClass("secondary")}>Load</button>
            {slots.length === 0 && <span className="text-xs text-warning">Not scheduled on this day in the timetable.</span>}
          </form>
          {holiday && <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{fmtDate(day)} is a holiday ({holiday.title}). Attendance cannot be marked.</p>}
          <AttendanceSheet
            key={`${date}-${period}`} label={`${offering.subject.code} · ${fmtDate(day)} P${period}`}
            leave={Object.fromEntries(leaves.map((l) => [l.studentId, l.type === "ON_DUTY" ? "ON_DUTY" : "LEAVE"]))}
            offeringId={offeringId} date={date} period={period} topic={existing?.topic ?? ""} students={students} required={rules.attendanceRequired} condonable={rules.attendanceCondonable}
            initial={Object.fromEntries((existing?.records ?? []).map((r) => [r.studentId, r.status]))}
          />
        </Card>
        <Card title="Recent classes" className="h-fit">
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => {
              const present = s.records.filter((r) => r.status !== "ABSENT").length;
              return (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <Link href={`/attendance/${offeringId}?date=${isoDate(s.date)}&period=${s.period}`} className="min-w-0 hover:text-brand">
                    <span className="block">{fmtDate(s.date)} · P{s.period}</span>
                    {s.topic && <span className="block truncate text-xs text-muted">{s.topic}</span>}
                  </Link>
                  <span className="flex items-center gap-1">
                    <Badge tone="neutral">{present}/{s.records.length}</Badge>
                    <ActionButton action={deleteSession} fields={{ id: s.id }} variant="ghost" confirm="Delete this class record?">×</ActionButton>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
