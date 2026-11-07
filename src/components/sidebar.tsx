"use client";

import { BrandMark, Wordmark } from "@/components/brand-mark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { ChevronDown, LogOut, X } from "lucide-react";
import { NAV, activeHref } from "./nav";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth";
import { initials } from "./avatar";
import type { Brand, ShellTerm, ShellUser } from "./app-shell";

/** Each menu group's colour (CSS variables defined in globals.css). */
const GROUP_COLOR: Record<string, string> = {
  Overview: "var(--g-overview)", People: "var(--g-people)", Academics: "var(--g-academics)", Examinations: "var(--g-exams)",
  Campus: "var(--g-campus)", Services: "var(--g-services)", System: "var(--g-system)",
};
const gstyle = (g: string) => ({ "--g": GROUP_COLOR[g] ?? "var(--brand)" }) as CSSProperties;

export function Sidebar({ user, open, onClose, term, brand, t }: { user: ShellUser; open: boolean; onClose: () => void; term?: ShellTerm; brand: Brand; t: (k: string) => string }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => i.roles.includes(user.role));
  const groups = [...new Set(items.map((i) => i.group))];
  const active = activeHref(pathname, items);
  // Long menus fold: Overview and the current page's group stay open, the rest open on a click. Short menus show whole.
  const folds = items.length > 16;
  const activeGroup = items.find((i) => i.href === active)?.group;
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const isOpen = (g: string) => !folds || g === "Overview" || g === activeGroup || opened.has(g);
  const toggle = (g: string) => setOpened((o) => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  const college = (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#dbe7fb] bg-gradient-to-r from-[#eef3ff] to-[#eefbff] p-2.5">
      {brand.hasLogo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src="/brand/logo" alt="" className="size-8 shrink-0 rounded-full bg-white object-contain ring-1 ring-line" />
        : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-brand ring-1 ring-line">{brand.shortName.slice(0, 2)}</span>}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-bold">{brand.shortName}</p>
        <p className="truncate text-[11px] text-muted">{term?.name ?? brand.tagline}</p>
      </div>
      {user.role === "ADMIN" && <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />}
    </div>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} />}
      <aside data-tour="sidebar" className={cn("sidebar no-print fixed inset-y-0 left-0 z-50 flex w-[19rem] max-w-[88vw] flex-col transition-transform duration-200 lg:w-60 lg:translate-x-0", open ? "translate-x-0 shadow-lift" : "-translate-x-full")}>
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
          <BrandMark size={30} />
          <Wordmark className="text-[17px]" />
          <button onClick={onClose} aria-label="Close menu" className="ml-auto grid size-9 place-items-center rounded-[var(--radius-control)] border border-line text-fg-2 hover:bg-surface-2 lg:hidden"><X className="size-4" /></button>
        </div>
        <div className="px-3">{user.role === "ADMIN" ? <Link href="/admin/settings" onClick={onClose}>{college}</Link> : college}</div>

        {/* Desktop: grouped list. */}
        <nav aria-label="Main menu" className="hidden flex-1 overflow-y-auto px-3 py-3 lg:block">
          {groups.map((g) => (
            <div key={g} style={gstyle(g)} className="mb-1">
              {g === "Overview" ? null : !folds || g === activeGroup ? (
                <p className="mt-3 mb-1 flex items-center gap-2 px-2.5 text-[10.5px] font-bold tracking-[0.1em] text-muted uppercase">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: "var(--g)" }} />{t(g)}
                </p>
              ) : (
                <button type="button" onClick={() => toggle(g)} aria-expanded={isOpen(g)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10.5px] font-bold tracking-[0.1em] text-muted uppercase hover:bg-surface-2 hover:text-fg">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: "var(--g)" }} />
                  <span className="flex-1">{t(g)}</span>
                  <span className="rounded-md px-1.5 py-px text-[10px] tracking-normal tabular-nums" style={{ color: "var(--g)", background: "color-mix(in oklab, var(--g) 12%, white)" }}>{items.filter((i) => i.group === g).length}</span>
                </button>
              )}
              {isOpen(g) && (
                <div className="space-y-0.5">
                  {items.filter((i) => i.group === g).map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={onClose} aria-current={href === active ? "page" : undefined} className="side-link">
                      <span className="side-icon"><Icon className="size-[15px]" /></span><span className="truncate">{t(label)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Phone: the whole menu as a grid of tiles, with who is signed in on top. Rendered only while the menu is open. */}
        {open && <nav aria-label="Main menu" className="flex-1 overflow-y-auto px-3 pt-3 pb-4 lg:hidden">
          <div className="brand-gradient mb-4 flex items-center gap-3 rounded-2xl p-3 text-white shadow-[var(--shadow-brand)]">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20 text-sm font-bold">{initials(user.name)}</span>
            <span className="min-w-0"><span className="block truncate font-semibold">{user.name}</span><span className="block truncate text-xs text-white/80">{user.subtitle}</span></span>
          </div>
          {groups.map((g) => (
            <div key={g} style={gstyle(g)} className="mb-3">
              <p className="mb-2 px-1 text-[10.5px] font-bold tracking-[0.1em] text-muted uppercase">{t(g)}</p>
              <div className="grid grid-cols-4 gap-x-1 gap-y-3">
                {items.filter((i) => i.group === g).map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={onClose} aria-current={href === active ? "page" : undefined} className="group flex flex-col items-center gap-1.5 text-center">
                    <span className="chip size-11 rounded-xl group-aria-[current=page]:ring-2 group-aria-[current=page]:ring-brand group-aria-[current=page]:ring-offset-2" style={{ "--c": "var(--g)" } as CSSProperties}><Icon className="size-5" /></span>
                    <span className="line-clamp-2 text-[11px] leading-tight font-medium text-fg-2">{t(label)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <form action={logout} className="mt-2"><button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-fg-2 hover:bg-surface-2"><LogOut className="size-4" /> {t("Sign out")}</button></form>
        </nav>}

        {term && (
          <div className="relative m-3 hidden shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#c026d3] p-3.5 text-white shadow-[var(--shadow-brand)] lg:block">
            <span aria-hidden className="absolute -top-6 -right-6 size-20 rounded-full bg-white/15" />
            <p className="relative text-[11px] text-white/80">{t("Current term")}</p>
            <p className="relative truncate text-sm font-bold">{term.name}</p>
            {term.weeks > 0 && (
              <div className="relative mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${term.percent}%` }} /></div>
                <span className="text-[10.5px] text-white/85 tabular-nums">Wk {term.week}/{term.weeks}</span>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
