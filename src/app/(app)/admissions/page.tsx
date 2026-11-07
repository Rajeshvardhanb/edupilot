import { banner } from "@/lib/images";
import Link from "next/link";
import { Phone, CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, isoDate, pct } from "@/lib/format";
import { moveEnquiry, saveEnquiry } from "@/actions/campus";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Funnel } from "@/components/infographics";
import { BoardDnD } from "./board-dnd";
import { Badge, Field, buttonClass } from "@/components/ui";
import { Card, StatCard, PageBanner } from "@/components/ui-server";

export const metadata = { title: "Admissions" };
const STAGES = [["ENQUIRY", "Enquiry"], ["APPLIED", "Applied"], ["DOCUMENTS", "Documents verified"], ["ADMITTED", "Admitted"]] as const;
const STAGE_COLOR = ["#2563eb", "#7c3aed", "#b45309", "#047857"];
const NEXT: Record<string, string> = { ENQUIRY: "APPLIED", APPLIED: "DOCUMENTS", DOCUMENTS: "ADMITTED" };

export default async function AdmissionsPage() {
  await requireUser(["ADMIN", "OFFICE"]);
  const [rows, programs] = await Promise.all([
    db.enquiry.findMany({ include: { program: true }, orderBy: [{ followUpDate: "asc" }, { createdAt: "desc" }] }),
    db.program.findMany({ orderBy: { code: "asc" } }),
  ]);
  const today = new Date(isoDate(new Date()));
  const by = (s: string) => rows.filter((r) => r.stage === s);
  const due = rows.filter((r) => r.followUpDate && r.followUpDate <= today && !["ADMITTED", "LOST"].includes(r.stage));
  const reached = (i: number) => rows.filter((r) => r.stage !== "LOST" && STAGES.findIndex(([k]) => k === r.stage) >= i).length;
  return (
    <>
      <PageBanner {...banner("admissions")} eyebrow="Admissions 2026-27" tint="#3b2a8f" title="Admissions pipeline" subtitle="Track every enquiry from first call to admission." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active enquiries" value={rows.filter((r) => !["ADMITTED", "LOST"].includes(r.stage)).length} />
        <StatCard label="Follow-ups due" value={due.length} tone={due.length ? "danger" : "success"} icon={<CalendarClock className="size-5" />} />
        <StatCard label="Admitted" value={by("ADMITTED").length} tone="success" />
        <StatCard label="Conversion" value={`${pct(by("ADMITTED").length, rows.length)}%`} tone="info" hint={`${by("LOST").length} lost`} />
      </div>
      <Card title="New enquiry" className="mb-6">
        <ActionForm action={saveEnquiry} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" resetOnSuccess>
          <Field label="Applicant name" name="name" className="lg:col-span-2"><input id="name" name="name" className="input" required /></Field>
          <Field label="Phone" name="phone"><input id="phone" name="phone" className="input" inputMode="tel" required /></Field>
          <Field label="Programme of interest" name="programId"><select id="programId" name="programId" className="input"><option value="">Not decided</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></Field>
          <Field label="Source" name="source"><select id="source" name="source" className="input">{["Walk-in", "Website", "Reference", "Counselling", "Advertisement"].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Follow up on" name="followUpDate"><input id="followUpDate" type="date" name="followUpDate" className="input" /></Field>
          <Field label="Notes" name="notes" className="sm:col-span-2 lg:col-span-5"><input id="notes" name="notes" className="input" placeholder="What they asked about, what to do next" /></Field>
          <div className="flex items-end"><SubmitButton className="w-full">Add enquiry</SubmitButton></div>
        </ActionForm>
      </Card>
      <p className="no-print mb-3 hidden text-xs text-muted md:block">Drag a card to another column to move it, or use the buttons on the card.</p>
      <BoardDnD>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map(([key, label], i) => (
            <section key={key} data-drop-stage={key} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-2/60 transition data-[drop-over]:border-brand data-[drop-over]:bg-brand-soft data-[drop-over]:ring-4 data-[drop-over]:ring-brand/15">
              <header className="relative px-4 pt-4 pb-3">
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: STAGE_COLOR[i] }} />
                <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
                  <span className="grid size-6 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: STAGE_COLOR[i] }}>{i + 1}</span>
                  {label}
                  <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted tabular-nums ring-1 ring-line ring-inset">{by(key).length}</span>
                </h2>
              </header>
              <ul className="flex-1 space-y-2.5 px-2.5 pb-3">
                {by(key).map((e) => {
                  const overdue = e.followUpDate && e.followUpDate < today && key !== "ADMITTED";
                  const dueToday = e.followUpDate && e.followUpDate.getTime() === today.getTime() && key !== "ADMITTED";
                  return (
                    <li key={e.id} draggable data-enquiry={e.id} data-stage={key} data-name={e.name} className="tile tile-hover cursor-grab rounded-[var(--radius-card)] p-3.5 active:cursor-grabbing">
                      <div className="flex items-start gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: STAGE_COLOR[i] }}>{e.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug font-semibold">{e.name}</p>
                          <a href={`tel:${e.phone}`} className="mt-0.5 flex items-center gap-1 text-xs text-muted hover:text-brand"><Phone className="size-3" />{e.phone}</a>
                        </div>
                      </div>
                      <p className="mt-2.5 flex flex-wrap gap-1">{e.program && <Badge tone="brand">{e.program.code}</Badge>}{e.source && <Badge>{e.source}</Badge>}</p>
                      {e.notes && <p className="mt-2 line-clamp-2 text-xs text-muted">{e.notes}</p>}
                      {e.followUpDate && key !== "ADMITTED" && (
                        <p className={`mt-2.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ${overdue ? "bg-danger-soft text-danger" : dueToday ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted"}`}>
                          <CalendarClock className="size-3.5" />{overdue ? "Overdue since" : dueToday ? "Follow up today ·" : "Follow up"} {fmtDate(e.followUpDate)}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-1.5 border-t border-line/70 pt-2.5">
                        {NEXT[key] && <ActionButton action={moveEnquiry} fields={{ id: e.id, stage: NEXT[key] }} variant="secondary" className="flex-1">{STAGES.find(([k]) => k === NEXT[key])![1].split(" ")[0]} →</ActionButton>}
                        {key === "ADMITTED" ? <Link href="/students/new" className={buttonClass("secondary", "sm") + " flex-1"}>Create student record →</Link> : <ActionButton action={moveEnquiry} fields={{ id: e.id, stage: "LOST" }} variant="ghost" undoable={`Marking ${e.name} as lost`}>Lost</ActionButton>}
                      </div>
                    </li>
                  );
                })}
                {by(key).length === 0 && <li className="rounded-[var(--radius-card)] border border-dashed border-line px-3 py-8 text-center text-xs text-muted">Nobody at this stage</li>}
              </ul>
            </section>
          ))}
      </div>
      </BoardDnD>
      <Card title="Conversion funnel" className="mt-6">
        <div className="max-w-2xl"><Funnel stages={STAGES.map(([, label], i) => ({ label, value: reached(i), color: STAGE_COLOR[i] }))} /></div>
        <p className="mt-4 text-xs text-muted">Each bar counts everyone who reached that stage or went further. The percentage is the share that moved on from the stage before.</p>
      </Card>
    </>
  );
}
