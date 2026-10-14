import { learnerId } from "@/lib/learner";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { batchOptions } from "@/lib/options";
import { batchLabel } from "@/lib/format";
import { LinkButton } from "@/components/ui";
import { Card, EmptyState, PageHeader } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { TimetableGrid, type GridSlot } from "@/components/timetable-grid";

export const metadata = { title: "Timetable" };

export default async function TimetablePage(props: PageProps<"/timetable">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const term = await currentTerm();
  const include = { offering: { include: { subject: true, faculty: { include: { user: true } }, batch: { include: { program: true } } } } } as const;

  let title = "";
  let slots: GridSlot[] = [];
  let batchId = typeof sp.batch === "string" ? sp.batch : "";
  let facultyId = typeof sp.faculty === "string" ? sp.faculty : "";
  const staff = user.role === "ADMIN" || user.role === "HOD" || user.role === "ACCOUNTANT" || user.role === "OFFICE";

  if (user.role === "STUDENT" || user.role === "PARENT") {
    batchId = (await db.student.findUniqueOrThrow({ where: { id: learnerId(user) } })).batchId;
    facultyId = "";
  } else if (user.role === "FACULTY" && !batchId) {
    facultyId = user.facultyId!;
  }
  const [batches, faculty] = staff || user.role === "FACULTY"
    ? await Promise.all([batchOptions(user.role === "HOD" ? user : undefined), db.faculty.findMany({ where: user.role === "HOD" ? { departmentId: user.departmentId! } : {}, include: { user: true }, orderBy: { user: { name: "asc" } } })])
    : [[], []];
  if (staff && !batchId && !facultyId) batchId = batches[0]?.id ?? "";

  if (facultyId) {
    const rows = await db.timetableSlot.findMany({ where: { offering: { facultyId, termId: term?.id } }, include });
    const f = await db.faculty.findUnique({ where: { id: facultyId }, include: { user: true } });
    title = `${f?.user.name ?? "Faculty"} — teaching timetable`;
    slots = rows.map((s) => ({ ...s, title: s.offering.subject.name, subtitle: batchLabel(s.offering.batch), kind: s.offering.subject.type }));
  } else if (batchId) {
    const rows = await db.timetableSlot.findMany({ where: { batchId, offering: { termId: term?.id } }, include });
    const b = await db.batch.findUnique({ where: { id: batchId }, include: { program: true } });
    title = b ? `${batchLabel(b)} · Semester ${b.currentSemester}` : "";
    slots = rows.map((s) => ({ ...s, title: s.offering.subject.name, subtitle: s.offering.faculty?.user.name ?? "TBA", kind: s.offering.subject.type }));
  }

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={term?.name}
        actions={(user.role === "ADMIN" || user.role === "HOD") && batchId && <LinkButton variant="secondary" href={`/timetable/edit?batch=${batchId}`}><Pencil className="size-4" /> Edit batch timetable</LinkButton>}
      />
      {user.role !== "STUDENT" && user.role !== "PARENT" && (
        <Filters>
          <select name="batch" aria-label="Batch" defaultValue={facultyId ? "" : batchId} className="input w-auto"><option value="">— Batch —</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
          <select name="faculty" aria-label="Faculty" defaultValue={facultyId} className="input w-auto"><option value="">— Faculty —</option>{faculty.map((f) => <option key={f.id} value={f.id}>{f.user.name}</option>)}</select>
        </Filters>
      )}
      <Card title={title || "Timetable"}>
        {slots.length ? <TimetableGrid slots={slots} /> : <EmptyState title="No timetable published yet" />}
      </Card>
    </>
  );
}
