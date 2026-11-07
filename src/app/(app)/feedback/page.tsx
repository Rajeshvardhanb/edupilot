import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { batchLabel } from "@/lib/format";
import { Badge, Progress } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui-server";
import { FeedbackForm } from "./feedback-form";
import { QUESTIONS } from "./questions";

export const metadata = { title: "Course feedback" };
const MIN_RESPONSES = 5; // results stay hidden below this, so individuals cannot be identified

export default async function FeedbackPage() {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "STUDENT"]);
  return user.role === "STUDENT" ? <StudentFeedback user={user} /> : <StaffFeedback user={user} />;
}

async function StudentFeedback({ user }: { user: CurrentUser }) {
  const term = await currentTerm();
  const student = await db.student.findUniqueOrThrow({ where: { id: user.studentId! } });
  const offerings = await db.courseOffering.findMany({
    where: { batchId: student.batchId, termId: term?.id, facultyId: { not: null } },
    include: { subject: true, faculty: { include: { user: { select: { name: true } } } }, feedbackMarkers: { where: { studentId: student.id } } },
    orderBy: { subject: { code: "asc" } },
  });
  const pending = offerings.filter((o) => o.feedbackMarkers.length === 0);
  return (
    <>
      <PageHeader title="Course feedback" subtitle="Your responses are anonymous. Faculty see only averages, and only after at least five students respond." />
      {offerings.length - pending.length > 0 && <p className="mb-4 text-sm text-success">Feedback given for {offerings.length - pending.length} of {offerings.length} courses. Thank you!</p>}
      {pending.length === 0 ? <EmptyState title="All done — you've given feedback for every course" /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          {pending.map((o) => (
            <Card key={o.id} title={o.subject.name} actions={<span className="text-xs text-muted">{o.faculty?.user.name}</span>}>
              <FeedbackForm offeringId={o.id} questions={QUESTIONS} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

async function StaffFeedback({ user }: { user: CurrentUser }) {
  const term = await currentTerm();
  const offerings = await db.courseOffering.findMany({
    where: { ...offeringScope(user), termId: term?.id },
    include: { subject: true, batch: { include: { program: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } }, faculty: { include: { user: { select: { name: true } } } }, feedback: true },
    orderBy: [{ batch: { program: { code: "asc" } } }, { subject: { code: "asc" } }],
  });
  const stats = offerings.map((o) => {
    const n = o.feedback.length;
    const avg = QUESTIONS.map((_, i) => (n ? o.feedback.reduce((s, f) => s + ((f.ratings as number[])[i] ?? 0), 0) / n : 0));
    return { o, n, avg, overall: n ? avg.reduce((a, b) => a + b, 0) / avg.length : 0, visible: n >= MIN_RESPONSES };
  });
  const visible = stats.filter((s) => s.visible);
  const total = stats.reduce((s, x) => s + x.n, 0);
  return (
    <>
      <PageHeader title="Course feedback" subtitle={`${term?.name} · anonymous student ratings (1–5)`} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard label="Responses" value={total} />
        <StatCard label="Average rating" value={visible.length ? (visible.reduce((s, x) => s + x.overall, 0) / visible.length).toFixed(2) : "—"} tone="info" hint="courses with 5+ responses" />
        <StatCard label="Courses rated" value={`${visible.length}/${stats.length}`} tone="success" />
      </div>
      {stats.length === 0 ? <EmptyState title="No courses" /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          {stats.map(({ o, n, avg, overall, visible: v }) => (
            <Card key={o.id} title={<span>{o.subject.name} <span className="text-xs font-normal text-muted">· {batchLabel(o.batch)}{user.role !== "FACULTY" && ` · ${o.faculty?.user.name ?? "—"}`}</span></span>}
              actions={v ? <Badge tone={overall >= 4 ? "success" : overall >= 3 ? "info" : "danger"}>{overall.toFixed(2)} / 5</Badge> : <Badge>{n}/{o.batch._count.students} responses</Badge>}>
              {!v ? <p className="text-sm text-muted">Results appear once at least {MIN_RESPONSES} students have responded, to keep feedback anonymous.</p> : (
                <>
                  <ul className="space-y-2.5">{QUESTIONS.map((q, i) => (
                    <li key={q}><div className="mb-1 flex justify-between text-xs"><span className="text-muted">{q}</span><span className="font-medium tabular-nums">{avg[i].toFixed(1)}</span></div><Progress value={(avg[i] / 5) * 100} tone={avg[i] >= 4 ? "success" : avg[i] >= 3 ? "brand" : "danger"} /></li>
                  ))}</ul>
                  <p className="mt-3 text-xs text-muted">{n} of {o.batch._count.students} students responded.</p>
                  {o.feedback.some((f) => f.comment) && (
                    <details className="mt-3 text-sm"><summary className="cursor-pointer text-brand">Comments ({o.feedback.filter((f) => f.comment).length})</summary>
                      <ul className="mt-2 space-y-2">{o.feedback.filter((f) => f.comment).map((f) => <li key={f.id} className="rounded-lg bg-surface-2 p-2 text-xs">“{f.comment}”</li>)}</ul>
                    </details>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
