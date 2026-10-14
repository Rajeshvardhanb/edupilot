import { Coffee, MapPin } from "lucide-react";
import { DAYS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const PERIOD_TIMES = ["", "09:00", "09:50", "10:50", "11:40", "13:20", "14:10", "15:00", "15:50"];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS = [1, 2, 3, 4, 5, 6];
const PERIOD_MINUTES = 50;
const LUNCH_AFTER = 4; // the lunch break sits between P4 and P5
const SATURDAY_PERIODS = 4;

export type GridSlot = { dayOfWeek: number; period: number; room: string | null; title: string; subtitle: string; kind: string };

// Each kind of class gets a tinted card with a solid bar on its left edge.
const KIND: Record<string, { card: string; bar: string; label: string }> = {
  THEORY: { card: "bg-brand-soft/70 border-brand/15", bar: "bg-brand", label: "Theory" },
  LAB: { card: "bg-info-soft border-info/20", bar: "bg-info", label: "Lab" },
  ELECTIVE: { card: "bg-success-soft border-success/20", bar: "bg-success", label: "Elective" },
  PROJECT: { card: "bg-warning-soft border-warning/25", bar: "bg-warning", label: "Project" },
  AUDIT: { card: "bg-surface-2 border-line", bar: "bg-muted", label: "Audit" },
};

const endOf = (start: string) => {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + PERIOD_MINUTES;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function TimetableGrid({ slots }: { slots: GridSlot[] }) {
  const at = new Map(slots.map((s) => [`${s.dayOfWeek}:${s.period}`, s]));
  const now = new Date();
  const today = now.getDay();
  const hhmm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const livePeriod = PERIODS.find((p) => hhmm >= PERIOD_TIMES[p] && hhmm < endOf(PERIOD_TIMES[p]));
  const kinds = [...new Set(slots.map((s) => (KIND[s.kind] ? s.kind : "THEORY")))];
  return (
    <div>
      <div className="relative overflow-x-auto pb-1" tabIndex={0} role="region" aria-label="Timetable">
        <table className="w-full min-w-[900px] border-separate border-spacing-1.5 text-xs">
          <thead>
            <tr>
              <th className="w-14" />
              {PERIODS.map((p) => (
                <th key={p} scope="col" className={cn("pb-1 text-center font-normal", p === LUNCH_AFTER + 1 && "pl-6")}>
                  <span className={cn("inline-flex flex-col items-center rounded-xl px-3 py-1.5", p === livePeriod ? "bg-brand text-white shadow-card" : "bg-surface-2/80 text-muted")}>
                    <span className={cn("font-display text-[13px] font-bold", p !== livePeriod && "text-fg")}>P{p}</span>
                    <span className="text-[10.5px] tabular-nums">{PERIOD_TIMES[p]}–{endOf(PERIOD_TIMES[p])}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((d) => (
              <tr key={d}>
                <th scope="row" className="pr-1 text-left align-middle">
                  <span className={cn("grid h-[4.5rem] place-items-center rounded-xl font-display text-[13px] font-bold", d === today ? "brand-gradient text-white shadow-card" : "bg-surface-2/80 text-fg")}>{DAYS[d]}</span>
                </th>
                {PERIODS.map((p) => {
                  const s = at.get(`${d}:${p}`);
                  const k = s ? KIND[s.kind] ?? KIND.THEORY : null;
                  const off = d === 6 && p > SATURDAY_PERIODS; // Saturday afternoon: no classes
                  const live = d === today && p === livePeriod;
                  return (
                    <td key={p} className={cn("h-[4.5rem] p-0 align-top", p === LUNCH_AFTER + 1 && "pl-6")}>
                      {s && k ? (
                        <div className={cn("relative h-full overflow-hidden rounded-xl border py-2 pr-2 pl-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-card", k.card, live && "ring-2 ring-brand ring-offset-2 ring-offset-surface")}>
                          <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", k.bar)} />
                          <p className="line-clamp-2 text-[12.5px] leading-tight font-semibold">{s.title}</p>
                          <p className="mt-1 truncate text-[11px] text-muted">{s.subtitle}</p>
                          {s.room && <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-muted"><MapPin className="size-3 shrink-0" />{s.room}</p>}
                        </div>
                      ) : (
                        <div className={cn("h-full rounded-xl border border-dashed", off ? "border-transparent bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--surface-2)_6px_12px)] opacity-70" : "border-line/80")}><span className="sr-only">{off ? "No classes" : "Free"}</span></div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        {kinds.map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("h-3 w-1.5 rounded-full", KIND[k].bar)} />{KIND[k].label}</span>)}
        <span className="flex items-center gap-1.5"><Coffee className="size-3.5" /> Lunch 12:30–13:20</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--line)_3px_6px)]" /> Saturday is a half day (P1–P4)</span>
      </div>
    </div>
  );
}
