import Link from "next/link";
import { isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, titleCase } from "@/lib/format";
import { openTicket } from "@/actions/services";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ROLE_LABEL } from "@/components/nav";
import { Badge, Field, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Helpdesk" };
const TONE: Record<string, Tone> = { OPEN: "warning", IN_PROGRESS: "info", RESOLVED: "success" };
const CATEGORIES = ["Academics", "Examinations", "Fees", "Hostel", "Transport", "Library", "IT / login", "Ragging / harassment", "General"];

export default async function HelpdeskPage(props: PageProps<"/helpdesk">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const admin = isOffice(user);
  const status = typeof sp.status === "string" ? sp.status : "";
  const where = { ...(admin ? {} : { userId: user.id }), ...(status && { status: status as "OPEN" }) };
  const [tickets, counts] = await Promise.all([
    db.ticket.findMany({ where, include: { user: { select: { name: true, role: true } }, _count: { select: { replies: true } } }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: 100 }),
    db.ticket.groupBy({ by: ["status"], where: admin ? {} : { userId: user.id }, _count: true }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader title="Helpdesk" subtitle={admin ? "Grievances and support requests from students, parents and staff" : "Raise a grievance or ask for help. The office replies here."} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={c("OPEN")} tone="warning" /><StatCard label="In progress" value={c("IN_PROGRESS")} tone="info" /><StatCard label="Resolved" value={c("RESOLVED")} tone="success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Filters><select name="status" aria-label="Status" defaultValue={status} className="input w-auto"><option value="">All tickets</option>{Object.keys(TONE).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></Filters>
      <SavedFilters storageKey="edupilot-filters-helpdesk" />
          {tickets.length === 0 ? <EmptyState title="No tickets" /> : (
            <ul className="space-y-3">{tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/helpdesk/${t.id}`} className="block rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card transition hover:border-brand/40">
                  <div className="flex items-start justify-between gap-3"><p className="font-medium">{t.subject}</p><Badge tone={TONE[t.status]}>{titleCase(t.status)}</Badge></div>
                  <p className="mt-1 line-clamp-1 text-sm text-muted">{t.body}</p>
                  <p className="mt-2 text-xs text-muted">{t.category}{admin && ` · ${t.user.name} (${ROLE_LABEL[t.user.role]})`} · {fmtDateTime(t.updatedAt)} · {t._count.replies} repl{t._count.replies === 1 ? "y" : "ies"}</p>
                </Link>
              </li>
            ))}</ul>
          )}
        </div>
        <Card title="Raise a ticket" className="h-fit">
          <ActionForm action={openTicket} className="space-y-3" resetOnSuccess>
            <Field label="Category" name="category"><select id="category" name="category" className="input">{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Subject" name="subject"><input id="subject" name="subject" className="input" required /></Field>
            <Field label="Describe the issue" name="body"><textarea id="body" name="body" rows={5} className="input" required /></Field>
            <SubmitButton>Submit</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
