import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { offeringScope } from "@/lib/scope";
import { batchLabel, fmtDate, pct } from "@/lib/format";
import { addTopics, deleteTopic, toggleCoverage } from "@/actions/daily";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Gauge } from "@/components/infographics";
import { Field } from "@/components/ui";
import { Card, EmptyState, PageHeader } from "@/components/ui-server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lesson plan" };

export default async function LessonPlanPage(props: PageProps<"/syllabus/[offeringId]">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const { offeringId } = await props.params;
  const offering = await db.courseOffering.findFirst({
    where: { id: offeringId, ...offeringScope(user) },
    include: { subject: { include: { topics: { orderBy: [{ unit: "asc" }, { position: "asc" }] } } }, batch: { include: { program: true } }, coverage: true },
  });
  if (!offering) notFound();
  const covered = new Map(offering.coverage.map((c) => [c.topicId, c.coveredOn]));
  const topics = offering.subject.topics;
  const units = [...new Set(topics.map((t) => t.unit))];
  return (
    <>
      <Breadcrumbs items={[{ label: "Syllabus", href: "/syllabus" }, { label: offering.subject.name }]} />
      <PageHeader title={offering.subject.name} subtitle={`${offering.subject.code} · ${batchLabel(offering.batch)} · tick topics as you finish teaching them`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {topics.length === 0 && <EmptyState title="No lesson plan yet">Add the unit-wise topics using the form.</EmptyState>}
          {units.map((u) => {
            const list = topics.filter((t) => t.unit === u);
            const done = list.filter((t) => covered.has(t.id)).length;
            return (
              <Card key={u} title={`Unit ${u}`} actions={<span className="text-xs text-muted">{done}/{list.length} covered</span>}>
                <ul className="space-y-1">{list.map((t) => {
                  const on = covered.get(t.id);
                  return (
                    <li key={t.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                      <ActionButton action={toggleCoverage} fields={{ offeringId, topicId: t.id }} variant="ghost" className={cn("!size-6 !rounded-md !p-0", on ? "!bg-success !text-white" : "border border-line")}>{on ? <Check className="size-4" /> : ""}</ActionButton>
                      <span className={cn("flex-1 text-sm", on && "text-muted line-through")}>{t.title}</span>
                      {on && <span className="text-xs text-muted">{fmtDate(on)}</span>}
                      {user.role !== "FACULTY" && <span className="opacity-0 group-hover:opacity-100"><ActionButton action={deleteTopic} fields={{ id: t.id }} variant="ghost" confirm={`Remove “${t.title}” from the syllabus?`}>×</ActionButton></span>}
                    </li>
                  );
                })}</ul>
              </Card>
            );
          })}
        </div>
        <div className="space-y-6">
          <Card title="Coverage">
            <div className="flex flex-col items-center"><Gauge value={Math.round(pct(covered.size, topics.length))} label={`${covered.size}/${topics.length} topics`} tone="success" size={150} /></div>
          </Card>
          <Card title="Add topics">
            <ActionForm action={addTopics} className="space-y-3" resetOnSuccess>
              <input type="hidden" name="offeringId" value={offeringId} />
              <Field label="One topic per line. Start a unit with “Unit 2”." name="topics">
                <textarea id="topics" name="topics" rows={8} className="input font-mono text-xs" placeholder={"Unit 1\nIntroduction to networks\nOSI and TCP/IP models\nUnit 2\nData link layer"} />
              </Field>
              <SubmitButton>Add to lesson plan</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
