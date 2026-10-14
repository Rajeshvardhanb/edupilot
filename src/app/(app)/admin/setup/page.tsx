import Link from "next/link";
import { Building2, CalendarRange, Check, Download, FileSpreadsheet, GraduationCap, Layers, Palette, Users, Wallet, BookOpen, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInstitution } from "@/lib/institution";
import { SETUP_KINDS, setupTemplate, type SetupKind } from "@/lib/setup";
import { importSetup } from "@/actions/setup";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Gauge } from "@/components/infographics";
import { Badge, LinkButton } from "@/components/ui";
import { PageHeader, Tabs } from "@/components/ui-server";
import { ADMIN_TABS } from "../tabs";

export const metadata = { title: "College setup" };

type Step = { n: number; title: string; why: string; done: boolean; status: string; href: string; action: string; icon: typeof Building2; kind?: SetupKind; note?: string };

/** A guided checklist for bringing a new college onto the system, with spreadsheet import for the bulk steps. */
export default async function SetupPage() {
  await requireUser(["ADMIN"]);
  const [inst, depts, programs, terms, currentTerm, batches, subjects, faculty, structures, students] = await Promise.all([
    getInstitution(), db.department.count(), db.program.count(), db.term.count(), db.term.count({ where: { isCurrent: true } }),
    db.batch.count(), db.subject.count(), db.faculty.count(), db.feeStructure.count(), db.student.count(),
  ]);
  const branded = !!inst.address && !!inst.principalName;
  const count = (n: number, one: string, many = `${one}s`) => (n ? `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}` : "Not started");
  const steps: Step[] = [
    { n: 1, title: "College details", why: "Name, logo, address and principal. These print on every receipt, hall ticket and certificate.", done: branded, status: branded ? inst.name : "Address or principal's name is missing", href: "/admin/settings", action: "Open branding", icon: Palette },
    { n: 2, title: "Departments", why: "The branches of the college, such as CSE or Mechanical.", done: depts > 0, status: count(depts, "department"), href: "/academics", action: "Add one by one", icon: Building2, kind: "departments" },
    { n: 3, title: "Programmes", why: "The courses each department offers: Diploma, B.Tech, M.Tech.", done: programs > 0, status: count(programs, "programme"), href: "/academics/programs", action: "Add one by one", icon: GraduationCap, kind: "programs" },
    { n: 4, title: "Academic term", why: "The current semester's dates. Attendance, timetable and dashboards all follow it.", done: currentTerm > 0, status: currentTerm ? count(terms, "term") : terms ? "No term is marked current" : "Not started", href: "/academics/terms", action: "Add the term", icon: CalendarRange },
    { n: 5, title: "Batches and sections", why: "Each admission year and section of a programme, with the semester it is in now.", done: batches > 0, status: count(batches, "batch", "batches"), href: "/academics/batches", action: "Add one by one", icon: Layers, kind: "batches" },
    { n: 6, title: "Curriculum", why: "Every subject with its semester, credits, hours and marks split.", done: subjects > 0, status: count(subjects, "subject"), href: "/academics/subjects", action: "Add one by one", icon: BookOpen, kind: "subjects" },
    { n: 7, title: "Faculty", why: "Teachers and their departments. Each one gets a login.", done: faculty > 0, status: count(faculty, "teacher"), href: "/faculty/new", action: "Add one by one", icon: Users, kind: "faculty" },
    { n: 8, title: "Fee structures", why: "The fee heads for each programme and year of study.", done: structures > 0, status: count(structures, "structure"), href: "/fees/structures", action: "Add one by one", icon: Wallet, kind: "fees" },
    { n: 9, title: "Students", why: "Import each batch from the admissions list. Every student gets a login.", done: students > 0, status: count(students, "student"), href: "/students/import", action: "Import students", icon: GraduationCap, note: "Students are imported batch by batch on their own page, because each file belongs to one batch." },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <>
      <PageHeader title="Administration" subtitle="Set up a new college, step by step" />
      <Tabs active="/admin/setup" items={ADMIN_TABS} />
      <div className="tile mb-6 flex flex-wrap items-center gap-6 p-6">
        <Gauge value={Math.round((done / steps.length) * 100)} tone={done === steps.length ? "success" : "brand"} size={112}><p className="font-display text-2xl font-bold tabular-nums">{done}<span className="text-base font-semibold text-muted">/{steps.length}</span></p></Gauge>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight">{done === steps.length ? "Setup is complete" : `${steps.length - done} step${steps.length - done === 1 ? "" : "s"} to go`}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{done === steps.length ? "Every part of the college structure is in place. You can still import more rows here at any time; existing rows with the same code are updated, not duplicated." : "Work down the list in order: later steps refer to earlier ones (a programme needs its department, a subject needs its programme). Each bulk step accepts a spreadsheet saved as CSV."}</p>
        </div>
        {next && <LinkButton href={`#step-${next.n}`}>Continue with {next.title.toLowerCase()} <ArrowRight className="size-4" /></LinkButton>}
      </div>

      <ol className="space-y-4">
        {steps.map((s) => {
          const spec = s.kind ? SETUP_KINDS[s.kind] : null;
          return (
            <li key={s.n} id={`step-${s.n}`} className="tile scroll-mt-24 p-5 sm:p-6">
              <div className="flex flex-wrap items-start gap-4">
                <span className={`chip size-11 text-sm font-bold ${s.done ? "chip-success" : next?.n === s.n ? "" : "chip-neutral"}`}>{s.done ? <Check className="size-5" /> : s.n}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-display text-base font-bold tracking-tight">{s.title}</span><Badge tone={s.done ? "success" : next?.n === s.n ? "brand" : "neutral"}>{s.status}</Badge></p>
                  <p className="mt-1 text-sm text-muted">{s.why}</p>
                  {s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}
                </div>
                <LinkButton variant="secondary" href={s.href}><s.icon className="size-4" /> {s.action}</LinkButton>
              </div>
              {spec && s.kind && (
                <details className="group mt-4 rounded-[var(--radius-card)] border border-line bg-surface-2/40" open={next?.n === s.n}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold"><FileSpreadsheet className="size-4 text-brand" /> Import {spec.label.toLowerCase()} from a spreadsheet<span className="ml-auto text-xs font-normal text-muted group-open:hidden">Show</span><span className="ml-auto hidden text-xs font-normal text-muted group-open:inline">Hide</span></summary>
                  <div className="grid gap-5 border-t border-line p-4 lg:grid-cols-2">
                    <div className="min-w-0">
                      <p className="mb-2 text-xs text-muted">{spec.help} Columns marked * are required.</p>
                      <div className="overflow-x-auto rounded-xl border border-line bg-surface" tabIndex={0} role="region" aria-label={`${spec.label} template`}>
                        <table className="w-full text-left font-mono text-[11px]">
                          <thead><tr>{spec.columns.map((c) => <th key={c} className="border-b border-line bg-surface-2/70 px-2.5 py-2 font-semibold whitespace-nowrap">{c}{(spec.required as readonly string[]).includes(c) && <span className="text-danger">*</span>}</th>)}</tr></thead>
                          <tbody>{spec.sample.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} className="border-b border-line/60 px-2.5 py-1.5 whitespace-nowrap text-muted last:border-b-0">{v}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                      <a download={`${s.kind}-template.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(setupTemplate(s.kind))}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"><Download className="size-4" /> Download this template</a>
                    </div>
                    <ActionForm action={importSetup} className="space-y-3" resetOnSuccess>
                      <input type="hidden" name="kind" value={s.kind} />
                      <div><label className="label" htmlFor={`file-${s.kind}`}>CSV file (in Excel: File → Save as → CSV)</label><input id={`file-${s.kind}`} name="file" type="file" accept=".csv,text/csv" className="input text-xs" /></div>
                      <div><label className="label" htmlFor={`text-${s.kind}`}>…or paste the rows here, header line first</label><textarea id={`text-${s.kind}`} name="text" rows={3} className="input font-mono text-xs" placeholder={spec.columns.join(",")} /></div>
                      <SubmitButton>Import {spec.label.toLowerCase()}</SubmitButton>
                      <p className="text-xs text-muted">Rows that already exist are updated, so you can fix the file and upload it again. Rows with a problem are skipped and listed.</p>
                    </ActionForm>
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-sm text-muted">After setup: generate this term&apos;s courses and assign teachers under <Link href="/academics/allocation" className="text-brand">Academics → Course allocation</Link>, build the <Link href="/timetable" className="text-brand">timetable</Link>, and set your university&apos;s <Link href="/admin/rules" className="text-brand">rules</Link>.</p>
    </>
  );
}
