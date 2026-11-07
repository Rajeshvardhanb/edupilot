import { banner } from "@/lib/images";
import { Megaphone, Pin } from "lucide-react";
import { noticeTag } from "../dashboard/widgets";
import type { NoticeAudience } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, titleCase } from "@/lib/format";
import { createNotice, deleteNotice } from "@/actions/admin";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { Card, EmptyState, PageBanner } from "@/components/ui-server";

export const metadata = { title: "Notices" };

export default async function NoticesPage() {
  const user = await requireUser();
  const audiences: NoticeAudience[] = user.role === "STUDENT" || user.role === "PARENT" ? ["ALL", "STUDENTS"] : user.role === "ADMIN" ? ["ALL", "STUDENTS", "FACULTY"] : ["ALL", "FACULTY", "STUDENTS"];
  const notices = await db.notice.findMany({
    where: { audience: { in: audiences } },
    include: { createdBy: true, department: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const canPost = user.role !== "STUDENT" && user.role !== "PARENT";
  return (
    <>
      <PageBanner {...banner("campus-life")} eyebrow="Circulars and announcements" tint="#3b2a8f" title="Notice board" subtitle="Circulars and announcements" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`space-y-4 ${canPost ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {notices.length === 0 && <EmptyState title="No notices yet" />}
          {notices.map((n) => {
            const tag = noticeTag(n.title, n.audience);
            return (
              <Card key={n.id} icon={false}>
                <div className="-mt-1 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg" style={{ color: tag.color, background: `color-mix(in oklab, ${tag.color} 12%, white)` }}><Megaphone className="size-3.5" /></span>
                    <span className="rounded-full px-2 py-px text-[11px] font-semibold" style={{ color: `color-mix(in oklab, ${tag.color} 72%, black)`, background: `color-mix(in oklab, ${tag.color} 12%, white)` }}>{tag.label}</span>
                    {n.audience !== "ALL" && <span className="text-[11px] text-muted">for {titleCase(n.audience)}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {n.pinned && <Pin aria-label="Pinned" className="size-4" style={{ color: tag.color }} />}
                    {(user.role === "ADMIN" || n.createdById === user.id) && <ActionButton action={deleteNotice} fields={{ id: n.id }} variant="ghost" confirm="Delete this notice?">Delete</ActionButton>}
                  </span>
                </div>
                <h3 className="mt-2.5 font-semibold">{n.title}</h3>
                <p className="mt-1.5 text-sm whitespace-pre-line text-fg-2">{n.body}</p>
                <p className="mt-3 text-xs text-muted">{fmtDateTime(n.createdAt)} · {n.createdBy?.name ?? "Office"}{n.department && ` · ${n.department.code}`}</p>
              </Card>
            );
          })}
        </div>
        {canPost && (
          <Card title="Post a notice" className="h-fit lg:sticky lg:top-6">
            <ActionForm action={createNotice} className="space-y-3" resetOnSuccess>
              <Field label="Title" name="title"><input id="title" name="title" className="input" required /></Field>
              <Field label="Message" name="body"><textarea id="body" name="body" rows={6} className="input" required /></Field>
              <Field label="Audience" name="audience">
                <select id="audience" name="audience" className="input"><option value="ALL">Everyone</option><option value="STUDENTS">Students</option><option value="FACULTY">Staff / faculty</option></select>
              </Field>
              {user.role === "ADMIN" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" /> Pin to top</label>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email" /> Also send by email</label>
              <SubmitButton>Publish</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
