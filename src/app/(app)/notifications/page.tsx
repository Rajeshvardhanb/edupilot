import Link from "next/link";
import { markNotificationRead } from "@/actions/notifications";
import { ActionButton } from "@/components/forms";
import { Badge, buttonClass } from "@/components/ui";
import { Card, EmptyState, PageHeader } from "@/components/ui-server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
export const metadata = { title: "Notifications" };
export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const user = await requireUser(), sp = await props.searchParams;
  const page = Math.max(1, Math.min(10000, Number(sp.page) || 1));
  const unread = sp.unread === "1";
  const category = typeof sp.category === "string" && ["ACCOUNT", "SECURITY", "ACADEMIC", "REQUEST", "LEARNING", "PLACEMENT", "SYSTEM"].includes(sp.category) ? sp.category : undefined;
  const where = { userId: user.id, ...(unread ? { readAt: null } : {}), ...(category ? { category } : {}) };
  const [items, total, unreadCount] = await Promise.all([
    db.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
    db.notification.count({ where }), db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const query = (p: number) => `/notifications?page=${p}${unread ? "&unread=1" : ""}${category ? `&category=${category}` : ""}`;
  return <>
    <PageHeader title="Notifications" subtitle={`${unreadCount} unread · Academic updates, requests and account security`} actions={<ActionButton action={markNotificationRead} fields={{}} variant="secondary">Mark all as read</ActionButton>} />
    <form className="mb-5 flex flex-wrap gap-3">
      <select name="category" aria-label="Notification category" defaultValue={category ?? ""} className="input w-auto"><option value="">All categories</option>{["ACCOUNT", "SECURITY", "ACADEMIC", "REQUEST", "LEARNING", "PLACEMENT", "SYSTEM"].map(c => <option key={c}>{c}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="unread" value="1" defaultChecked={unread} />Unread only</label><button className={buttonClass("secondary")}>Filter</button>
    </form>
    {!items.length ? <EmptyState title="No notifications">Updates will appear here when an academic activity or request concerns you.</EmptyState> : <div className="space-y-3">{items.map(n => <Card key={n.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap gap-2"><Badge tone={n.readAt ? "neutral" : "brand"}>{n.readAt ? "Read" : "Unread"}</Badge><Badge tone={n.priority === "HIGH" ? "warning" : "info"}>{n.category}{n.priority === "HIGH" ? " · Important" : ""}</Badge></div>
        <h2 className="font-semibold">{n.title}</h2><p className="mt-2 whitespace-pre-line text-sm text-muted">{n.body}</p><p className="mt-3 text-xs text-muted">{n.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
      </div><div className="flex gap-2">{n.href?.startsWith("/") && !n.href.startsWith("//") && <Link className={buttonClass("secondary")} href={n.href}>View details</Link>}{!n.readAt && <ActionButton action={markNotificationRead} fields={{ id: n.id }} variant="secondary">Mark as read</ActionButton>}</div></div>
    </Card>)}</div>}
    <div className="mt-5 flex items-center gap-4">{page > 1 && <Link href={query(page - 1)}>← Previous</Link>}<span className="text-sm text-muted">Page {page} · {total} updates</span>{page * 20 < total && <Link href={query(page + 1)}>Next →</Link>}</div>
  </>;
}
