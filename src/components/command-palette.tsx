"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { CornerDownLeft, GraduationCap, Search } from "lucide-react";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

type Hit = { id: string; name: string; rollNo: string; batch: string };
type Item = { key: string; label: string; sub: string; href: string; icon: React.ReactNode };

export function CommandPalette({ role, onClose }: { role: Role; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const canSearchStudents = role !== "STUDENT";

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!canSearchStudents || q.trim().length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : [])).then(setHits).catch(() => {});
    }, 150);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, canSearchStudents]);

  const items: Item[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = NAV.filter((n) => n.roles.includes(role) && (!term || n.label.toLowerCase().includes(term) || n.hint?.toLowerCase().includes(term)))
      .map((n) => ({ key: n.href, label: n.label, sub: n.hint ?? "", href: n.href, icon: <n.icon className="size-4" /> }));
    const students = (term.length < 2 ? [] : hits).map((h) => ({ key: h.id, label: h.name, sub: `${h.rollNo} · ${h.batch}`, href: `/students/${h.id}`, icon: <GraduationCap className="size-4" /> }));
    return [...students, ...pages];
  }, [q, hits, role]);

  function go(i: Item | undefined) {
    if (!i) return;
    onClose();
    router.push(i.href);
  }

  return (
    <div className="fixed inset-0 z-[60] grid items-start justify-items-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-label="Search" className="w-full max-w-xl animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-muted" />
          <input
            ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter") go(items[active]);
            }}
            placeholder={canSearchStudents ? "Search students by name or roll no, or jump to a page…" : "Jump to a page…"}
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No matches</li>}
          {items.map((it, i) => (
            <li key={it.key}>
              <button
                onMouseEnter={() => setActive(i)} onClick={() => go(it)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === active ? "bg-brand-soft text-brand" : "hover:bg-surface-2")}
              >
                <span className={cn("grid size-8 place-items-center rounded-lg", i === active ? "bg-surface" : "bg-surface-2 text-muted")}>{it.icon}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{it.label}</span><span className="block truncate text-xs text-muted">{it.sub}</span></span>
                {i === active && <CornerDownLeft className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
