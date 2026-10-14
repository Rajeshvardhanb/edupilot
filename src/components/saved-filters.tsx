"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Bookmark, X } from "lucide-react";

type Saved = { name: string; query: string };
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const EMPTY = "[]";

/** Named filter presets for a list page, kept in this browser. */
export function SavedFilters({ storageKey }: { storageKey: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(storageKey) ?? EMPTY; } catch { return EMPTY; } }, () => EMPTY);
  const saved: Saved[] = JSON.parse(raw);
  const write = (next: Saved[]) => { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {} listeners.forEach((l) => l()); };
  const current = new URLSearchParams(params.toString());
  current.delete("page");
  const query = current.toString();

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2 text-xs">
      {saved.map((s) => (
        <span key={s.name} className="flex items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-3">
          <Link href={`${pathname}?${s.query}`} className="hover:text-brand">{s.name}</Link>
          <button aria-label={`Remove ${s.name}`} onClick={() => write(saved.filter((x) => x.name !== s.name))} className="rounded-full p-0.5 text-muted hover:bg-surface-2"><X className="size-3" /></button>
        </span>
      ))}
      {query && (
        <button
          onClick={() => { const name = window.prompt("Name this filter (e.g. “CSE lateral entries”)")?.trim(); if (name) write([...saved.filter((x) => x.name !== name), { name, query }].slice(-8)); }}
          className="flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 text-muted hover:border-brand hover:text-brand"
        ><Bookmark className="size-3" /> Save this filter</button>
      )}
    </div>
  );
}
