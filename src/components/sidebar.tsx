"use client";

import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { NAV, activeHref } from "./nav";
import { cn } from "@/lib/utils";
import type { Brand } from "./app-shell";

export function Sidebar({ role, open, onClose, termName, brand, t }: { role: Role; open: boolean; onClose: () => void; termName?: string; brand: Brand; t: (k: string) => string }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => i.roles.includes(role));
  const groups = [...new Set(items.map((i) => i.group))];
  const active = activeHref(pathname, items);
  // A long menu folds: Overview and the group of the current page stay open, the rest open on a click.
  // Short menus (students, parents, accounts) are shown whole.
  const folds = items.length > 16;
  const activeGroup = items.find((i) => i.href === active)?.group;
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const isOpen = (g: string) => !folds || g === "Overview" || g === activeGroup || opened.has(g);
  const toggle = (g: string) => setOpened((o) => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside data-tour="sidebar" className={cn("sidebar no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 lg:inset-y-3 lg:left-3 lg:translate-x-0 lg:rounded-3xl", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-[72px] shrink-0 items-center gap-3 px-5">
          {brand.hasLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/brand/logo" alt="" className="size-10 rounded-xl object-contain" />
            : <BrandMark size={40} />}
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-bold tracking-tight">{brand.shortName}</p>
            <p className="truncate text-[11px] text-muted">{brand.tagline}</p>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden"><X className="size-4" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g} className={cn(folds ? "mt-1 first:mt-1" : "mt-5 first:mt-1")}>
              {folds && g !== "Overview" && g !== activeGroup ? (
                <button type="button" onClick={() => toggle(g)} aria-expanded={isOpen(g)} className="mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold tracking-[0.12em] text-muted uppercase hover:bg-surface-2 hover:text-fg">
                  <span className="flex-1">{t(g)}</span>
                  <span className="rounded-full bg-surface-2 px-1.5 text-[10px] tracking-normal">{items.filter((i) => i.group === g).length}</span>
                  <ChevronDown className={cn("size-3.5 transition", isOpen(g) && "rotate-180")} />
                </button>
              ) : <p className={cn("mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted/70 uppercase", folds && "mt-3")}>{t(g)}</p>}
              {isOpen(g) && items.filter((i) => i.group === g).map(({ href, label, icon: Icon }) => {
                const on = href === active;
                return (
                  <Link key={href} href={href} onClick={onClose} aria-current={on ? "page" : undefined} className="side-link group">
                    <Icon className={cn("size-[18px] shrink-0 transition", !on && "opacity-80 group-hover:scale-110 group-hover:opacity-100")} /> <span className="truncate">{t(label)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {termName && (
          <div className="brand-gradient m-3 shrink-0 rounded-2xl p-4 text-white shadow-lift">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/75 uppercase"><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />{t("Current term")}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{termName}</p>
          </div>
        )}
      </aside>
    </>
  );
}
