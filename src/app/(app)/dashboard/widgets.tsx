import { ScheduleIllustration } from "@/components/illustrations";
import { PERIOD_TIMES } from "@/components/timetable-grid";
import { Badge } from "@/components/ui";
import { Card } from "@/components/ui-server";
import { DAYS } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { cn } from "@/lib/utils";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

type SlotWithOffering = {
  period: number;
  room: string | null;
  offering: { subject: { code: string; name: string; type?: string }; batch?: { admissionYear: number; section: string; program: { code: string } } };
};

/** Today's classes as a vertical timeline; marks the current period live. */
export function TodaySchedule({ slots, showBatch }: { slots: SlotWithOffering[]; showBatch?: boolean }) {
  const now = new Date();
  const dow = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // Merge back-to-back periods of the same course (e.g. a 3-period lab) into one block.
  const blocks: (SlotWithOffering & { last: number; key: string })[] = [];
  for (const s of slots) {
    const prev = blocks.at(-1);
    if (prev && prev.last === s.period - 1 && prev.offering.subject.code === s.offering.subject.code) prev.last = s.period;
    else blocks.push({ ...s, last: s.period, key: `${s.period}` });
  }
  const current = blocks.find((s) => hhmm >= PERIOD_TIMES[s.period] && hhmm < (PERIOD_TIMES[s.last + 1] ?? "17:00"));
  return (
    <Card title={`Today · ${DAYS[dow] || "Sunday"}`} actions={<Link href="/timetable" className="text-xs text-brand">Timetable →</Link>}>
      {slots.length === 0 ? (
        <div className="py-4 text-center"><ScheduleIllustration className="mx-auto h-28" /><p className="mt-2 text-sm text-muted">No classes scheduled today</p></div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-dashed border-line pl-5">
          {blocks.map((s) => {
            const live = current?.period === s.period;
            return (
              <li key={s.key} className="relative">
                <span className={cn("absolute top-3 -left-[27px] size-3 rounded-full ring-4 ring-surface", live ? "animate-pulse bg-success" : "bg-brand")} />
                <div className={cn("rounded-xl p-3", live ? "bg-success-soft" : "bg-surface-2")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{s.offering.subject.name}</p>
                    {live ? <Badge tone="success">Now</Badge> : <span className="text-xs text-muted tabular-nums">{PERIOD_TIMES[s.period]}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.last > s.period ? `P${s.period}–P${s.last}` : `P${s.period}`} · {s.offering.subject.code}
                    {showBatch && s.offering.batch && ` · ${s.offering.batch.program.code} ${s.offering.batch.admissionYear}-${s.offering.batch.section}`}
                    {s.room && ` · ${s.room}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

type NowSlot = { period: number; room: string | null; offering: { id: string; subject: { code: string; name: string }; batch?: { admissionYear: number; section: string; program: { code: string } }; faculty?: { user: { name: string } } | null } };

/** Phones: the class happening now (or next) as a gradient card; teachers get a Take attendance button for it. */
export async function NowCard({ slots, teacher, students }: { slots: NowSlot[]; teacher?: boolean; students?: number }) {
  const t = await getT();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const sorted = [...slots].sort((a, b) => a.period - b.period);
  const end = (p: number) => PERIOD_TIMES[p + 1] ?? "17:00";
  const live = sorted.find((s) => hhmm >= PERIOD_TIMES[s.period] && hhmm < end(s.period));
  const next = sorted.find((s) => PERIOD_TIMES[s.period] > hhmm && s !== live);
  const show = live ?? next;
  if (!show) return null;
  const batch = show.offering.batch ? `${show.offering.batch.program.code} ${show.offering.batch.admissionYear}-${show.offering.batch.section}` : null;
  const sub = [show.offering.subject.code, teacher ? batch : show.offering.faculty?.user.name, show.room, teacher && students ? `${students} students` : null].filter(Boolean).join(" · ");
  const following = live ? next : sorted.find((s) => s.period > show.period);
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#c026d3] p-4 text-white shadow-[var(--shadow-brand)]">
      <span aria-hidden className="absolute -top-8 -right-8 size-28 rounded-full bg-white/10" />
      <p className="relative flex items-center gap-1.5 text-xs text-white/85">
        <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-300" : "bg-white/70")} />{live ? t("In class now") : t("Next class")} · P{show.period} · {PERIOD_TIMES[show.period]}
      </p>
      <div className="relative mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-lg font-bold">{show.offering.subject.name}</p><p className="truncate text-xs text-white/80">{sub}</p></div>
        {!teacher && following && following !== show && <p className="shrink-0 text-right text-[11px] text-white/80">Next<br /><b className="text-white">{following.offering.subject.name.split(" ")[0]} {PERIOD_TIMES[following.period]}</b></p>}
      </div>
      {teacher && (
        <Link href={`/attendance/${show.offering.id}?date=${new Date().toISOString().slice(0, 10)}&period=${show.period}`} className="relative mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-brand">
          <ClipboardCheck className="size-4" /> {t("Take attendance")}
        </Link>
      )}
    </section>
  );
}
