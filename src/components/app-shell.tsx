"use client";

import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback,useState,type ReactNode } from "react";
import { BrowserCleanup } from "./browser-cleanup";
import { ConfirmProvider } from "./confirm";
import { NAV,activeHref } from "./nav";
import { Shortcuts } from "./shortcuts";
import { Sidebar } from "./sidebar";
import { ToastProvider } from "./toast";
import { Topbar } from "./topbar";

export type ShellUser = { id: string; name: string; email: string; role: Role; children: { id: string; name: string; rollNo: string }[]; studentId: string | null; subtitle: string };
export type ShellTerm = { name: string; week: number; weeks: number; percent: number };
export type Brand = { name: string; shortName: string; tagline: string; hasLogo: boolean };

/** The phone's bottom bar for each role: the four or five places that person goes most. */
const TABS: Record<Role, string[]> = {
  STUDENT: ["/dashboard", "/attendance", "/results", "/timetable", "/profile"],
  PARENT: ["/dashboard", "/attendance", "/results", "/timetable", "/profile"],
  FACULTY: ["/dashboard", "/attendance", "/students", "/timetable", "/profile"],
  HOD: ["/dashboard", "/students", "/attendance", "/exams", "/profile"],
  ADMIN: ["/dashboard", "/students", "/attendance", "/exams", "/profile"],
  ACCOUNTANT: ["/dashboard", "/students", "/calendar", "/profile"],
  OFFICE: ["/dashboard", "/students", "/calendar", "/profile"],
};

/** The page name shown in the middle of the phone's top bar (the dashboard shows the logo instead). */
function phoneTitle(pathname: string, active: string | undefined, t: (k: string) => string) {
  if (pathname === "/dashboard") return null;
  const item = NAV.find((n) => n.href === active);
  return item ? t(item.label) : null;
}

export function AppShell({ user, term, brand, children }: {
  user: ShellUser; term?: ShellTerm; brand: Brand; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useCallback((k: string) => k, []);
  const tabs = TABS[user.role].map((h) => NAV.find((n) => n.href === h && n.roles.includes(user.role))).filter((n) => !!n);
  const active = activeHref(pathname, NAV);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <a href="#main" className="skip-link">Skip to main content</a>
        <div className="min-h-screen">
          <Sidebar user={user} open={open} onClose={() => setOpen(false)} term={term} brand={brand} t={t} />
          <div className="lg:pl-60">
            <Topbar user={user} onMenu={() => setOpen(true)} t={t} title={phoneTitle(pathname, active, t)} />
            {/* Printed pages carry the college name and the date instead of the menu and top bar. */}
            <div className="mb-4 hidden items-end justify-between border-b border-black/70 pb-2 text-xs print:flex"><span className="text-sm font-bold uppercase">{brand.name}</span><span suppressHydrationWarning>Printed {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
            <main id="main" tabIndex={-1} data-section={pathname.split("/").filter(Boolean).length <= 1 ? "" : undefined} className={cn("mx-auto max-w-7xl px-4 pt-6 pb-12 outline-none sm:px-6 lg:px-8", tabs.length > 0 && "pb-28 lg:pb-12")}>{children}</main>
          </div>
          {tabs.length > 0 && (
            <nav aria-label="Quick links" className="no-print fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 grid gap-1 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-lift backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px]", active === href ? "brand-gradient font-semibold text-white shadow-[var(--shadow-brand)]" : "text-muted")}>
                  <Icon className="size-5" />{t(href === "/dashboard" ? "Home" : href === "/profile" ? "Profile" : label)}
                </Link>
              ))}
            </nav>
          )}
          <BrowserCleanup />
          <Shortcuts role={user.role} />
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
