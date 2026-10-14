import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

/** Day-by-day attendance for a term: each square is one date, coloured by the share of classes attended. */
export async function AttendanceHeatmap({ studentId, termId, from, to }: { studentId: string; termId?: string; from: Date; to: Date }) {
  const [records, holidays] = await Promise.all([
    db.attendanceRecord.findMany({ where: { studentId, session: { offering: { termId } } }, select: { status: true, session: { select: { date: true } } } }),
    db.calendarEvent.findMany({ where: { type: "HOLIDAY", date: { gte: from, lte: to } }, select: { date: true, endDate: true, title: true } }),
  ]);
  const byDay = new Map<string, { a: number; t: number }>();
  for (const r of records) {
    const k = r.session.date.toISOString().slice(0, 10);
    const v = byDay.get(k) ?? { a: 0, t: 0 };
    v.t++; if (r.status !== "ABSENT") v.a++;
    byDay.set(k, v);
  }
  const holiday = new Map<string, string>();
  for (const h of holidays) for (let d = h.date; d <= (h.endDate ?? h.date); d = new Date(d.getTime() + 864e5)) holiday.set(d.toISOString().slice(0, 10), h.title);

  const end = new Date(Math.min(to.getTime(), Date.now()));
  // Align to Monday so each column is a week.
  const start = new Date(from.getTime() - ((from.getUTCDay() + 6) % 7) * 864e5);
  const weeks: Date[][] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 7 * 864e5)) weeks.push(Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + i * 864e5)));
  const tone = (k: string, d: Date) => {
    if (d < from || d > end) return "bg-transparent";
    if (holiday.has(k) || d.getUTCDay() === 0) return "bg-surface-2";
    const v = byDay.get(k);
    if (!v) return "bg-surface-2";
    const p = v.a / v.t;
    return p === 1 ? "bg-success" : p >= 0.5 ? "bg-warning" : "bg-danger";
  };
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="mr-1 grid grid-rows-7 gap-1 text-[9px] text-muted">{["M", "", "W", "", "F", "", "S"].map((d, i) => <span key={i} className="h-3.5 leading-[14px]">{d}</span>)}</div>
        {weeks.map((w, i) => (
          <div key={i} className="grid grid-rows-7 gap-1">
            {w.map((d) => {
              const k = d.toISOString().slice(0, 10), v = byDay.get(k);
              const label = `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}: ${holiday.get(k) ?? (v ? `${v.a}/${v.t} classes attended` : "no classes")}`;
              return <span key={k} role="img" title={label} aria-label={label} className={cn("size-3.5 rounded-[3px]", tone(k, d))} />;
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        {[["bg-success", "All classes"], ["bg-warning", "Missed some"], ["bg-danger", "Missed most"], ["bg-surface-2", "Holiday / no class"]].map(([c, l]) => <span key={l} className="flex items-center gap-1"><span className={cn("size-2.5 rounded-[3px]", c)} />{l}</span>)}
      </p>
    </div>
  );
}
