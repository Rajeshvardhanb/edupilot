import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./ui";

const TONE_VAR: Record<Tone, string> = { brand: "var(--brand)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)", neutral: "var(--muted)" };

/** Circular gauge (0–100) with optional threshold tick, e.g. the 75% attendance line. */
export function Gauge({ value, label, tone = "brand", size = 132, threshold, children }: { value: number; label?: string; tone?: Tone; size?: number; threshold?: number; children?: ReactNode }) {
  const r = 52, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  const t = threshold != null ? ((threshold / 100) * 360 - 90) * (Math.PI / 180) : null;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`${label ?? "Value"} ${v}%`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        {v > 0 && <circle cx="60" cy="60" r={r} fill="none" stroke={TONE_VAR[tone]} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />}
      </svg>
      {t != null && (
        <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" aria-hidden>
          <line x1={60 + 44 * Math.cos(t)} y1={60 + 44 * Math.sin(t)} x2={60 + 62 * Math.cos(t)} y2={60 + 62 * Math.sin(t)} stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        </svg>
      )}
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>{children ?? <><p className="text-2xl font-semibold tabular-nums">{v}%</p>{label && <p className="text-[11px] text-muted">{label}</p>}</>}</div>
      </div>
    </div>
  );
}

/** Horizontal funnel: each stage's bar width is relative to the first stage. */
export function Funnel({ stages }: { stages: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, stages[0]?.value ?? 1);
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => (
        <li key={s.label}>
          <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{s.label}</span><span className="font-medium tabular-nums">{s.value}{i > 0 && stages[i - 1].value > 0 && <span className="ml-1 text-muted">({Math.round((s.value / stages[i - 1].value) * 100)}%)</span>}</span></div>
          <div className="h-7 rounded-md bg-surface-2">
            <div className="h-full rounded-md transition-all duration-700" style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, background: s.color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Single stacked bar with legend, e.g. attendance status split. Segments separated by 2px surface gaps. */
export function StackedBar({ data, format = (n: number) => String(n) }: { data: { label: string; value: number; color: string }[]; format?: (n: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {data.filter((d) => d.value > 0).map((d) => <div key={d.label} title={`${d.label}: ${format(d.value)}`} style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: d.color }} /><span className="flex-1 text-muted">{d.label}</span>
            <span className="font-medium tabular-nums">{format(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Coloured icon tile used for KPI/feature callouts. */
export function IconTile({ tone = "brand", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const map: Record<Tone, string> = { brand: "", success: "chip-success", warning: "chip-warning", danger: "chip-danger", info: "chip-info", neutral: "chip-neutral" };
  return <span className={cn("chip size-10", map[tone], className)}>{children}</span>;
}
