"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PERIOD_TIMES, PERIODS, type GridSlot } from "./timetable-grid";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BAR: Record<string, string> = { LAB: "bg-[#0ea5e9]", ELECTIVE: "bg-[#10b981]", PROJECT: "bg-[#f59e0b]", AUDIT: "bg-slate-400" };

/** Phones: a row of days (this week's dates) and the chosen day's classes as a list, with free periods shown. */
export function TimetableDay({ slots }: { slots: GridSlot[] }) {
  const now = new Date();
  const todayDow = now.getDay();
  const [day, setDay] = useState(todayDow >= 1 && todayDow <= 6 ? todayDow : 1);
  const monday = new Date(now); monday.setDate(now.getDate() - ((todayDow + 6) % 7));
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const mine = slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.period - b.period);
  const last = mine.at(-1)?.period ?? 0;
  const rows = PERIODS.filter((p) => p <= last).map((p) => ({ p, slot: mine.find((s) => s.period === p) }));
  return (
    <div>
      <div role="tablist" aria-label="Day" className="mb-4 grid grid-cols-6 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((d) => {
          const date = new Date(monday); date.setDate(monday.getDate() + d - 1);
          return (
            <button key={d} role="tab" aria-selected={day === d} onClick={() => setDay(d)}
              className={cn("flex flex-col items-center rounded-xl border py-1.5 text-[11px]", day === d ? "brand-gradient border-transparent font-semibold text-white shadow-[var(--shadow-brand)]" : "border-line bg-surface text-muted")}>
              {SHORT[d]}<span className={cn("text-base font-bold", day === d ? "text-white" : "text-fg")}>{date.getDate()}</span>
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted">No classes on {SHORT[day]}.</p> : (
        <ol className="space-y-2.5">
          {rows.map(({ p, slot }) => {
            const live = day === todayDow && hhmm >= PERIOD_TIMES[p] && hhmm < (PERIOD_TIMES[p + 1] ?? "17:00");
            return (
              <li key={p} className="flex gap-3">
                <span className="w-11 shrink-0 pt-2.5 font-mono text-[11px] leading-tight text-muted">{PERIOD_TIMES[p]}<br />{PERIOD_TIMES[p + 1] ?? ""}</span>
                {slot ? (
                  <div className={cn("relative min-w-0 flex-1 overflow-hidden rounded-xl border bg-surface py-2.5 pr-3 pl-4", live ? "border-brand ring-2 ring-brand/20" : "border-line")}>
                    <span aria-hidden className={cn("absolute inset-y-2 left-1.5 w-1 rounded-full", BAR[slot.kind] ?? "bg-brand")} />
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("truncate text-sm font-semibold", live && "text-brand")}>{slot.title}</p>
                      {live && <span className="brand-gradient shrink-0 rounded-full px-2 py-px text-[10px] font-bold text-white">Now</span>}
                    </div>
                    <p className="truncate text-xs text-muted">{[slot.subtitle, slot.room].filter(Boolean).join(" · ")}</p>
                  </div>
                ) : <div className="flex-1 rounded-xl border border-dashed border-line px-4 py-2.5 text-xs text-muted">Free period</div>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
