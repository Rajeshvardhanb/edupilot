import { AttendanceHeatmap } from "@/components/attendance-heatmap";
import { Badge,LinkButton,Progress,Ring,Td } from "@/components/ui";
import { Card,EmptyState,PageHeader,Table,Th } from "@/components/ui-server";
import { attendanceSummary } from "@/lib/attendance";
import { requireUser,type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchLabel,fmtDate,isoDate,pct,titleCase } from "@/lib/format";
import { classesToReach } from "@/lib/grading";
import { getT } from "@/lib/i18n-server";
import { learnerId } from "@/lib/learner";
import { getRules,toneFor } from "@/lib/rules";
import { currentTerm,offeringScope } from "@/lib/scope";
import { FileWarning } from "lucide-react";

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
      <PageHeader illustration="learning" title="Attendance" subtitle={`${term?.name} · ${offerings.length} courses`} actions={<>{user.role !== "FACULTY" && <LinkButton variant="secondary" href="/attendance/substitutions">Substitute classes</LinkButton>}<LinkButton variant="secondary" href="/attendance/report"><FileWarning className="size-4" /> Shortage report</LinkButton></>} />
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
  const safe = overall >= ATTENDANCE_REQUIRED;
  const canMiss = Math.max(0, Math.floor(totals.a / (ATTENDANCE_REQUIRED / 100) - totals.t));
  const mustAttend = classesToReach(ATTENDANCE_REQUIRED, totals.a, totals.t);
  const who = user.role === "PARENT" ? (await db.user.findFirst({ where: { student: { id: student.id } }, select: { name: true } }))?.name.split(" ")[0] ?? "Your child" : null;
  return (
    <>
      <PageHeader illustration="learning" title={who ? `${who}'s attendance` : t("My attendance")} subtitle={`${term?.name} · overall ${overall}% (${totals.a}/${totals.t} classes)`} />
      {/* Where the student stands against the attendance rule, in one sentence. */}
      <section className={`mb-6 flex items-center gap-4 rounded-[var(--radius-panel)] border p-4 sm:p-5 ${safe ? "border-[#d6f0ec] bg-gradient-to-r from-[#f0fbf9] via-white to-[#f0f7ff]" : "border-[#fbd5dd] bg-gradient-to-r from-[#fff5f7] via-white to-[#fffaf0]"}`}>
        <Ring value={overall} size={84} stroke={8} tone={safe ? "success" : overall >= ATTENDANCE_CONDONABLE ? "warning" : "danger"}>
          <span><span className="block text-lg font-bold tabular-nums">{overall}%</span><span className="text-[10px] text-muted">overall</span></span>
        </Ring>
        <div className="min-w-0">
          <p className="text-lg font-bold">{safe ? (who ? `${who} is safe` : "You're safe") : `Below ${ATTENDANCE_REQUIRED}%`}</p>
          <p className="text-sm text-fg-2">
            {totals.a} of {totals.t} classes.{" "}
            {safe
              ? <>{who ? `${who} can` : "You can"} miss <b>{canMiss} more</b> and stay above {ATTENDANCE_REQUIRED}%.</>
              : <>{Number.isFinite(mustAttend) ? <>Attend the next <b>{mustAttend}</b> classes to reach {ATTENDANCE_REQUIRED}%. </> : null}Condonation is possible from {ATTENDANCE_CONDONABLE}% with supporting documents.</>}
          </p>
        </div>
      </section>
      {term && <Card title={t("Attendance calendar")} className="mb-6"><AttendanceHeatmap studentId={student.id} termId={term.id} from={term.startDate} to={term.endDate} /></Card>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("Subject-wise")} className="lg:col-span-2">
          <div className="hidden sm:block"><Table>
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
          </Table></div>
          {/* Phones: one line per subject with its ring. */}
          <ul className="divide-y divide-line sm:hidden">
            {offerings.map((o) => {
              const v = summary.get(`${student.id}:${o.id}`) ?? { attended: 0, total: 0 };
              const p = pct(v.attended, v.total);
              return (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <Ring value={v.total ? p : 0} size={44} stroke={5} tone={p >= ATTENDANCE_REQUIRED ? "brand" : p >= ATTENDANCE_CONDONABLE ? "warning" : "danger"}><span className="text-[10.5px] font-bold tabular-nums">{v.total ? `${Math.round(p)}%` : "—"}</span></Ring>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{o.subject.name}</span><span className="block truncate text-xs text-muted">{o.faculty?.user.name ?? "—"} · {v.attended}/{v.total}</span></span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title={t("Recent absences")}>
          {absences.length === 0 ? <p className="text-sm text-muted">No absences. 🎉</p> : (
            <ul className="space-y-2 text-sm">
              {absences.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.session.offering.subject.name}</span><span className="text-xs whitespace-nowrap text-muted">{fmtDate(a.session.date)} · P{a.session.period}</span></li>)}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Contact your faculty within 3 days if any entry is wrong.</p>
        </Card>
      </div>
    </>
  );
}
