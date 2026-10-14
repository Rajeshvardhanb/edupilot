import Link from "next/link";
import { BellOff } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { markNotificationsRead } from "@/actions/alerts";
import { ActionButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui-server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "You're all caught up"} actions={unread > 0 && <ActionButton action={markNotificationsRead} fields={{}} size="md">Mark all as read</ActionButton>} />
      <Card className="mx-auto max-w-3xl">
        {items.length === 0 ? (
          <div className="py-10 text-center text-muted"><BellOff className="mx-auto mb-2 size-8" /><p className="text-sm">Nothing yet. Approvals, results, fee updates and replies will appear here.</p></div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={`/notifications/${n.id}`} prefetch={false} className={cn("flex gap-3 px-2 py-3 hover:bg-surface-2", !n.readAt && "bg-brand-soft/40")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-brand")} aria-label={n.readAt ? "Read" : "Unread"} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.readAt && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted">{fmtDateTime(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
