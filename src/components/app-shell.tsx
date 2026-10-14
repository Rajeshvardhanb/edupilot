"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import type { Role } from "@prisma/client";
import { Sidebar } from "./sidebar";
import { Topbar, type ShellNotice } from "./topbar";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm";
import { Tour } from "./tour";
import { OfflineSync } from "./offline";
import { Shortcuts } from "./shortcuts";
import { NAV, activeHref } from "./nav";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";

export type ShellUser = { id: string; name: string; email: string; role: Role; hasPhoto: boolean; children: { id: string; name: string; rollNo: string }[]; studentId: string | null };
export type Brand = { name: string; shortName: string; tagline: string; hasLogo: boolean };

const TABS: Partial<Record<Role, string[]>> = {
  STUDENT: ["/dashboard", "/attendance", "/results", "/fees", "/timetable"],
  PARENT: ["/dashboard", "/attendance", "/results", "/fees", "/notices"],
  FACULTY: ["/dashboard", "/attendance", "/exams", "/timetable", "/leave"],
};

export function AppShell({ user, notices, unread, termName, brand, lang, dict, children }: {
  user: ShellUser; notices: ShellNotice[]; unread: number; termName?: string; brand: Brand; lang: Lang; dict: Record<string, string>; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useCallback((k: string) => dict[k] ?? k, [dict]);
  const tabs = (TABS[user.role] ?? []).map((h) => NAV.find((n) => n.href === h)!).filter(Boolean);
  const active = activeHref(pathname, NAV);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <a href="#main" className="skip-link">Skip to main content</a>
        <div className="min-h-screen">
          <Sidebar role={user.role} open={open} onClose={() => setOpen(false)} termName={termName} brand={brand} t={t} />
          <div className="lg:pl-60">
            <Topbar user={user} notices={notices} unread={unread} onMenu={() => setOpen(true)} lang={lang} t={t} />
            {/* Printed pages carry the college name and the date instead of the menu and top bar. */}
            <div className="mb-4 hidden items-end justify-between border-b border-black/70 pb-2 text-xs print:flex"><span className="text-sm font-bold uppercase">{brand.name}</span><span suppressHydrationWarning>Printed {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
            <main id="main" tabIndex={-1} className={cn("mx-auto max-w-7xl px-4 pt-6 pb-12 outline-none sm:px-6 lg:px-8", tabs.length > 0 && "pb-24 lg:pb-12")}>{children}</main>
          </div>
          {tabs.length > 0 && (
            <nav aria-label="Quick links" className="no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active === href ? "font-medium text-brand" : "text-muted")}>
                  <Icon className="size-5" />{t(href === "/dashboard" ? "Home" : label)}
                </Link>
              ))}
            </nav>
          )}
          <Tour role={user.role} userId={user.id} />
          <OfflineSync />
          <Shortcuts role={user.role} />
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
