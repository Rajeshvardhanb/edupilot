import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, programScope } from "@/lib/scope";
import { batchLabel, DAYS } from "@/lib/format";
import { TimetableEditor } from "./editor";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LinkButton } from "@/components/ui";
import { Card, PageHeader } from "@/components/ui-server";
import { PERIODS, PERIOD_TIMES, WEEKDAYS } from "@/components/timetable-grid";

export const metadata = { title: "Edit timetable" };

export default async function EditTimetablePage(props: PageProps<"/timetable/edit">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const { batch: batchId } = await props.searchParams;
  const term = await currentTerm();
  const batch = await db.batch.findFirst({ where: { id: String(batchId), program: programScope(user) }, include: { program: true } });
  if (!batch || !term) notFound();
  const [offerings, slots] = await Promise.all([
    db.courseOffering.findMany({ where: { batchId: batch.id, termId: term.id }, include: { subject: true, faculty: { include: { user: true } } }, orderBy: { subject: { code: "asc" } } }),
    db.timetableSlot.findMany({ where: { batchId: batch.id, offering: { termId: term.id } } }),
  ]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Timetable", href: `/timetable?batch=${batch.id}` }, { label: "Edit" }]} />
      <PageHeader title={`Edit timetable · ${batchLabel(batch)}`} subtitle={`${term.name}. Drag subjects onto the grid. Faculty clashes with other batches are blocked on save.`} actions={<LinkButton variant="secondary" href={`/timetable?batch=${batch.id}`}>Back</LinkButton>} />
      <Card>
        <TimetableEditor
          batchId={batch.id} days={WEEKDAYS} periods={PERIODS} times={PERIOD_TIMES} dayNames={DAYS}
          initial={Object.fromEntries(slots.map((s) => [`${s.dayOfWeek}:${s.period}`, { offeringId: s.offeringId, room: s.room ?? "" }]))}
          courses={offerings.map((o) => ({ id: o.id, code: o.subject.code, name: o.subject.name, faculty: o.faculty?.user.name ?? "No faculty", kind: o.subject.type, need: o.subject.lectureHrs + o.subject.tutorialHrs + o.subject.practicalHrs }))}
        />
      </Card>
    </>
  );
}
