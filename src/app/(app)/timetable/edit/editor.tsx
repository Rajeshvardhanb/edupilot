"use client";

import { useState } from "react";
import { GripVertical, X } from "lucide-react";
import { ActionForm, SubmitButton, useUnsavedWarning } from "@/components/forms";
import { saveTimetable } from "@/actions/teaching";
import { cn } from "@/lib/utils";

type Course = { id: string; code: string; name: string; faculty: string; need: number; kind: string };
type Cell = { offeringId: string; room: string };

const KIND: Record<string, string> = { LAB: "bg-info-soft border-info/30", PROJECT: "bg-warning-soft border-warning/30", THEORY: "bg-brand-soft border-brand/30", ELECTIVE: "bg-success-soft border-success/30", AUDIT: "bg-surface-2 border-line" };

/** Drag a subject onto a period (or pick it, then tap a period). Drag between periods to move; × clears. */
export function TimetableEditor({ batchId, courses, initial, days, periods, times, dayNames }: {
  batchId: string; courses: Course[]; initial: Record<string, Cell>; days: number[]; periods: number[]; times: string[]; dayNames: string[];
}) {
  const [grid, setGrid] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  useUnsavedWarning(dirty);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const hours = (id: string) => Object.values(grid).filter((c) => c.offeringId === id).length;
  const change = (fn: (g: Record<string, Cell>) => Record<string, Cell>) => { setGrid(fn); setDirty(true); };

  function drop(key: string, data: string) {
    const [kind, value] = data.split("|");
    change((g) => {
      const next = { ...g };
      if (kind === "course") next[key] = { offeringId: value, room: g[key]?.room ?? "" };
      else if (kind === "cell" && value !== key && g[value]) {
        const target = g[key];
        next[key] = g[value];
        if (target) next[value] = target; else delete next[value]; // swap or move
      }
      return next;
    });
    setOver(null);
  }

  return (
    <ActionForm action={saveTimetable} onResult={(s) => { if (s.ok) setDirty(false); }}>
      <input type="hidden" name="batchId" value={batchId} />
      {Object.entries(grid).map(([k, c]) => { const [d, p] = k.split(":"); return <span key={k}><input type="hidden" name={`slot_${d}_${p}`} value={c.offeringId} /><input type="hidden" name={`room_${d}_${p}`} value={c.room} /></span>; })}
      <div className="mb-4 flex flex-wrap gap-2">
        {courses.map((c) => {
          const h = hours(c.id);
          return (
            <button
              key={c.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", `course|${c.id}`)} onClick={() => setPicked(picked === c.id ? null : c.id)}
              aria-pressed={picked === c.id} title={`${c.name} · ${c.faculty}`}
              className={cn("flex cursor-grab items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs active:cursor-grabbing", KIND[c.kind] ?? KIND.THEORY, picked === c.id && "ring-2 ring-brand")}
            >
              <GripVertical className="size-3.5 text-muted" />
              <span><span className="block font-medium">{c.code}</span><span className="block max-w-36 truncate text-[10px] text-muted">{c.name}</span></span>
              <span className={cn("ml-1 rounded-full px-1.5 text-[10px] font-semibold", h < c.need ? "bg-warning-soft text-warning" : h > c.need ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>{h}/{c.need}</span>
            </button>
          );
        })}
      </div>
      {picked && <p className="mb-2 text-xs text-brand">Tap a period to place <b>{byId.get(picked)?.code}</b>. Tap the subject again to stop.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-1 text-xs">
          <thead><tr><th className="w-12" />{periods.map((p) => <th key={p} className="font-medium text-muted">P{p}<div className="font-normal">{times[p]}</div></th>)}</tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d}>
                <th className="pr-1 text-left font-semibold">{dayNames[d]}</th>
                {periods.map((p) => {
                  const key = `${d}:${p}`, c = grid[key], course = c && byId.get(c.offeringId);
                  return (
                    <td
                      key={p} onDragOver={(e) => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver((o) => (o === key ? null : o))}
                      onDrop={(e) => { e.preventDefault(); drop(key, e.dataTransfer.getData("text/plain")); }}
                      onClick={() => { if (picked) change((g) => ({ ...g, [key]: { offeringId: picked, room: g[key]?.room ?? "" } })); }}
                      className={cn("h-[4.5rem] rounded-lg border align-top transition", course ? KIND[course.kind] ?? KIND.THEORY : "border-dashed border-line", over === key && "ring-2 ring-brand", picked && "cursor-pointer")}
                    >
                      {course && (
                        <div draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", `cell|${key}`)} className="group relative h-full cursor-grab p-1.5 active:cursor-grabbing">
                          <p className="line-clamp-1 pr-4 font-medium">{course.code}</p>
                          <p className="truncate text-[10px] text-muted">{course.faculty}</p>
                          <input
                            value={c.room} onClick={(e) => e.stopPropagation()} onChange={(e) => change((g) => ({ ...g, [key]: { ...g[key], room: e.target.value } }))}
                            placeholder="Room" aria-label={`Room for ${dayNames[d]} P${p}`} className="mt-0.5 w-full rounded border border-line/60 bg-surface/70 px-1 py-0.5 text-[10px]"
                          />
                          <button type="button" aria-label={`Clear ${dayNames[d]} P${p}`} onClick={(e) => { e.stopPropagation(); change((g) => { const n = { ...g }; delete n[key]; return n; }); }} className="absolute top-1 right-1 rounded text-muted opacity-60 hover:bg-surface hover:text-danger hover:opacity-100"><X className="size-3.5" /></button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted">Badges show periods placed / weekly hours required.{dirty && <span className="ml-2 font-medium text-warning">● Unsaved changes</span>}</p>
        <SubmitButton>Save timetable</SubmitButton>
      </div>
    </ActionForm>
  );
}
