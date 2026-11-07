"use client";

import { useRef, useState, type FormEvent } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, buttonClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { queueAttendance } from "@/components/offline";
import { saveAttendance } from "@/actions/teaching";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Status = "PRESENT" | "ABSENT" | "LATE" | "ON_DUTY";
const OPTIONS: { v: Status; label: string; name: string; cls: string }[] = [
  { v: "PRESENT", label: "P", name: "present", cls: "bg-[#10b981] text-white shadow-xs" },
  { v: "ABSENT", label: "A", name: "absent", cls: "bg-[#f43f5e] text-white shadow-xs" },
  { v: "LATE", label: "L", name: "late", cls: "bg-[#f59e0b] text-white shadow-xs" },
  { v: "ON_DUTY", label: "OD", name: "on duty", cls: "bg-[#0ea5e9] text-white shadow-xs" },
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

  const onDuty = Object.values(marks).filter((v) => v === "ON_DUTY").length;
  const present = students.length - absent;
  const [q, setQ] = useState("");
  const shown = (s: { rollNo: string; name: string }) => !q || `${s.rollNo} ${s.name}`.toLowerCase().includes(q.toLowerCase());
  const ring = students.length ? present / students.length : 0;

  return (
    <div onSubmitCapture={interceptOffline}>
      <ActionForm action={saveAttendance} className="space-y-4">
        <input type="hidden" name="offeringId" value={offeringId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="period" value={period} />

        {/* Summary: how many are present, at a glance. */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e4e3f6] bg-gradient-to-r from-[#f5f6ff] via-white to-[#fdf4f8] p-4">
          <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r="27" fill="none" stroke="#e7e8f3" strokeWidth="7" />
            <circle cx="32" cy="32" r="27" fill="none" stroke="url(#att-ring)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${ring * 169.6} 169.6`} />
            <defs><linearGradient id="att-ring" x1="0" x2="1"><stop offset="0" stopColor="#14b8a6" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient></defs>
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold" aria-live="polite">{absent === 0 ? "Everyone is present" : `${absent} absent today`}</p>
            <p className="text-xs text-muted">Everyone starts as present. Tap a student to mark absent, late or on duty<span className="sm:hidden"> (or swipe left for absent)</span>.</p>
          </div>
          <span className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-success tabular-nums">{present} present</span>
            <span className="rounded-full bg-danger-soft px-2.5 py-1 text-danger tabular-nums">{absent} absent</span>
            <span className="rounded-full bg-info-soft px-2.5 py-1 text-info tabular-nums">{onDuty} on duty</span>
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label className="label" htmlFor="topic">Topic covered</label>
            <input id="topic" name="topic" defaultValue={topic} className="input" placeholder="e.g. Unit 2 — Process scheduling" />
          </div>
          <div className="min-w-44 flex-1 sm:max-w-56">
            <label className="label" htmlFor="find-student">Find a student</label>
            <input id="find-student" value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Name or roll no" />
          </div>
          <button type="button" onClick={() => setAll("PRESENT")} className={buttonClass("secondary")}><Check /> All present</button>
          <button type="button" onClick={() => setAll("ABSENT")} className={buttonClass("secondary")}>All absent</button>
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          {students.map((s) => (
            <li
              key={s.id} hidden={!shown(s)}
              className={cn("flex items-center gap-2 rounded-xl border p-2.5 transition-colors sm:block sm:p-3", marks[s.id] === "ABSENT" ? "border-[#fbb6c7] bg-[#fff5f7]" : "border-line bg-surface")}
              onTouchStart={(e) => { touch.current = { id: s.id, x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
              onTouchEnd={(e) => {
                const t = touch.current; touch.current = null;
                if (!t || t.id !== s.id) return;
                const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) set(s.id, dx < 0 ? "ABSENT" : "PRESENT");
              }}
            >
              <input type="hidden" name={`s_${s.id}`} value={marks[s.id]} />
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:w-full" onClick={() => set(s.id, marks[s.id] === "ABSENT" ? "PRESENT" : "ABSENT")}>
                <Avatar name={s.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block font-mono text-[11px] text-muted">{s.rollNo}</span>
                </span>
                {leave[s.id] && <Badge tone={leave[s.id] === "ON_DUTY" ? "info" : "neutral"}>{leave[s.id] === "ON_DUTY" ? "Approved OD" : "On leave"}</Badge>}
                {s.pct < required && <span className={cn("text-xs font-bold tabular-nums", s.pct < condonable ? "text-danger" : "text-warning")}>{s.pct}%</span>}
              </button>
              <div className="grid w-[9.5rem] shrink-0 grid-cols-4 gap-1 rounded-lg bg-[#f2f3f9] p-1 sm:mt-2.5 sm:w-auto">
                {OPTIONS.map((o) => (
                  <button key={o.v} type="button" aria-pressed={marks[s.id] === o.v} title={o.v} aria-label={`${s.name}: ${o.name}`} onClick={() => set(s.id, o.v)}
                    className={cn("h-8 rounded-md text-xs font-semibold transition-colors", marks[s.id] === o.v ? o.cls : "text-muted hover:bg-white hover:text-fg")}>{o.label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {/* Sticky action bar: cards scroll beneath it instead of being covered by a floating button. */}
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 -mb-5 flex items-center justify-between gap-3 rounded-b-[var(--radius-card)] border-t border-line bg-surface/95 px-5 py-3 backdrop-blur lg:bottom-0">
          <p className="text-sm text-muted"><b className="text-fg tabular-nums">{present}</b> present · <b className="text-danger tabular-nums">{absent}</b> absent</p>
          <SubmitButton><Check /> Save attendance</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
