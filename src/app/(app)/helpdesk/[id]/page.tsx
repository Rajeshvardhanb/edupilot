import { notFound } from "next/navigation";
import { isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, titleCase } from "@/lib/format";
import { replyTicket } from "@/actions/services";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar } from "@/components/avatar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ROLE_LABEL } from "@/components/nav";
import { Badge } from "@/components/ui";
import { Card, PageHeader } from "@/components/ui-server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Ticket" };

export default async function TicketPage(props: PageProps<"/helpdesk/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const t = await db.ticket.findFirst({
    where: { id, ...(isOffice(user) ? {} : { userId: user.id }) },
    include: { user: { select: { id: true, name: true, role: true, photoType: true } }, replies: { include: { user: { select: { id: true, name: true, role: true, photoType: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!t) notFound();
  const thread = [{ id: "first", user: t.user, body: t.body, createdAt: t.createdAt }, ...t.replies];
  return (
    <>
      <Breadcrumbs items={[{ label: "Helpdesk", href: "/helpdesk" }, { label: t.subject }]} />
      <PageHeader title={t.subject} subtitle={`${t.category} · raised by ${t.user.name}`} actions={<Badge tone={t.status === "RESOLVED" ? "success" : t.status === "OPEN" ? "warning" : "info"}>{titleCase(t.status)}</Badge>} />
      <div className="mx-auto max-w-3xl space-y-4">
        {thread.map((m) => {
          const mine = m.user.id === user.id;
          return (
            <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <Avatar name={m.user.name} userId={m.user.id} hasPhoto={!!m.user.photoType} size={36} />
              <div className={cn("max-w-[80%] rounded-[var(--radius-card)] border border-line p-4", mine ? "bg-brand-soft" : "bg-surface")}>
                <p className="text-xs text-muted"><b className="text-fg">{m.user.name}</b> · {ROLE_LABEL[m.user.role]} · {fmtDateTime(m.createdAt)}</p>
                <p className="mt-1 text-sm whitespace-pre-line">{m.body}</p>
              </div>
            </div>
          );
        })}
        <Card>
          <ActionForm action={replyTicket} className="space-y-3" resetOnSuccess>
            <input type="hidden" name="ticketId" value={t.id} />
            <textarea name="body" rows={3} className="input" placeholder={t.status === "RESOLVED" ? "Reply to reopen this ticket…" : "Write a reply…"} />
            <div className="flex items-center justify-end gap-2">
              {isOffice(user) && <select name="status" aria-label="Status" defaultValue={t.status} className="input w-auto">{["OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>}
              <SubmitButton>Send</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
