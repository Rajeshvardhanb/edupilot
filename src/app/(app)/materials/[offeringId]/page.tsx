import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { offeringScope } from "@/lib/scope";
import { batchLabel, fmtDate, fmtDateTime } from "@/lib/format";
import { deleteMaterial, gradeSubmission, saveMaterial } from "@/actions/daily";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge, Field } from "@/components/ui";
import { Card, EmptyState, PageHeader } from "@/components/ui-server";

export const metadata = { title: "Course material" };

export default async function OfferingMaterials(props: PageProps<"/materials/[offeringId]">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const { offeringId } = await props.params;
  const offering = await db.courseOffering.findFirst({
    where: { id: offeringId, ...offeringScope(user) },
    include: {
      subject: true, batch: { include: { program: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } },
      materials: { orderBy: { createdAt: "desc" }, include: { submissions: { include: { student: { include: { user: { select: { name: true } } } } }, orderBy: { submittedAt: "desc" } } } },
    },
  });
  if (!offering) notFound();
  return (
    <>
      <Breadcrumbs items={[{ label: "Study material", href: "/materials" }, { label: offering.subject.name }]} />
      <PageHeader title={offering.subject.name} subtitle={`${offering.subject.code} · ${batchLabel(offering.batch)} · ${offering.batch._count.students} students`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {offering.materials.length === 0 && <EmptyState title="Nothing shared yet">Upload notes or publish an assignment using the form.</EmptyState>}
          {offering.materials.map((m) => (
            <Card key={m.id} title={<span className="flex items-center gap-2">{m.title} <Badge tone={m.kind === "ASSIGNMENT" ? "warning" : "info"}>{m.kind === "ASSIGNMENT" ? "Assignment" : "Note"}</Badge></span>}
              actions={<ActionButton action={deleteMaterial} fields={{ id: m.id }} variant="ghost" undoable={`Deleting “${m.title}”`}>Delete</ActionButton>}>
              <p className="text-xs text-muted">Posted {fmtDate(m.createdAt)}{m.dueDate && ` · due ${fmtDate(m.dueDate)}`}{m.maxMarks && ` · ${m.maxMarks} marks`}</p>
              {m.description && <p className="mt-2 text-sm">{m.description}</p>}
              <p className="mt-2 flex gap-3 text-xs">
                {m.fileName && <a className="flex items-center gap-1 text-brand" href={`/materials/file/${m.id}`}><Download className="size-3.5" />{m.fileName}</a>}
                {m.link && <a className="flex items-center gap-1 text-brand" href={m.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" />Link</a>}
              </p>
              {m.kind === "ASSIGNMENT" && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-2 text-xs font-semibold text-muted uppercase">Submissions · {m.submissions.length}/{offering.batch._count.students}</p>
                  <ul className="space-y-3">
                    {m.submissions.map((s) => (
                      <li key={s.id} className="rounded-lg bg-surface-2 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span><b>{s.student.user.name}</b> <span className="font-mono text-xs text-muted">{s.student.rollNo}</span> <span className="text-xs text-muted">· {fmtDateTime(s.submittedAt)}</span>{m.dueDate && s.submittedAt > new Date(m.dueDate.getTime() + 864e5) && <Badge tone="danger">Late</Badge>}</span>
                          <span className="flex gap-3 text-xs">
                            {s.fileName && <a className="flex items-center gap-1 text-brand" href={`/materials/file/${s.id}?kind=submission`}><Download className="size-3.5" />{s.fileName}</a>}
                            {s.link && <a className="flex items-center gap-1 text-brand" href={s.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" />Link</a>}
                          </span>
                        </div>
                        {s.note && <p className="mt-1 text-xs whitespace-pre-line text-muted">{s.note}</p>}
                        <ActionForm action={gradeSubmission} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input name="marks" type="number" step="0.5" min={0} max={m.maxMarks ?? 100} defaultValue={s.marks ?? ""} placeholder={`/ ${m.maxMarks ?? 100}`} className="input w-24" required />
                          <input name="feedback" defaultValue={s.feedback ?? ""} placeholder="Feedback" className="input min-w-40 flex-1" />
                          <SubmitButton size="sm" variant="secondary">{s.marks != null ? "Update" : "Grade"}</SubmitButton>
                        </ActionForm>
                      </li>
                    ))}
                    {m.submissions.length === 0 && <li className="text-xs text-muted">No submissions yet.</li>}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
        <Card title="Share with the class" className="h-fit lg:sticky lg:top-20">
          <ActionForm action={saveMaterial} className="space-y-3" resetOnSuccess>
            <input type="hidden" name="offeringId" value={offering.id} />
            <Field label="Type" name="kind"><select id="kind" name="kind" className="input"><option value="NOTE">Notes / resource</option><option value="ASSIGNMENT">Assignment</option></select></Field>
            <Field label="Title" name="title"><input id="title" name="title" className="input" required /></Field>
            <Field label="Description / instructions" name="description"><textarea id="description" name="description" rows={3} className="input" /></Field>
            <Field label="File (max 5 MB)" name="file"><input id="file" type="file" name="file" className="input text-xs" /></Field>
            <Field label="Link (optional)" name="link"><input id="link" name="link" className="input" placeholder="https://…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date (assignment)" name="dueDate"><input id="dueDate" type="date" name="dueDate" className="input" /></Field>
              <Field label="Max marks" name="maxMarks"><input id="maxMarks" type="number" name="maxMarks" className="input" placeholder="10" /></Field>
            </div>
            <SubmitButton>Publish</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
