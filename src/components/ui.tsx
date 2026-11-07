import Link from "next/link";
import { cloneElement, Fragment, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { EmptyIllustration } from "./illustrations";
import { LiveError } from "./live-validation";
import { MoreMenu } from "./more-menu";
import { cardIcon, statIcon } from "./card-icons";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="relative z-20 mb-6 flex animate-fade-up flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold text-brand">{eyebrow}</p>}
        <h1 className="page-title text-[1.6rem] leading-tight font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2"><HeaderActions actions={actions} /></div>}
    </div>
  );
}

/** Actions as a flat list: arrays and fragments opened up, empty values (false, null) dropped. */
function flatActions(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) return node.flatMap(flatActions);
  if (isValidElement(node) && node.type === Fragment) return flatActions((node as ReactElement<{ children?: ReactNode }>).props.children);
  return node === null || node === undefined || node === false || node === true || node === "" ? [] : [node];
}

/** At most three buttons side by side. Beyond that the last two (where pages put the main action) stay and the rest go under "More". */
function HeaderActions({ actions }: { actions: ReactNode }) {
  const list = flatActions(actions);
  if (list.length <= 3) return <>{list.map((a, i) => <Fragment key={i}>{a}</Fragment>)}</>;
  return (
    <>
      <MoreMenu>{list.slice(0, -2).map((a, i) => <Fragment key={i}>{a}</Fragment>)}</MoreMenu>
      {list.slice(-2).map((a, i) => <Fragment key={i}>{a}</Fragment>)}
    </>
  );
}

export function Card({ className, title, actions, children, icon }: {
  className?: string; title?: ReactNode; actions?: ReactNode; children: ReactNode;
  /** The tinted icon before the title; chosen from the title's words when not given, `false` for none. */
  icon?: ReactNode | false;
}) {
  const chip = icon === false ? null : icon ?? cardIcon(title);
  return (
    <section className={cn("tile animate-fade-up", className)}>
      {(title || actions) && (
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-5 pt-4">
          <h2 className="flex min-w-0 items-center gap-2.5 font-sans text-[15px] font-semibold tracking-normal">{chip}<span className="min-w-0">{title}</span></h2>
          {actions}
        </header>
      )}
      <div className={cn("p-5", (title || actions) && "pt-4")}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const toneClasses: Record<Tone, string> = {
  neutral: "bg-[#eef0f6] text-fg-2",
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};
const chipClasses: Record<Tone, string> = { neutral: "chip-neutral", brand: "chip-brand", success: "chip-success", warning: "chip-warning", danger: "chip-danger", info: "chip-info" };
/** Tile wash: the tone's colour faint in the lower right and in the corner circle. */
const WASH: Record<Tone, string> = { neutral: "#64748b", brand: "#6366f1", success: "#10b981", warning: "#f59e0b", danger: "#f43f5e", info: "#0ea5e9" };

/** Status words stored in capitals ("OVERDUE", "IN_PROGRESS") read as "Overdue", "In progress"; short codes (OD, CSE) stay. */
const statusCase = (t: string) => (/^[A-Z][A-Z_]{3,}$/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ") : t);

export function Badge({ tone = "neutral", children, dot = tone !== "brand" }: { tone?: Tone; children: ReactNode; /** The small dot before the text (status badges). */ dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap", toneClasses[tone])}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />}{typeof children === "string" ? statusCase(children) : children}
    </span>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variantClasses: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "bg-danger text-white shadow-xs hover:bg-[color-mix(in_oklab,var(--danger)_88%,black)]",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
};
export const buttonClass = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cn(
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    size === "sm" ? "h-8 rounded-lg px-3 text-[13px]" : "h-10 rounded-[var(--radius-control)] px-4 text-sm",
    variantClasses[variant],
  );

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={cn(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}

/** `stack={false}` keeps the table as a grid on phones (it then scrolls sideways inside its card). */
export function Table({ children, stack = true }: { children: ReactNode; stack?: boolean }) {
  return (
    <div className="overflow-x-auto sm:rounded-xl sm:border sm:border-line">
      <table data-stack={stack ? "" : undefined} className="w-full text-left text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-brand-soft/35 [&_tbody_tr:last-child_td]:border-b-0">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-[#f6f7fb] px-4 py-3 text-xs font-semibold whitespace-nowrap text-muted", className)}>{children}</th>;
}
export function Td({ children, className, colSpan, "data-label": label }: { children?: ReactNode; className?: string; colSpan?: number; /** Column heading, shown before the value in the phone layout. Filled in by the server Table. */ "data-label"?: string }) {
  return <td colSpan={colSpan} data-label={label} className={cn("border-b border-line px-4 py-3.5 align-middle", className)}>{children}</td>;
}

export function StatCard({ label, value, hint, tone = "brand", icon, trend, chart, href }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode;
  trend?: { value: string; up: boolean; good?: boolean }; chart?: ReactNode;
  /** Makes the whole tile a link to the page behind the number. */
  href?: string;
}) {
  const good = trend ? (trend.good ?? trend.up) : true;
  return (
    <div
      className={cn("tile group relative min-w-0 animate-fade-up overflow-hidden p-4 sm:p-5", href && "tile-hover")}
      style={{ backgroundImage: `linear-gradient(145deg, #fff 45%, color-mix(in oklab, ${WASH[tone]} 7%, white))` }}
    >
      {/* Soft circle of the tile's colour in the corner. */}
      <span aria-hidden className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full" style={{ background: `color-mix(in oklab, ${WASH[tone]} 11%, transparent)` }} />
      <div className="relative flex items-center gap-2.5">
        {icon
          ? <span className={cn("chip size-9 shrink-0 [&_svg]:size-[18px]", chipClasses[tone])}>{icon}</span>
          : statIcon(label, tone === "brand" ? undefined : chipClasses[tone])}
        <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug font-medium text-fg-2">{label}</p>
      </div>
      <p className="relative mt-3 truncate font-sans text-[1.45rem] leading-tight font-bold tracking-tight tabular-nums sm:text-[1.65rem]">{value}</p>
      {(trend || hint) && (
        <div className="relative mt-1 flex items-center gap-2 text-xs">
          {trend && <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums", good ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{trend.up ? "↑" : "↓"} {trend.value}</span>}
          {hint && <span className="min-w-0 text-muted">{hint}</span>}
        </div>
      )}
      {chart && <div className="relative -mx-4 -mb-4 mt-3 sm:-mx-5 sm:-mb-5">{chart}</div>}
      {href && <Link href={href} aria-label={label} className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-brand" />}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; /** A button or link for the obvious next step. */ action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[#d9dbf0] bg-gradient-to-b from-[#fafaff] to-surface px-6 py-12 text-center">
      <EmptyIllustration className="mx-auto mb-4 h-28 w-auto" />
      <h2 className="font-sans text-base font-bold">{title}</h2>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="no-print mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Field({ label, name, error, className, children }: { label: string; name?: string; error?: string[]; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}</label>
      {/* Give a single control the id the label points at, so the two are linked. */}
      {name && isValidElement<{ id?: string }>(children) && typeof children.type === "string" && !children.props.id ? cloneElement(children, { id: name }) : children}
      {error?.[0] ? <p className="mt-1 text-xs text-danger">{error[0]}</p> : <LiveError name={name} />}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  return (
    <nav className="no-print mb-6 flex max-w-full overflow-x-auto">
      <div className="segmented">
        {items.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.href === active ? "page" : undefined}>{t.label}</Link>
        ))}
      </div>
    </nav>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  const bar = { brand: "brand-gradient", success: "bg-gradient-to-r from-emerald-400 to-emerald-600", warning: "bg-gradient-to-r from-amber-400 to-orange-500", danger: "bg-gradient-to-r from-rose-400 to-rose-600", info: "bg-gradient-to-r from-sky-400 to-sky-600", neutral: "bg-slate-400" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eceef6]">
      <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 rounded-[var(--radius-card)] bg-surface-2" />)}
      </div>
      <div className="h-72 rounded-[var(--radius-card)] bg-surface-2" />
    </div>
  );
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="no-print mt-4 flex items-center justify-between text-sm text-muted">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <LinkButton variant="secondary" size="sm" href={makeHref(page - 1)}><ArrowLeft /> Previous</LinkButton>}
        {page < pages && <LinkButton variant="secondary" size="sm" href={makeHref(page + 1)}>Next <ArrowRight /></LinkButton>}
      </div>
    </div>
  );
}

/** Loading placeholder shaped like a list page: header, filter row, table. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-end justify-between"><div className="h-8 w-48 rounded-lg bg-surface-2" /><div className="h-9 w-32 rounded-lg bg-surface-2" /></div>
      <div className="flex gap-2"><div className="h-10 flex-1 rounded-lg bg-surface-2" /><div className="h-10 w-32 rounded-lg bg-surface-2" /><div className="h-10 w-32 rounded-lg bg-surface-2" /></div>
      <div className="tile p-5">
        <div className="mb-4 h-4 w-full rounded bg-surface-2" />
        {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-4 border-t border-line py-3"><div className="size-9 rounded-full bg-surface-2" /><div className="h-4 flex-1 rounded bg-surface-2" /><div className="h-4 w-24 rounded bg-surface-2" /><div className="h-4 w-16 rounded bg-surface-2" /></div>)}
      </div>
    </div>
  );
}

/** Loading placeholder shaped like a detail page: banner, side card, content cards. */
export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-44 rounded-[var(--radius-panel)] bg-surface-2" />
      <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 rounded-[var(--radius-card)] bg-surface-2" /><div className="space-y-6 lg:col-span-2"><div className="h-36 rounded-[var(--radius-card)] bg-surface-2" /><div className="h-48 rounded-[var(--radius-card)] bg-surface-2" /></div></div>
    </div>
  );
}

/** Loading placeholder shaped like a dashboard: hero, KPI tiles, charts. */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-48 rounded-[var(--radius-panel)] bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-36 rounded-[var(--radius-card)] bg-surface-2" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 rounded-[var(--radius-card)] bg-surface-2 lg:col-span-2" /><div className="h-80 rounded-[var(--radius-card)] bg-surface-2" /></div>
    </div>
  );
}

/** Placeholder for the body of a dashboard while its numbers load (the banner above is already on screen). */
export function DashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-36 rounded-[var(--radius-card)] bg-surface-2" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 rounded-[var(--radius-card)] bg-surface-2 lg:col-span-2" /><div className="h-80 rounded-[var(--radius-card)] bg-surface-2" /></div>
    </div>
  );
}

export function TasksSkeleton() {
  return <div aria-hidden className="mb-6 h-36 animate-pulse rounded-[var(--radius-card)] bg-surface-2" />;
}

/** A percentage ring (teal-to-blue when on track, amber below the rule, red well below). Pure SVG, no state. */
export function Ring({ value, size = 64, stroke = 7, tone = "success", children }: { value: number; size?: number; stroke?: number; tone?: "success" | "warning" | "danger" | "brand"; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  const [a, b] = { success: ["#14b8a6", "#0ea5e9"], warning: ["#f59e0b", "#f97316"], danger: ["#f43f5e", "#e11d48"], brand: ["#6366f1", "#a855f7"] }[tone];
  const id = `ring-${tone}`;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8e9f3" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center leading-none">{children}</span>
    </span>
  );
}
