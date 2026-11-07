"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark, Wordmark } from "./brand-mark";
import { ArrowLeft, Bell, ChevronDown, Keyboard, Languages, LogOut, Menu, Printer, Search, UserCircle } from "lucide-react";
import { TextSizeToggle } from "./theme";
import { CommandPalette } from "./command-palette";
import { initials } from "./avatar";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/utils";
import type { ShellUser } from "./app-shell";
import { LANGS, type Lang } from "@/lib/i18n";
import { setChild, setLanguage } from "@/actions/prefs";

export type ShellNotice = { id: string; title: string; date: string; fresh: boolean };

function useOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOut]);
  return ref;
}

function UserAvatar({ user, size = 34 }: { user: ShellUser; size?: number }) {
  return user.hasPhoto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={`/photo/${user.id}`} alt="" style={{ width: size, height: size }} className="rounded-lg object-cover" />
    : <span aria-hidden style={{ width: size, height: size }} className="brand-gradient grid place-items-center rounded-lg text-[11px] font-bold text-white">{initials(user.name)}</span>;
}

export function Topbar({ user, notices, unread, onMenu, lang, t, title }: {
  user: ShellUser; notices: ShellNotice[]; unread: number; onMenu: () => void; lang: Lang; t: (k: string) => string;
  /** Page name for the middle of the phone's top bar; null shows the EduPilot logo (the dashboard). */
  title: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Inner pages (a record, a form) get a back arrow on phones, as in the design; section pages keep the menu button.
  const inner = pathname.split("/").filter(Boolean).length > 1;
  const [palette, setPalette] = useState(false);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useOutside(() => setBell(false));
  const menuRef = useOutside(() => setMenu(false));
  const fresh = unread;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {inner
          ? <button onClick={() => (history.length > 1 ? router.back() : router.push(`/${pathname.split("/")[1]}`))} aria-label="Back" className="-ml-1 grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-fg-2 shadow-xs hover:bg-surface-2 sm:hidden"><ArrowLeft className="size-5" /></button>
          : null}
        <button onClick={onMenu} aria-label="Open menu" className={cn("-ml-1 size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-fg-2 shadow-xs hover:bg-surface-2 lg:hidden", inner ? "hidden sm:grid" : "grid")}><Menu className="size-5" /></button>
        {/* Phone: the page name (or the logo on the dashboard) in the middle. */}
        <div className="flex min-w-0 flex-1 justify-center sm:hidden">
          {title ? <p className="truncate text-base font-bold">{title}</p> : <span className="flex items-center gap-2"><BrandMark size={26} /><Wordmark className="text-base" /></span>}
        </div>
        <button data-tour="search" onClick={() => setPalette(true)} className="hidden h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-muted shadow-xs transition-colors hover:border-brand/30 sm:flex sm:max-w-sm">
          <Search className="size-4 shrink-0" /><span className="truncate">{t("Search students, staff, pages…")}</span>
          <kbd className="ml-auto hidden rounded border border-line bg-surface-2 px-1.5 py-px font-sans text-[10px] font-medium sm:inline">Ctrl K</kbd>
        </button>
        <div className="flex items-center gap-1 sm:ml-auto sm:gap-2">
          {user.children.length > 1 && (
            <form action={setChild}>
              <select name="child" defaultValue={user.studentId ?? ""} aria-label="Viewing child" onChange={(e) => e.currentTarget.form?.requestSubmit()} className="input h-9 w-auto max-w-40 py-1 text-sm">
                {user.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </form>
          )}
          <div ref={bellRef} data-tour="bell" className="relative">
            <button onClick={() => setBell((b) => !b)} aria-label={`Notifications${fresh ? `, ${fresh} unread` : ""}`} aria-expanded={bell} className="relative grid size-10 place-items-center rounded-xl border border-line bg-surface text-fg-2 shadow-xs transition-colors hover:border-brand/30 hover:text-fg">
              <Bell className="size-5" />
              {fresh > 0 && <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#f43f5e] px-1 text-[10px] font-bold text-white ring-2 ring-surface">{fresh > 99 ? "99+" : fresh}</span>}
            </button>
            {bell && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-fade-up overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-lift">
                <p className="border-b border-line px-4 py-3 text-sm font-semibold">{t("Notifications")}</p>
                <ul className="max-h-80 overflow-y-auto">
                  {notices.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up</li>}
                  {notices.map((n) => (
                    <li key={n.id}>
                      <Link href={`/notifications/${n.id}`} prefetch={false} onClick={() => setBell(false)} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.fresh ? "bg-brand" : "bg-line")} />
                        <span className="min-w-0"><span className="block truncate text-sm">{n.title}</span><span className="text-xs text-muted">{n.date}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/notifications" onClick={() => setBell(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs text-brand">See all notifications</Link>
              </div>
            )}
          </div>
          <div ref={menuRef} data-tour="user" className="relative">
            <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} className="hidden h-10 items-center gap-2.5 rounded-xl border border-line bg-surface p-1 pr-1.5 shadow-xs transition-colors hover:border-brand/30 sm:flex sm:pr-2.5">
              <UserAvatar user={user} size={30} />
              <span className="hidden text-left leading-tight sm:block"><span className="block max-w-36 truncate text-sm font-medium">{user.name}</span><span className="block max-w-40 truncate text-[11px] text-muted">{user.subtitle}</span></span>
              {/* Named by what it shows (name and role) so voice control can use it; on phones only the avatar shows. */}
              <span className="sr-only sm:hidden">{user.name}</span><span className="sr-only">account menu</span>
              <ChevronDown className="hidden size-4 text-muted sm:block" />
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-64 animate-fade-up overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-lift">
                <div className="flex items-center gap-3 border-b border-line p-4">
                  <UserAvatar user={user} size={40} />
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted">{user.email}</p></div>
                </div>
                <div className="p-2">
                  <form action={setLanguage} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Languages className="size-4 text-muted" />
                    <select name="lang" defaultValue={lang} aria-label={t("Language")} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm">
                      {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </form>
                  <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="text-muted">Text size</span><TextSizeToggle /></div>
                  <button onClick={() => { setMenu(false); setTimeout(() => window.print(), 50); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><Printer className="size-4" /> Print this page</button>
                  <button onClick={() => { setMenu(false); window.dispatchEvent(new Event("edupilot:shortcuts")); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><Keyboard className="size-4" /> Keyboard shortcuts</button>
                  <Link href="/profile" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><UserCircle className="size-4" /> {t("My Profile")}</Link>
                  <form action={logout}><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft"><LogOut className="size-4" /> {t("Sign out")}</button></form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {palette && <CommandPalette role={user.role} onClose={() => setPalette(false)} />}
    </header>
  );
}
