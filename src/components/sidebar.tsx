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
      {open && <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={onClose} />}
      <aside data-tour="sidebar" className={cn("sidebar no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 lg:w-60 lg:translate-x-0", open ? "translate-x-0 shadow-lift" : "-translate-x-full")}>
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
          {brand.hasLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/brand/logo" alt="" className="size-8 rounded-md object-contain" />
            : <BrandMark size={30} />}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{brand.shortName}</p>
            <p className="truncate text-[11px] text-muted">{brand.tagline}</p>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="ml-auto grid size-9 place-items-center rounded-[var(--radius-control)] text-muted hover:bg-surface-2 lg:hidden"><X className="size-4" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {groups.map((g) => (
            <div key={g} className={cn(folds ? "mt-0.5" : "mt-4 first:mt-0")}>
              {folds && g !== "Overview" && g !== activeGroup ? (
                <button type="button" onClick={() => toggle(g)} aria-expanded={isOpen(g)} className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-[7px] text-left text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-fg">
                  <span className="flex-1">{t(g)}</span>
                  <span className="text-[11px] tabular-nums text-muted/80">{items.filter((i) => i.group === g).length}</span>
                  <ChevronDown className={cn("size-3.5 transition-transform", isOpen(g) && "rotate-180")} />
                </button>
              ) : <p className={cn("mb-1 px-2.5 text-[11px] font-medium text-muted", folds && g !== "Overview" && "mt-3")}>{t(g)}</p>}
              {isOpen(g) && items.filter((i) => i.group === g).map(({ href, label, icon: Icon }) => {
                const on = href === active;
                return (
                  <Link key={href} href={href} onClick={onClose} aria-current={on ? "page" : undefined} className="side-link group">
                    <Icon className="size-4 shrink-0" /> <span className="truncate">{t(label)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {termName && (
          <div className="shrink-0 border-t border-line px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted"><span className="size-1.5 rounded-full bg-success" />{t("Current term")}</p>
            <p className="mt-0.5 truncate text-[13px] font-medium">{termName}</p>
          </div>
        )}
      </aside>
    </>
  );
}
