import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope, studentScope } from "@/lib/scope";
import { managedStaff } from "@/lib/staff";
import { overdueCount } from "@/lib/fee-ledger";
import { isoDate } from "@/lib/format";
import { Card } from "./ui-server";

/** Count-square colours: the first for urgent tasks, the rest in turn. */
const TONES = ["bg-[#ffe4e8] text-[#be123c]", "bg-[#e0f2fe] text-[#0369a1]", "bg-[#f1ebff] text-[#7c3aed]", "bg-[#eef0ff] text-[#4f46e5]", "bg-[#fef3c7] text-[#b45309]", "bg-[#cffafe] text-[#0e7490]", "bg-[#fce7f3] text-[#be185d]", "bg-[#dcf7ea] text-[#0e7a4f]"];

type Task = { label: string; count: number; href: string; urgent?: boolean };

/** What is waiting on this user right now, each linking to where it gets done. */
async function tasksFor(user: CurrentUser): Promise<Task[]> {
  const term = await currentTerm();
  const today = new Date(isoDate(new Date()));
  const t: Task[] = [];
  const add = (label: string, count: number, href: string, urgent = false) => { if (count > 0) t.push({ label, count, href, urgent }); };

  if (user.role === "ADMIN" || user.role === "HOD" || user.role === "FACULTY") {
    add("Student leave requests to review", await db.leaveRequest.count({ where: { status: "PENDING", student: studentScope(user) } }), "/leave");
  }
  if (user.role === "ADMIN" || user.role === "HOD") {
    add("Staff leave requests to approve", await db.staffLeave.count({ where: { status: "PENDING", user: managedStaff(user) } }), "/staff/leave");
    add("Revaluation requests to decide", await db.revaluationRequest.count({ where: { status: "PENDING", offering: offeringScope(user) } }), "/exams/revaluation");
    add("Courses without a teacher", await db.courseOffering.count({ where: { ...offeringScope(user), termId: term?.id, facultyId: null } }), "/academics/allocation", true);
  }
  if (user.role === "ADMIN" || user.role === "OFFICE") {
    add("Certificate requests to issue", await db.certificateRequest.count({ where: { status: "PENDING" } }), "/certificates");
    add("Open helpdesk tickets", await db.ticket.count({ where: { status: { not: "RESOLVED" } } }), "/helpdesk");
    add("Admission follow-ups due", await db.enquiry.count({ where: { followUpDate: { lte: today }, stage: { notIn: ["ADMITTED", "LOST"] } } }), "/admissions", true);
    add("Gate passes to decide", await db.gatePass.count({ where: { status: "PENDING" } }), "/gate");
    add("Profile corrections to approve", await db.profileChange.count({ where: { status: "PENDING" } }), "/students/changes");
  }
  if ((user.role === "FACULTY" || user.role === "HOD") && user.facultyId) {
    const dow = today.getUTCDay();
    const slots = await db.timetableSlot.findMany({ where: { dayOfWeek: dow, offering: { facultyId: user.facultyId, termId: term?.id } }, select: { offeringId: true, period: true } });
    const done = await db.attendanceSession.findMany({ where: { date: today, offeringId: { in: slots.map((s) => s.offeringId) } }, select: { offeringId: true, period: true } });
    add("Today's classes with attendance not marked", slots.filter((s) => !done.some((d) => d.offeringId === s.offeringId && d.period === s.period)).length, "/attendance", true);
    add("Assignment submissions to grade", await db.submission.count({ where: { marks: null, material: { offering: { facultyId: user.facultyId, termId: term?.id } } } }), "/materials");
    add("Class swap requests for you", await db.swapRequest.count({ where: { toId: user.facultyId, status: "PENDING" } }), "/staff/swaps");
  }
  if (user.role === "ACCOUNTANT" || user.role === "ADMIN") {
    add("Overdue fee invoices", await overdueCount(), "/fees?status=OVERDUE");
    add("Sanctioned scholarships awaiting funds", await db.scholarship.count({ where: { status: "SANCTIONED" } }), "/scholarships");
  }
  if (user.role === "STUDENT" && user.studentId) {
    const student = await db.student.findUniqueOrThrow({ where: { id: user.studentId }, select: { id: true, batchId: true } });
    add("Assignments to submit", await db.material.count({ where: { kind: "ASSIGNMENT", offering: { batchId: student.batchId, termId: term?.id }, submissions: { none: { studentId: student.id } } } }), "/materials", true);
    add("Courses waiting for your feedback", await db.courseOffering.count({ where: { batchId: student.batchId, termId: term?.id, facultyId: { not: null }, feedbackMarkers: { none: { studentId: student.id } } } }), "/feedback");
    add("Overdue fee invoices", await overdueCount({ studentId: student.id }), "/fees", true);
  }
  return t;
}

export async function MyTasks({ user }: { user: CurrentUser }) {
  if (user.role === "PARENT") return null;
  const t = await getT();
  const tasks = await tasksFor(user);
  return (
    <Card title={t("My tasks")} className="mb-6" actions={tasks.length ? <span className="rounded-full bg-[#f1ebff] px-2.5 py-0.5 text-xs font-semibold text-[#7c3aed]">{tasks.reduce((s, x) => s + x.count, 0)} waiting</span> : null}>
      {tasks.length === 0 ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> Nothing is waiting on you.</p> : (
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {tasks.map((x, i) => {
            const tone = x.urgent ? TONES[0] : TONES[1 + (i % (TONES.length - 1))];
            return (
              <li key={x.label}>
                <Link href={x.href} className="group flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-2.5 transition hover:border-brand/30 hover:shadow-card">
                  <span className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-[13px] font-bold tabular-nums ${tone}`}>{x.count > 99 ? "99+" : x.count}</span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-fg-2 group-hover:text-fg">{x.label}{x.urgent && <span className="sr-only"> (urgent)</span>}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
