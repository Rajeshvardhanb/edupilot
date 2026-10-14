import Link from "next/link";
import { cloneElement, Fragment, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyIllustration } from "./illustrations";
import { LiveError } from "./live-validation";
import { MoreMenu } from "./more-menu";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="relative z-20 mb-6 flex animate-fade-up flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-brand uppercase">{eyebrow}</p>}
        <h1 className="text-[1.6rem] leading-tight font-bold tracking-tight sm:text-[1.9rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
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

export function Card({ className, title, actions, children }: { className?: string; title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={cn("tile animate-fade-up", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line/70 px-6 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-muted/15",
  brand: "bg-brand-soft text-brand ring-brand/15",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/20",
  danger: "bg-danger-soft text-danger ring-danger/20",
  info: "bg-info-soft text-info ring-info/20",
};
const chipClasses: Record<Tone, string> = { neutral: "chip-neutral", brand: "", success: "chip-success", warning: "chip-warning", danger: "chip-danger", info: "chip-info" };
const TONE_VAR: Record<Tone, string> = { brand: "var(--brand)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)", neutral: "var(--muted)" };

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset", toneClasses[tone])}>{children}</span>;
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variantClasses: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "bg-danger text-white shadow-sm hover:brightness-110",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
};
export const buttonClass = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cn(
    "inline-flex items-center justify-center gap-1.5 font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "rounded-lg px-3 py-1.5 text-xs" : "rounded-xl px-4 py-2.5 text-sm",
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
    <div className="overflow-x-auto">
      <table data-stack={stack ? "" : undefined} className="w-full text-left text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-brand-soft/40 [&_tbody_tr:last-child_td]:border-b-0">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-surface-2/70 px-3 py-3 text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase first:rounded-l-xl last:rounded-r-xl", className)}>{children}</th>;
}
export function Td({ children, className, colSpan, "data-label": label }: { children?: ReactNode; className?: string; colSpan?: number; /** Column heading, shown before the value in the phone layout. Filled in by the server Table. */ "data-label"?: string }) {
  return <td colSpan={colSpan} data-label={label} className={cn("border-b border-line/70 px-3 py-3.5 align-middle", className)}>{children}</td>;
}

export function StatCard({ label, value, hint, tone = "brand", icon, trend, chart, href }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode;
  trend?: { value: string; up: boolean; good?: boolean }; chart?: ReactNode;
  /** Makes the whole tile a link to the page behind the number. */
  href?: string;
}) {
  const good = trend ? (trend.good ?? trend.up) : true;
  return (
    <div className="tile tile-hover group relative min-w-0 animate-fade-up overflow-hidden p-4 sm:p-5">
      {/* Soft wash of the tile's own colour in the corner, stronger on hover. */}
      <span aria-hidden className="pointer-events-none absolute -top-14 -right-14 size-40 rounded-full opacity-[0.13] blur-2xl transition duration-500 group-hover:opacity-25" style={{ background: TONE_VAR[tone] }} />
      <div className="relative flex items-center gap-3">
        {icon
          ? <span className={cn("chip size-9 shrink-0 sm:size-10", chipClasses[tone])}>{icon}</span>
          : <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: TONE_VAR[tone], boxShadow: `0 0 0 4px color-mix(in oklab, ${TONE_VAR[tone]} 16%, transparent)` }} />}
        <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug font-medium text-muted">{label}</p>
      </div>
      <p className="relative mt-3 truncate font-display text-[1.45rem] leading-tight font-bold tracking-tight tabular-nums sm:mt-4 sm:text-[2rem] sm:leading-none">{value}</p>
      {(trend || hint) && (
        <div className="relative mt-2.5 flex items-center gap-2 text-xs">
          {trend && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset", good ? "bg-success-soft text-success ring-success/20" : "bg-danger-soft text-danger ring-danger/20")}>{trend.up ? "↑" : "↓"} {trend.value}</span>}
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
    <div className="rounded-[20px] border border-dashed border-line bg-surface/50 px-6 py-12 text-center">
      <EmptyIllustration className="mx-auto mb-3 h-24 w-auto" />
      <p className="font-display text-base font-semibold">{title}</p>
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
      <div className="flex gap-1 rounded-2xl border border-line bg-surface-2/70 p-1">
        {items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className={cn(
              "rounded-xl px-3.5 py-2 text-sm whitespace-nowrap transition",
              t.href === active ? "bg-surface font-semibold text-brand shadow-card" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  const bar = { brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", neutral: "bg-muted" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 rounded-[20px] bg-surface-2" />)}
      </div>
      <div className="h-72 rounded-[20px] bg-surface-2" />
    </div>
  );
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="no-print mt-4 flex items-center justify-between text-sm text-muted">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <LinkButton variant="secondary" size="sm" href={makeHref(page - 1)}>Previous</LinkButton>}
        {page < pages && <LinkButton variant="secondary" size="sm" href={makeHref(page + 1)}>Next</LinkButton>}
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
      <div className="h-44 rounded-3xl bg-surface-2" />
      <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 rounded-[20px] bg-surface-2" /><div className="space-y-6 lg:col-span-2"><div className="h-36 rounded-[20px] bg-surface-2" /><div className="h-48 rounded-[20px] bg-surface-2" /></div></div>
    </div>
  );
}

/** Loading placeholder shaped like a dashboard: hero, KPI tiles, charts. */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-48 rounded-3xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-36 rounded-[20px] bg-surface-2" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 rounded-[20px] bg-surface-2 lg:col-span-2" /><div className="h-80 rounded-[20px] bg-surface-2" /></div>
    </div>
  );
}

/** Placeholder for the body of a dashboard while its numbers load (the banner above is already on screen). */
export function DashboardBodySkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-36 rounded-[20px] bg-surface-2" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><div className="h-80 rounded-[20px] bg-surface-2 lg:col-span-2" /><div className="h-80 rounded-[20px] bg-surface-2" /></div>
    </div>
  );
}

export function TasksSkeleton() {
  return <div aria-hidden className="mb-6 h-36 animate-pulse rounded-[20px] bg-surface-2" />;
}
