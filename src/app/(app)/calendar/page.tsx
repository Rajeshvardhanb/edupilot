import { banner } from "@/lib/images";
import { PhotoBanner } from "@/components/hero";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, isoDate, titleCase } from "@/lib/format";
import { saveEvent, deleteEvent } from "@/actions/daily";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, type Tone } from "@/components/ui";
import { Card, PageHeader } from "@/components/ui-server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Academic calendar" };
const TONE: Record<string, Tone> = { HOLIDAY: "danger", EXAM: "warning", EVENT: "info" };
const DOT: Record<string, string> = { HOLIDAY: "bg-danger", EXAM: "bg-warning", EVENT: "bg-info" };

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const now = new Date();
  const m = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = m.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1)), last = new Date(Date.UTC(y, mo, 0));
  const shift = (d: number) => { const x = new Date(Date.UTC(y, mo - 1 + d, 1)); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`; };

  const [events, upcoming] = await Promise.all([
    db.calendarEvent.findMany({ where: { OR: [{ date: { gte: first, lte: last } }, { date: { lte: last }, endDate: { gte: first } }] }, orderBy: { date: "asc" } }),
    db.calendarEvent.findMany({ where: { OR: [{ date: { gte: new Date(isoDate(now)) } }, { endDate: { gte: new Date(isoDate(now)) } }] }, orderBy: { date: "asc" }, take: 8 }),
  ]);
  const on = (d: Date) => events.filter((e) => e.date <= d && (e.endDate ?? e.date) >= d);
  const cells: (Date | null)[] = [...Array((first.getUTCDay() + 6) % 7).fill(null), ...Array.from({ length: last.getUTCDate() }, (_, i) => new Date(Date.UTC(y, mo - 1, i + 1)))];
  const today = isoDate(now);

  return (
    <>
      <PhotoBanner {...banner("calendar")} />
      <PageHeader title="Academic calendar" subtitle="Holidays block attendance marking for that day." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
          actions={<span className="flex gap-1"><Link href={`/calendar?m=${shift(-1)}`} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-surface-2"><ChevronLeft className="size-4" /></Link><Link href="/calendar" className="rounded-lg px-2 py-1 text-xs hover:bg-surface-2">Today</Link><Link href={`/calendar?m=${shift(1)}`} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-surface-2"><ChevronRight className="size-4" /></Link></span>}>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const evs = on(d);
              const holiday = evs.some((e) => e.type === "HOLIDAY") || d.getUTCDay() === 0;
              return (
                <div key={i} className={cn("min-h-20 rounded-xl border p-1.5 text-left", holiday ? "border-danger/20 bg-danger-soft/40" : "border-line", isoDate(d) === today && "ring-2 ring-brand")}>
                  <p className={cn("text-xs font-medium", holiday && "text-danger")}>{d.getUTCDate()}</p>
                  {evs.slice(0, 2).map((e) => <p key={e.id} title={e.title} className="mt-0.5 flex items-center gap-1 truncate text-[10px]"><span className={cn("size-1.5 shrink-0 rounded-full", DOT[e.type])} /><span className="truncate">{e.title}</span></p>)}
                  {evs.length > 2 && <p className="text-[10px] text-muted">+{evs.length - 2} more</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-4 text-xs text-muted">{Object.keys(DOT).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", DOT[k])} />{titleCase(k)}</span>)}</p>
        </Card>
        <div className="space-y-6">
          <Card title="Coming up">
            {upcoming.length === 0 ? <p className="text-sm text-muted">Nothing scheduled.</p> : (
              <ul className="space-y-3">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <div className="w-12 shrink-0 rounded-lg bg-surface-2 py-1 text-center"><p className="text-sm font-semibold">{e.date.getUTCDate()}</p><p className="text-[10px] text-muted uppercase">{e.date.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</p></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted">{e.endDate ? `until ${fmtDate(e.endDate)}` : e.description ?? ""}</p></div>
                    <Badge tone={TONE[e.type]}>{titleCase(e.type)}</Badge>
                    {user.role === "ADMIN" && <ActionButton action={deleteEvent} fields={{ id: e.id }} variant="ghost" undoable={`Removing “${e.title}”`}>×</ActionButton>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {user.role === "ADMIN" && (
            <Card title="Add to calendar">
              <ActionForm action={saveEvent} className="space-y-3" resetOnSuccess>
                <Field label="Title" name="title"><input id="title" name="title" className="input" placeholder="Diwali" required /></Field>
                <Field label="Type" name="type"><select id="type" name="type" className="input"><option value="HOLIDAY">Holiday</option><option value="EXAM">Exam</option><option value="EVENT">Event</option></select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" name="date"><input id="date" type="date" name="date" className="input" required /></Field>
                  <Field label="Until (optional)" name="endDate"><input id="endDate" type="date" name="endDate" className="input" /></Field>
                </div>
                <Field label="Note" name="description"><input id="description" name="description" className="input" /></Field>
                <SubmitButton>Add</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
