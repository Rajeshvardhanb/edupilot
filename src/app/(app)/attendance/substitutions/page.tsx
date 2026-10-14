import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, offeringScope } from "@/lib/scope";
import { batchLabel, fmtDate, isoDate, DAYS } from "@/lib/format";
import { assignSubstitute, removeSubstitute } from "@/actions/daily";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Field, Td, buttonClass } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Substitute classes" };

export default async function SubstitutionsPage(props: PageProps<"/attendance/substitutions">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const sp = await props.searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDate(new Date());
  const d = new Date(`${date}T00:00:00Z`);
  const term = await currentTerm();
  const [slots, faculty, subs] = await Promise.all([
    db.timetableSlot.findMany({
      where: { dayOfWeek: d.getUTCDay(), offering: { ...offeringScope(user), termId: term?.id } },
      include: { offering: { include: { subject: true, batch: { include: { program: true } }, faculty: { include: { user: { select: { name: true } } } } } } },
      orderBy: [{ period: "asc" }],
    }),
    db.faculty.findMany({ where: user.role === "HOD" ? { departmentId: user.departmentId ?? "-" } : {}, include: { user: { select: { name: true } }, department: true }, orderBy: { user: { name: "asc" } } }),
    db.substitution.findMany({
      where: { date: { gte: new Date(isoDate(new Date())) }, offering: offeringScope(user) },
      include: { faculty: { include: { user: { select: { name: true } } } }, offering: { include: { subject: true, batch: { include: { program: true } }, faculty: { include: { user: { select: { name: true } } } } } } },
      orderBy: [{ date: "asc" }, { period: "asc" }],
    }),
  ]);
  return (
    <>
      <Breadcrumbs items={[{ label: "Attendance", href: "/attendance" }, { label: "Substitute classes" }]} />
      <PageHeader title="Substitute classes" subtitle="When a teacher is absent, assign another for that period. The substitute can take attendance for it." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Assign a substitute">
          <Filters><div><label className="label">Date</label><input type="date" name="date" aria-label="Date" defaultValue={date} className="input" /></div><button className={buttonClass("secondary")}>Load classes</button></Filters>
      <SavedFilters storageKey="edupilot-filters-attendance-substitutions" />
          {slots.length === 0 ? <p className="text-sm text-muted">No classes are scheduled on {DAYS[d.getUTCDay()] || "Sunday"}, {fmtDate(d)}.</p> : (
            <ActionForm action={assignSubstitute} className="space-y-3" resetOnSuccess>
              <input type="hidden" name="date" value={date} />
              <Field label="Class" name="slot">
                <select id="slot" name="slot" className="input" required>
                  {slots.map((s) => <option key={s.id} value={`${s.offeringId}|${s.period}`}>P{s.period} · {s.offering.subject.code} · {batchLabel(s.offering.batch)} · {s.offering.faculty?.user.name ?? "no teacher"}</option>)}
                </select>
              </Field>
              <Field label="Substitute" name="facultyId">
                <select id="facultyId" name="facultyId" className="input" required><option value="">Select</option>{faculty.map((f) => <option key={f.id} value={f.id}>{f.user.name} ({f.department.code})</option>)}</select>
              </Field>
              <Field label="Reason" name="reason"><input id="reason" name="reason" className="input" placeholder="On leave / official duty" /></Field>
              <SubmitButton>Assign</SubmitButton>
            </ActionForm>
          )}
        </Card>
        <Card title="Upcoming substitutions" className="lg:col-span-2">
          {subs.length === 0 ? <EmptyState title="No substitutions planned" /> : (
            <Table>
              <thead><tr><Th>Date</Th><Th>Class</Th><Th>Regular teacher</Th><Th>Substitute</Th><Th>Reason</Th><Th /></tr></thead>
              <tbody>{subs.map((s) => (
                <tr key={s.id}>
                  <Td className="whitespace-nowrap">{fmtDate(s.date)} · P{s.period}</Td>
                  <Td>{s.offering.subject.name}<p className="text-xs text-muted">{batchLabel(s.offering.batch)}</p></Td>
                  <Td>{s.offering.faculty?.user.name ?? "—"}</Td>
                  <Td className="font-medium">{s.faculty.user.name}</Td>
                  <Td className="text-xs text-muted">{s.reason}</Td>
                  <Td><ActionButton action={removeSubstitute} fields={{ id: s.id }} variant="ghost" confirm="Remove this substitution?">Remove</ActionButton></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
