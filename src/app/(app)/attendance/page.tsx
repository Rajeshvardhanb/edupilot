import { getT } from "@/lib/i18n-server";
import { learnerId } from "@/lib/learner";
import Link from "next/link";
import { FileWarning } from "lucide-react";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { AttendanceHeatmap } from "@/components/attendance-heatmap";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { attendanceSummary } from "@/lib/attendance";
import { getRules, toneFor } from "@/lib/rules";
import { classesToReach } from "@/lib/grading";
import { batchLabel, fmtDate, isoDate, pct, titleCase } from "@/lib/format";
import { Badge, LinkButton, Progress, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "STUDENT", "PARENT"]);
  return user.role === "STUDENT" || user.role === "PARENT" ? <StudentAttendance user={user} /> : <StaffAttendance user={user} />;
}

async function StaffAttendance({ user }: { user: CurrentUser }) {
  const rules = await getRules();
  const { attendanceRequired: ATTENDANCE_REQUIRED } = rules;
  const attendanceTone = toneFor(rules);
  const term = await currentTerm();
  const offerings = await db.courseOffering.findMany({
    where: { ...offeringScope(user), termId: term?.id },
    include: { subject: true, faculty: { include: { user: true } }, batch: { include: { program: true } }, sessions: { select: { date: true }, orderBy: { date: "desc" }, take: 1 }, _count: { select: { sessions: true } } },
    orderBy: [{ batch: { program: { code: "asc" } } }, { subject: { code: "asc" } }],
  });
  const summary = await attendanceSummary({ offeringIds: offerings.map((o) => o.id) });
  const agg = new Map<string, { a: number; t: number; short: number }>();
  for (const [k, v] of summary) {
    const oid = k.split(":")[1];
    const x = agg.get(oid) ?? { a: 0, t: 0, short: 0 };
    x.a += v.attended; x.t += v.total;
    if (pct(v.attended, v.total) < ATTENDANCE_REQUIRED) x.short++;
    agg.set(oid, x);
  }
  const today = isoDate(new Date());
  return (
    <>
      <PageHeader title="Attendance" subtitle={`${term?.name} · ${offerings.length} courses`} actions={<>{user.role !== "FACULTY" && <LinkButton variant="secondary" href="/attendance/substitutions">Substitute classes</LinkButton>}<LinkButton variant="secondary" href="/attendance/report"><FileWarning className="size-4" /> Shortage report</LinkButton></>} />
      <Card>
        {offerings.length === 0 ? <EmptyState title="No courses allocated" action={(user.role === "ADMIN" || user.role === "HOD") && <LinkButton variant="secondary" href="/academics/allocation">Allocate courses</LinkButton>}>Attendance is marked per course. Courses appear here once they are created for this term and given a teacher.</EmptyState> : (
          <Table>
            <thead><tr><Th>Subject</Th><Th>Batch</Th>{user.role !== "FACULTY" && <Th>Faculty</Th>}<Th className="text-right">Classes</Th><Th>Last taken</Th><Th>Average</Th><Th className="text-right">{`Below ${ATTENDANCE_REQUIRED}%`}</Th><Th /></tr></thead>
            <tbody>
              {offerings.map((o) => {
                const x = agg.get(o.id);
                const p = x ? pct(x.a, x.t) : 0;
                return (
                  <tr key={o.id}>
                    <Td><p className="font-medium">{o.subject.name}</p><p className="text-xs text-muted">{o.subject.code} · {titleCase(o.subject.type)}</p></Td>
                    <Td className="whitespace-nowrap">{batchLabel(o.batch)}</Td>
                    {user.role !== "FACULTY" && <Td>{o.faculty?.user.name ?? <Badge tone="warning">Unassigned</Badge>}</Td>}
                    <Td className="text-right">{o._count.sessions}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(o.sessions[0]?.date)}</Td>
                    <Td className="w-32"><div className="flex items-center gap-2"><Progress value={p} tone={attendanceTone(p)} /><span className="text-xs tabular-nums">{p}%</span></div></Td>
                    <Td className="text-right">{x?.short ? <Badge tone="danger">{x.short}</Badge> : "—"}</Td>
                    <Td><LinkButton size="sm" href={`/attendance/${o.id}?date=${today}`}>Mark</LinkButton></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

async function StudentAttendance({ user }: { user: CurrentUser }) {
  const rules = await getRules();
  const { attendanceRequired: ATTENDANCE_REQUIRED, attendanceCondonable: ATTENDANCE_CONDONABLE } = rules;
  const attendanceTone = toneFor(rules);
  const t = await getT();
  const term = await currentTerm();
  const student = await db.student.findUniqueOrThrow({ where: { id: learnerId(user) } });
  const offerings = await db.courseOffering.findMany({ where: { batchId: student.batchId, termId: term?.id }, include: { subject: true, faculty: { include: { user: true } } } });
  const summary = await attendanceSummary({ studentIds: [student.id], offeringIds: offerings.map((o) => o.id) });
  const absences = await db.attendanceRecord.findMany({
    where: { studentId: student.id, status: "ABSENT", session: { offering: { termId: term?.id } } },
    include: { session: { include: { offering: { include: { subject: true } } } } },
    orderBy: { session: { date: "desc" } }, take: 20,
  });
  const totals = [...summary.values()].reduce((a, v) => ({ a: a.a + v.attended, t: a.t + v.total }), { a: 0, t: 0 });
  const overall = pct(totals.a, totals.t);
  return (
    <>
      <PageHeader title={t("My attendance")} subtitle={`${term?.name} · overall ${overall}% (${totals.a}/${totals.t} classes)`} />
      {overall < ATTENDANCE_REQUIRED && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          Your attendance is below {ATTENDANCE_REQUIRED}%. You may be detained from end-semester exams. Attend regularly or apply for condonation ({ATTENDANCE_CONDONABLE}–{ATTENDANCE_REQUIRED}%) with supporting documents.
        </div>
      )}
      {term && <Card title={t("Attendance calendar")} className="mb-6"><AttendanceHeatmap studentId={student.id} termId={term.id} from={term.startDate} to={term.endDate} /></Card>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("Subject-wise")} className="lg:col-span-2">
          <Table>
            <thead><tr><Th>{t("Subject")}</Th><Th>{t("Faculty")}</Th><Th className="text-right">{t("Attended")}</Th><Th className="w-40">{t("Percentage")}</Th><Th>{t("Status")}</Th></tr></thead>
            <tbody>
              {offerings.map((o) => {
                const v = summary.get(`${student.id}:${o.id}`) ?? { attended: 0, total: 0 };
                const p = pct(v.attended, v.total);
                const need = classesToReach(ATTENDANCE_REQUIRED, v.attended, v.total);
                return (
                  <tr key={o.id}>
                    <Td><p className="font-medium">{o.subject.name}</p><p className="text-xs text-muted">{o.subject.code}</p></Td>
                    <Td>{o.faculty?.user.name ?? "—"}</Td>
                    <Td className="text-right tabular-nums">{v.attended}/{v.total}</Td>
                    <Td><div className="flex items-center gap-2"><Progress value={p} tone={attendanceTone(p)} /><span className="text-xs tabular-nums">{p}%</span></div></Td>
                    <Td>{!v.total ? <Badge>No classes yet</Badge> : p >= ATTENDANCE_REQUIRED ? <Badge tone="success">OK</Badge> : <Badge tone={attendanceTone(p)}>{Number.isFinite(need) ? `Attend ${need} more` : "Below the rule"}</Badge>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        <Card title={t("Recent absences")}>
          {absences.length === 0 ? <p className="text-sm text-muted">No absences. 🎉</p> : (
            <ul className="space-y-2 text-sm">
              {absences.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.session.offering.subject.name}</span><span className="text-xs whitespace-nowrap text-muted">{fmtDate(a.session.date)} · P{a.session.period}</span></li>)}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Contact your faculty within 3 days if any entry is wrong. <Link href="/notices" className="text-brand">Notices</Link></p>
        </Card>
      </div>
    </>
  );
}
