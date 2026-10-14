"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { Keyboard, X } from "lucide-react";
import { NAV } from "./nav";

const GO: [string, string, string][] = [
  ["d", "/dashboard", "Dashboard"], ["s", "/students", "Students"], ["a", "/attendance", "Attendance"], ["t", "/timetable", "Timetable"],
  ["e", "/exams", "Marks entry"], ["r", "/results", "Results"], ["f", "/fees", "Fees"], ["n", "/notifications", "Notifications"], ["p", "/profile", "My profile"],
];

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{children}</kbd>;
}

/** “g” then a letter jumps to a page; “/” opens search; “?” shows this list. Ignored while typing in a field. */
export function Shortcuts({ role }: { role: Role }) {
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const allowed = useMemo(() => GO.filter(([, href]) => href === "/notifications" || NAV.some((n) => n.href === href && n.roles.includes(role))), [role]);

  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "?") { e.preventDefault(); return setHelp((h) => !h); }
      if (e.key === "Escape") return setHelp(false);
      if (e.key === "/") { e.preventDefault(); return document.querySelector<HTMLButtonElement>("[data-tour=search]")?.click(); }
      if (e.key === "g") { armed = Date.now(); return; }
      if (Date.now() - armed < 1500) {
        const hit = allowed.find(([k]) => k === e.key.toLowerCase());
        armed = 0;
        if (hit) { e.preventDefault(); router.push(hit[1]); }
      }
    };
    const open = () => setHelp(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("edupilot:shortcuts", open);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("edupilot:shortcuts", open); };
  }, [router, allowed]);

  if (!help) return null;
  return (
    <div className="no-print fixed inset-0 z-[85] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={() => setHelp(false)}>
      <div role="dialog" aria-label="Keyboard shortcuts" className="w-full max-w-md animate-fade-up rounded-[var(--radius-panel)] border border-line bg-surface p-6 shadow-lift" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Keyboard className="size-4 text-brand" /> Keyboard shortcuts</h2><button onClick={() => setHelp(false)} aria-label="Close" className="rounded-lg p-1.5 hover:bg-surface-2"><X className="size-4" /></button></div>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Search students and pages</span><span className="flex gap-1"><Key>/</Key> or <Key>Ctrl</Key><Key>K</Key></span></li>
          {allowed.map(([k, , label]) => <li key={k} className="flex justify-between"><span>Go to {label}</span><span className="flex gap-1"><Key>g</Key><Key>{k}</Key></span></li>)}
          <li className="flex justify-between"><span>Show this list</span><Key>?</Key></li>
        </ul>
      </div>
    </div>
  );
}
