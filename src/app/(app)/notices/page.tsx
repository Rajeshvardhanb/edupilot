import { banner } from "@/lib/images";
import { PhotoBanner } from "@/components/hero";
import { Pin } from "lucide-react";
import type { NoticeAudience } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, titleCase } from "@/lib/format";
import { createNotice, deleteNotice } from "@/actions/admin";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field } from "@/components/ui";
import { Card, EmptyState, PageHeader } from "@/components/ui-server";

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
      <PhotoBanner {...banner("campus-life")} />
      <PageHeader title="Notice board" subtitle="Circulars and announcements" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`space-y-4 ${canPost ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {notices.length === 0 && <EmptyState title="No notices yet" />}
          {notices.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-semibold">{n.pinned && <Pin className="size-4 text-brand" />}{n.title}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {fmtDateTime(n.createdAt)} · {n.createdBy?.name ?? "Office"}{n.department && ` · ${n.department.code}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={n.audience === "ALL" ? "brand" : n.audience === "STUDENTS" ? "info" : "warning"}>{titleCase(n.audience)}</Badge>
                  {(user.role === "ADMIN" || n.createdById === user.id) && <ActionButton action={deleteNotice} fields={{ id: n.id }} variant="ghost" confirm="Delete this notice?">Delete</ActionButton>}
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-line">{n.body}</p>
            </Card>
          ))}
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
