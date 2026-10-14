"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--fg)" },
  labelStyle: { color: "var(--muted)" },
  cursor: { fill: "var(--surface-2)" },
};

/** Wraps a chart with Expand (full screen) and Download (PNG) controls, shown on hover or keyboard focus. */
function ChartFrame({ children, name }: { children: ReactNode; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  function download() {
    const svg = box.current?.querySelector("svg.recharts-surface") as SVGSVGElement | null;
    if (!svg) return;
    const { width, height } = svg.getBoundingClientRect();
    const styles = getComputedStyle(document.documentElement);
    // A saved image has no stylesheet, so theme variables are replaced with their current values.
    const markup = new XMLSerializer().serializeToString(svg).replace(/var\((--[\w-]+)\)/g, (_, v) => styles.getPropertyValue(v).trim() || "#888");
    const img = new Image();
    img.onload = () => {
      const scale = 2, canvas = document.createElement("canvas");
      canvas.width = width * scale; canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = styles.getPropertyValue("--surface").trim() || "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      Object.assign(document.createElement("a"), { href: canvas.toDataURL("image/png"), download: `${name}.png` }).click();
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'))}`;
  }

  return (
    <div ref={box} className={full ? "fixed inset-0 z-[75] flex flex-col bg-surface p-6 [&_.recharts-responsive-container]:!h-[82vh]" : "group/chart relative"}>
      <div className={full ? "mb-3 flex justify-end gap-2" : "no-print absolute -top-1 right-0 z-10 flex gap-1 opacity-0 transition group-hover/chart:opacity-100 focus-within:opacity-100"}>
        <button type="button" onClick={download} title="Download as image" aria-label="Download chart as image" className="rounded-md border border-line bg-surface p-1.5 text-muted hover:text-brand"><Download className="size-3.5" /></button>
        <button type="button" onClick={() => setFull((f) => !f)} title={full ? "Exit full screen" : "Expand"} aria-label={full ? "Exit full screen" : "Expand chart"} className="rounded-md border border-line bg-surface p-1.5 text-muted hover:text-brand">{full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}</button>
      </div>
      {children}
    </div>
  );
}

/** Single-series bars. `color` per row lets status charts use reserved status tokens. */
export function BarsChart({ data, unit = "", horizontal, height = 260 }: {
  /** `href` makes a bar clickable: it opens the list behind that number. */
  data: { label: string; value: number; color?: string; href?: string }[]; unit?: string; horizontal?: boolean; height?: number;
}) {
  const router = useRouter();
  const clickable = data.some((d) => d.href);
  return (
    <ChartFrame name="chart">
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 16, right: 24, left: 0, bottom: 0 }} barCategoryGap={horizontal ? 6 : "25%"}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={!horizontal} vertical={!!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axis} unit={unit} />
            <YAxis type="category" dataKey="label" {...axis} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" {...axis} interval={0} />
            <YAxis {...axis} unit={unit} width={44} />
          </>
        )}
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}${unit}`, ""]} separator="" />
        <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} cursor={clickable ? "pointer" : undefined}
          onClick={(d) => { const href = (d as { payload?: { href?: string } }).payload?.href; if (href) router.push(href); }}>
          {data.map((d) => <Cell key={d.label} fill={d.color ?? "var(--brand)"} />)}
          <LabelList dataKey="value" position={horizontal ? "right" : "top"} fill="var(--muted)" fontSize={11} formatter={(v) => `${v}${unit}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}

export function TrendChart({ data, unit = "", height = 260, domain }: {
  data: { label: string; value: number }[]; unit?: string; height?: number; domain?: [number, number];
}) {
  return (
    <ChartFrame name="trend">
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={24} />
        <YAxis {...axis} unit={unit} width={44} domain={domain ?? ["auto", "auto"]} />
        <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} formatter={(v) => [`${v}${unit}`, "Attendance"]} />
        <Line type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}

export type Slice = { label: string; value: number; color: string };

/** Donut with centre total and a value legend (identity never relies on colour alone). */
const FORMATS = {
  number: (v: number) => v.toLocaleString("en-IN"),
  lakh: (v: number) => `₹${(v / 1e5).toFixed(1)}L`,
};

/** Wrap in a container-query context so the legend sits beside the donut only when the card is wide enough. */
export function DonutChart({ data, centerLabel, centerValue, height = 180, valueFormat = "number" }: {
  data: Slice[]; centerLabel: string; centerValue?: string; height?: number; valueFormat?: keyof typeof FORMATS;
}) {
  const format = FORMATS[valueFormat];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="@container"><div className="flex flex-col items-center gap-4 @sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={data.length > 1 ? 2 : 0} stroke="var(--surface)" strokeWidth={2} cornerRadius={4} isAnimationActive>
              {data.map((d) => <Cell key={d.label} fill={d.color} />)}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v, n) => [`${format(Number(v))} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="text-xl font-semibold tabular-nums">{centerValue ?? format(total)}</p><p className="text-[11px] text-muted">{centerLabel}</p></div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2 text-sm @sm:flex-1">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="flex-1 truncate text-muted">{d.label}</span>
            <span className="font-medium tabular-nums">{format(d.value)}</span>
            <span className="w-10 text-right text-xs text-muted tabular-nums">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div></div>
  );
}

/** Small area trend line for stat tiles. */
export function Sparkline({ data, color = "var(--brand)", height = 40 }: { data: number[]; color?: string; height?: number }) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.3} /><stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color.replace(/\W/g, "")})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** SGPA per semester trend with the 10-point axis. */
export function GpaTrend({ data, height = 220 }: { data: { label: string; value: number }[]; height?: number }) {
  return (
    <ChartFrame name="sgpa-trend">
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gpa-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity={0.25} /><stop offset="1" stopColor="var(--brand)" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} width={28} />
        <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} formatter={(v) => [Number(v).toFixed(2), "SGPA"]} />
        <Area type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2} fill="url(#gpa-fill)" dot={{ r: 4, fill: "var(--brand)", stroke: "var(--surface)", strokeWidth: 2 }}
          label={{ position: "top", fill: "var(--muted)", fontSize: 11, offset: 10, formatter: (v: unknown) => Number(v).toFixed(2) }} />
      </AreaChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}
