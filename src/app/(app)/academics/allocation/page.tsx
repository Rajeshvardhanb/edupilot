import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, programScope } from "@/lib/scope";
import { batchOptions } from "@/lib/options";
import { allocateFaculty, generateOfferings, deleteRecord } from "@/actions/academics";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { AcademicsTabs } from "../tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Course allocation" };

export default async function AllocationPage(props: PageProps<"/academics/allocation">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const sp = await props.searchParams;
  const [terms, batches, cur] = await Promise.all([db.term.findMany({ orderBy: { startDate: "desc" } }), batchOptions(user), currentTerm()]);
  const termId = (typeof sp.term === "string" && sp.term) || cur?.id;
  const batchId = typeof sp.batch === "string" ? sp.batch : "";
  const offerings = await db.courseOffering.findMany({
    where: { termId, batch: { program: programScope(user) }, ...(batchId && { batchId }) },
    include: { subject: true, batch: { include: { program: true } }, faculty: { include: { user: true } }, _count: { select: { sessions: true, assessments: true, slots: true } } },
    orderBy: [{ batch: { program: { code: "asc" } } }, { batch: { admissionYear: "desc" } }, { subject: { code: "asc" } }],
  });
  const faculty = await db.faculty.findMany({
    where: user.role === "HOD" ? { departmentId: user.departmentId ?? "-" } : {},
    include: { user: true, department: true },
    orderBy: [{ department: { code: "asc" } }, { user: { name: "asc" } }],
  });
  const unassigned = offerings.filter((o) => !o.facultyId).length;

  return (
    <>
      <PageHeader title="Academics" subtitle="Assign subjects to faculty for each batch and term" />
      <AcademicsTabs active="/academics/allocation" />
      <Filters>
        <select name="term" aria-label="Term" defaultValue={termId} className="input w-auto">{terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (current)" : ""}</option>)}</select>
        <select name="batch" aria-label="Batch" defaultValue={batchId} className="input w-auto"><option value="">All batches</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-academics-allocation" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={`${offerings.length} course offerings`} actions={unassigned > 0 && <Badge tone="warning">{unassigned} without faculty</Badge>}>
          {offerings.length === 0 ? <EmptyState title="No offerings">Generate them from the batch&apos;s curriculum using the form.</EmptyState> : (
            <Table>
              <thead><tr><Th>Subject</Th><Th>Batch</Th><Th>Faculty</Th><Th className="text-right">Classes</Th><Th /></tr></thead>
              <tbody>
                {offerings.map((o) => (
                  <tr key={o.id}>
                    <Td><p className="font-medium">{o.subject.name}</p><p className="font-mono text-xs text-muted">{o.subject.code}</p></Td>
                    <Td className="whitespace-nowrap">{o.batch.program.code} {o.batch.admissionYear}-{o.batch.section}</Td>
                    <Td>
                      <ActionForm action={allocateFaculty} className="flex items-center gap-2">
                        <input type="hidden" name="offeringId" value={o.id} />
                        <select name="facultyId" aria-label="Faculty" defaultValue={o.facultyId ?? ""} className="input min-w-44 py-1 text-xs">
                          <option value="">— Unassigned —</option>
                          {faculty.map((f) => <option key={f.id} value={f.id}>{f.user.name} ({f.department.code})</option>)}
                        </select>
                        <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
                      </ActionForm>
                    </Td>
                    <Td className="text-right">{o._count.sessions}</Td>
                    <Td>{user.role === "ADMIN" && o._count.sessions === 0 && o._count.assessments === 0 && (
                      <ActionButton action={deleteRecord} fields={{ model: "courseOffering", id: o.id }} variant="ghost" confirm="Remove this offering?">Remove</ActionButton>
                    )}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Generate offerings">
            <p className="mb-4 text-sm text-muted">Creates one offering per subject in the batch&apos;s current semester for the selected term. Existing offerings are kept.</p>
            <ActionForm action={generateOfferings} className="space-y-3">
              <Field label="Batch" name="batchId"><select id="batchId" name="batchId" defaultValue={batchId} className="input" required><option value="">Select</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Field>
              <Field label="Term" name="termId"><select id="termId" name="termId" defaultValue={termId} className="input">{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              <SubmitButton>Generate</SubmitButton>
            </ActionForm>
          </Card>

        </div>
      </div>
    </>
  );
}
