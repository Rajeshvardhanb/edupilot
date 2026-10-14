import Link from "next/link";
import { Download, ExternalLink, FileText, ClipboardList } from "lucide-react";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { batchLabel, fmtDate } from "@/lib/format";
import { submitAssignment } from "@/actions/daily";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Study material" };

export default async function MaterialsPage() {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "STUDENT"]);
  return user.role === "STUDENT" ? <StudentMaterials user={user} /> : <StaffMaterials user={user} />;
}

async function StaffMaterials({ user }: { user: CurrentUser }) {
  const term = await currentTerm();
  const offerings = await db.courseOffering.findMany({
    where: { ...offeringScope(user), termId: term?.id },
    include: { subject: true, batch: { include: { program: true } }, materials: { select: { kind: true, _count: { select: { submissions: true } } } } },
    orderBy: [{ batch: { program: { code: "asc" } } }, { subject: { code: "asc" } }],
  });
  return (
    <>
      <PageHeader title="Study material & assignments" subtitle={`${term?.name} · share notes and collect assignments online`} />
      <Card>
        {offerings.length === 0 ? <EmptyState title="No courses" /> : (
          <Table>
            <thead><tr><Th>Subject</Th><Th>Batch</Th><Th className="text-right">Notes</Th><Th className="text-right">Assignments</Th><Th className="text-right">Submissions</Th><Th /></tr></thead>
            <tbody>{offerings.map((o) => (
              <tr key={o.id}>
                <Td><p className="font-medium">{o.subject.name}</p><p className="text-xs text-muted">{o.subject.code}</p></Td>
                <Td>{batchLabel(o.batch)}</Td>
                <Td className="text-right">{o.materials.filter((m) => m.kind === "NOTE").length}</Td>
                <Td className="text-right">{o.materials.filter((m) => m.kind === "ASSIGNMENT").length}</Td>
                <Td className="text-right">{o.materials.reduce((s, m) => s + m._count.submissions, 0)}</Td>
                <Td><Link href={`/materials/${o.id}`} className="text-sm text-brand">Manage →</Link></Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

async function StudentMaterials({ user }: { user: CurrentUser }) {
  const term = await currentTerm();
  const student = await db.student.findUniqueOrThrow({ where: { id: user.studentId! } });
  const materials = await db.material.findMany({
    where: { offering: { batchId: student.batchId, termId: term?.id } },
    include: { offering: { include: { subject: true } }, submissions: { where: { studentId: student.id } } },
    orderBy: { createdAt: "desc" },
  });
  const assignments = materials.filter((m) => m.kind === "ASSIGNMENT");
  const notes = materials.filter((m) => m.kind === "NOTE");
  const today = new Date(new Date().toISOString().slice(0, 10));
  return (
    <>
      <PageHeader title="Study material & assignments" subtitle={term?.name} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><ClipboardList className="size-4 text-brand" /> Assignments</span>}>
          {assignments.length === 0 ? <EmptyState title="No assignments yet" /> : (
            <ul className="space-y-4">{assignments.map((m) => {
              const sub = m.submissions[0];
              const late = m.dueDate && m.dueDate < today && !sub;
              return (
                <li key={m.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-medium">{m.title}</p><p className="text-xs text-muted">{m.offering.subject.name}{m.dueDate && ` · due ${fmtDate(m.dueDate)}`}{m.maxMarks && ` · ${m.maxMarks} marks`}</p></div>
                    {sub ? (sub.marks != null ? <Badge tone="success">{sub.marks}/{m.maxMarks ?? 100}</Badge> : <Badge tone="info">Submitted</Badge>) : <Badge tone={late ? "danger" : "warning"}>{late ? "Overdue" : "Pending"}</Badge>}
                  </div>
                  {m.description && <p className="mt-2 text-sm text-muted">{m.description}</p>}
                  <p className="mt-2 flex gap-3 text-xs">
                    {m.fileName && <a className="flex items-center gap-1 text-brand" href={`/materials/file/${m.id}`}><Download className="size-3.5" />{m.fileName}</a>}
                    {m.link && <a className="flex items-center gap-1 text-brand" href={m.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" />Open link</a>}
                  </p>
                  {sub?.feedback && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">Feedback: {sub.feedback}</p>}
                  {sub?.marks == null && (
                    <ActionForm action={submitAssignment} className="mt-3 space-y-2 border-t border-line pt-3" toastSuccess>
                      <input type="hidden" name="materialId" value={m.id} />
                      <textarea name="note" rows={2} defaultValue={sub?.note ?? ""} placeholder="Your answer or a note to the teacher" className="input" />
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="file" name="file" aria-label="File" className="input max-w-56 text-xs" />
                        <input name="link" defaultValue={sub?.link ?? ""} placeholder="or a link (Drive, GitHub…)" className="input max-w-56" />
                        <SubmitButton size="sm">{sub ? "Resubmit" : "Submit"}</SubmitButton>
                      </div>
                    </ActionForm>
                  )}
                </li>
              );
            })}</ul>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><FileText className="size-4 text-brand" /> Notes & resources</span>}>
          {notes.length === 0 ? <EmptyState title="Nothing shared yet" /> : (
            <ul className="divide-y divide-line">{notes.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><FileText className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.title}</p><p className="text-xs text-muted">{m.offering.subject.name} · {fmtDate(m.createdAt)}</p></div>
                {m.fileName && <a className="text-brand" title={m.fileName} href={`/materials/file/${m.id}`}><Download className="size-4" /></a>}
                {m.link && <a className="text-brand" aria-label="Open link" title="Open link" href={m.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /></a>}
              </li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
