"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ActionForm, SubmitButton, useUnsavedWarning } from "@/components/forms";
import { useToast } from "@/components/toast";
import { saveMarks } from "@/actions/teaching";

export function MarksGrid({ offeringId, assessments, students, locked }: {
  offeringId: string;
  assessments: { id: string; name: string; maxMarks: number }[];
  students: { id: string; rollNo: string; name: string; marks: Record<string, string> }[];
  locked: boolean;
}) {
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();
  useUnsavedWarning(dirty);
  // What is typed in each cell right now, so totals, averages and warnings update as marks are entered.
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(students.flatMap((s, r) => assessments.map((a, c) => [`${r}-${c}`, s.marks[a.id] ?? ""]))));
  const cell = (r: number, c: number) => document.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`);
  const sync = () => setVals(Object.fromEntries([...document.querySelectorAll<HTMLInputElement>("[data-cell]")].map((i) => [i.dataset.cell!, i.value])));

  const parse = (v: string) => { const t = v.trim().toUpperCase(); return t === "" ? null : t === "AB" ? "AB" as const : Number(t); };
  /** A cell is wrong when it isn't a number or AB, is negative, or is more than the maximum. */
  const bad = (r: number, c: number) => { const v = parse(vals[`${r}-${c}`] ?? ""); return v !== null && v !== "AB" && (!Number.isFinite(v) || v < 0 || v > assessments[c].maxMarks); };
  const rowTotal = (r: number) => {
    let got = 0, max = 0, any = false;
    assessments.forEach((a, c) => { const v = parse(vals[`${r}-${c}`] ?? ""); if (v === null) return; any = true; max += a.maxMarks; if (v !== "AB" && Number.isFinite(v)) got += v; });
    return any && max ? { got, max, pct: Math.round((got / max) * 100) } : null;
  };
  const colStats = (c: number) => {
    const nums = students.map((_, r) => parse(vals[`${r}-${c}`] ?? "")).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const filled = students.filter((_, r) => (vals[`${r}-${c}`] ?? "").trim() !== "").length;
    return { avg: nums.length ? Math.round((nums.reduce((t, v) => t + v, 0) / nums.length) * 10) / 10 : null, filled };
  };
  const errors = students.reduce((n, _, r) => n + assessments.filter((__, c) => bad(r, c)).length, 0);

  // Enter / arrow keys move between cells like a spreadsheet.
  function onKey(e: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const move = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    cell(row + move, col)?.focus();
  }

  // Paste a block copied from Excel / Google Sheets: rows by newline, columns by tab.
  function onPaste(e: ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return; // single value: let the browser handle it
    e.preventDefault();
    let filled = 0;
    text.replace(/\r/g, "").split("\n").filter((l, i, a) => l !== "" || i < a.length - 1).forEach((line, r) => {
      line.split("\t").forEach((v, c) => {
        const input = cell(row + r, col + c);
        if (input && !input.disabled) { input.value = v.trim(); filled++; }
      });
    });
    setDirty(true);
    sync();
    toast({ message: `Pasted ${filled} cells. Review and click Save marks.`, tone: "info" });
  }

  return (
    <ActionForm action={saveMarks} className="space-y-4" onResult={(s) => { if (s.ok) setDirty(false); }}>
      <input type="hidden" name="offeringId" value={offeringId} />
      <div className="max-h-[70vh] overflow-auto rounded-[var(--radius-card)] border border-line" tabIndex={0} role="region" aria-label="Marks">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="[&>th]:border-b [&>th]:border-line [&>th]:bg-surface-2">
              <th scope="col" className="sticky left-0 z-10 px-4 py-3 text-left text-xs font-medium text-muted">Student</th>
              {assessments.map((a) => (
                <th key={a.id} scope="col" className="px-2 py-2.5 text-center">
                  <span className="block text-xs font-semibold text-fg">{a.name}</span>
                  <span className="mt-0.5 inline-block rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-medium text-muted ring-1 ring-line ring-inset">out of {a.maxMarks}</span>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted">Entered so far</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, r) => {
              const t = rowTotal(r);
              return (
                <tr key={s.id} className="group [&>td]:border-b [&>td]:border-line/70 hover:[&>td]:bg-brand-soft/40">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">{r + 1}</span>
                      <span className="min-w-0"><span className="block truncate font-medium whitespace-nowrap">{s.name}</span><span className="block font-mono text-[11px] text-muted">{s.rollNo}</span></span>
                    </span>
                  </td>
                  {assessments.map((a, c) => {
                    const v = (vals[`${r}-${c}`] ?? "").trim().toUpperCase();
                    return (
                      <td key={a.id} className="px-2 py-1.5 text-center">
                        <input
                          name={`m_${a.id}_${s.id}`} defaultValue={s.marks[a.id] ?? ""} disabled={locked} data-cell={`${r}-${c}`}
                          onKeyDown={(e) => onKey(e, r, c)} onPaste={(e) => onPaste(e, r, c)} onInput={() => { setDirty(true); sync(); }}
                          inputMode="decimal" autoComplete="off" aria-label={`${s.name} ${a.name}`} aria-invalid={bad(r, c) || undefined}
                          className={`h-9 w-[4.5rem] rounded-lg border bg-surface text-center font-medium tabular-nums outline-none transition focus:ring-4 disabled:bg-surface-2 disabled:opacity-70 ${bad(r, c) ? "border-danger text-danger focus:ring-danger/15" : v === "AB" ? "border-warning/50 bg-warning-soft text-warning focus:ring-warning/15" : "border-line focus:border-brand focus:ring-brand/12"}`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {t ? <><span className="font-semibold tabular-nums">{Math.round(t.got * 10) / 10}</span><span className="text-xs text-muted tabular-nums"> / {t.max}</span><span className={`ml-2 inline-block w-11 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${t.pct >= 60 ? "bg-success-soft text-success" : t.pct >= 40 ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger"}`}>{t.pct}%</span></> : <span className="text-xs text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            <tr className="[&>td]:border-t [&>td]:border-line [&>td]:bg-surface-2">
              <td className="sticky left-0 z-10 px-4 py-2.5 text-xs font-semibold">Class average</td>
              {assessments.map((a, c) => { const st = colStats(c); return (
                <td key={a.id} className="px-2 py-2.5 text-center text-xs"><span className="font-semibold tabular-nums">{st.avg ?? "—"}</span><span className="block text-[10.5px] text-muted tabular-nums">{st.filled}/{students.length} entered</span></td>
              ); })}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Type <b>AB</b> for absent. Enter / ↑ ↓ move between rows. <b>Paste a column or block straight from Excel.</b> Blank cells are left unchanged.
          {errors > 0 && <span className="ml-2 font-medium text-danger">● {errors} cell{errors === 1 ? " is" : "s are"} over the maximum or not a number</span>}
          {dirty && errors === 0 && <span className="ml-2 font-medium text-warning">● Unsaved changes</span>}
        </p>
        {!locked && <SubmitButton>Save marks</SubmitButton>}
      </div>
    </ActionForm>
  );
}
