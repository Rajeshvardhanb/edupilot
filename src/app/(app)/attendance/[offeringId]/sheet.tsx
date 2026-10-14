"use client";

import { useRef, useState, type FormEvent } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, buttonClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { queueAttendance } from "@/components/offline";
import { saveAttendance } from "@/actions/teaching";
import { cn } from "@/lib/utils";

type Status = "PRESENT" | "ABSENT" | "LATE" | "ON_DUTY";
const OPTIONS: { v: Status; label: string; cls: string }[] = [
  { v: "PRESENT", label: "P", cls: "bg-success text-white" },
  { v: "ABSENT", label: "A", cls: "bg-danger text-white" },
  { v: "LATE", label: "L", cls: "bg-warning text-white" },
  { v: "ON_DUTY", label: "OD", cls: "bg-info text-white" },
];

export function AttendanceSheet({ offeringId, date, period, topic, students, initial, leave, label, required, condonable }: {
  /** Attendance thresholds from the college rules. */
  required: number; condonable: number;
  offeringId: string; date: string; period: number; topic: string; label: string;
  students: { id: string; rollNo: string; name: string; pct: number }[];
  initial: Record<string, Status>;
  /** Approved requests covering this date: on-duty students default to OD, students on leave to absent. */
  leave: Record<string, "ON_DUTY" | "LEAVE">;
}) {
  const [marks, setMarks] = useState<Record<string, Status>>(() =>
    Object.fromEntries(students.map((s) => [s.id, initial[s.id] ?? (leave[s.id] === "ON_DUTY" ? "ON_DUTY" : leave[s.id] === "LEAVE" ? "ABSENT" : "PRESENT")])));
  const { toast } = useToast();
  const touch = useRef<{ id: string; x: number; y: number } | null>(null);
  const set = (id: string, v: Status) => setMarks((m) => ({ ...m, [id]: v }));
  const setAll = (v: Status) => setMarks(Object.fromEntries(students.map((s) => [s.id, leave[s.id] === "ON_DUTY" ? "ON_DUTY" : v])));
  const absent = Object.values(marks).filter((v) => v === "ABSENT").length;

  // No connection: keep the sheet on this device; OfflineSync uploads it when the network returns.
  function interceptOffline(e: FormEvent<HTMLDivElement>) {
    if (navigator.onLine) return;
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData(e.target as HTMLFormElement);
    queueAttendance({ offeringId, date, period, topic: String(fd.get("topic") ?? ""), marks, label });
    toast({ message: "You're offline. Attendance is saved on this device and will upload automatically.", tone: "info" }, 7000);
  }

  return (
    <div onSubmitCapture={interceptOffline}>
      <ActionForm action={saveAttendance} className="space-y-4">
        <input type="hidden" name="offeringId" value={offeringId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="period" value={period} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="label" htmlFor="topic">Topic covered</label>
            <input id="topic" name="topic" defaultValue={topic} className="input" placeholder="e.g. Unit 2 — Process scheduling" />
          </div>
          <button type="button" onClick={() => setAll("PRESENT")} className={buttonClass("secondary")}>All present</button>
          <button type="button" onClick={() => setAll("ABSENT")} className={buttonClass("secondary")}>All absent</button>
        </div>
        <p className="text-sm text-muted">
          <b className="text-fg">{students.length - absent}</b> present · <b className="text-danger">{absent}</b> absent · tap a name to toggle<span className="sm:hidden"> · swipe left = absent, right = present</span>
        </p>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {students.map((s) => (
            <li
              key={s.id} className={cn("flex items-center gap-3 px-3 py-2 transition-colors", marks[s.id] === "ABSENT" && "bg-danger-soft/40")}
              onTouchStart={(e) => { touch.current = { id: s.id, x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
              onTouchEnd={(e) => {
                const t = touch.current; touch.current = null;
                if (!t || t.id !== s.id) return;
                const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) set(s.id, dx < 0 ? "ABSENT" : "PRESENT");
              }}
            >
              <input type="hidden" name={`s_${s.id}`} value={marks[s.id]} />
              <button type="button" className="flex min-w-0 flex-1 flex-col-reverse items-start gap-0.5 text-left sm:flex-row sm:items-center sm:gap-3" onClick={() => set(s.id, marks[s.id] === "ABSENT" ? "PRESENT" : "ABSENT")}>
                <span className="shrink-0 font-mono text-[11px] text-muted sm:w-28 sm:text-xs">{s.rollNo}</span>
                <span className={cn("max-w-full truncate text-sm font-medium sm:font-normal", marks[s.id] === "ABSENT" && "text-danger line-through")}>{s.name}</span>
                {leave[s.id] && <Badge tone={leave[s.id] === "ON_DUTY" ? "info" : "neutral"}>{leave[s.id] === "ON_DUTY" ? "Approved OD" : "On leave"}</Badge>}
                {s.pct < required && <Badge tone={s.pct < condonable ? "danger" : "warning"}>{s.pct}%</Badge>}
              </button>
              <div className="flex gap-1">
                {OPTIONS.map((o) => (
                  <button key={o.v} type="button" aria-pressed={marks[s.id] === o.v} title={o.v} onClick={() => set(s.id, o.v)}
                    className={cn("h-8 min-w-8 rounded-md px-1.5 text-xs font-semibold", marks[s.id] === o.v ? o.cls : "bg-surface-2 text-muted hover:text-fg")}>{o.label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {/* Sticky action bar: rows scroll beneath it instead of being covered by a floating button. */}
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 -mb-5 flex items-center justify-between gap-3 rounded-b-[var(--radius-card)] border-t border-line bg-surface/95 px-5 py-3 backdrop-blur lg:bottom-0">
          <p className="text-sm text-muted" aria-live="polite"><b className="text-fg tabular-nums">{students.length - absent}</b> present · <b className="text-danger tabular-nums">{absent}</b> absent</p>
          <SubmitButton>Save attendance</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
