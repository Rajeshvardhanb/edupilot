"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { Search } from "lucide-react";

/** Wraps filter inputs; any change updates the URL search params (server re-renders the list). */
export function Filters({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function update(form: HTMLFormElement) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of new FormData(form)) {
      if (v) next.set(k, String(v));
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <form
      className="no-print mb-4 flex flex-wrap items-end gap-2"
      style={{ opacity: pending ? 0.6 : 1 }}
      onSubmit={(e) => { e.preventDefault(); update(e.currentTarget); }}
      onChange={(e) => { if ((e.target as HTMLElement).tagName === "SELECT") update(e.currentTarget); }}
    >
      {children}
    </form>
  );
}

export function SearchInput({ name = "q", placeholder = "Search…", defaultValue }: { name?: string; placeholder?: string; defaultValue?: string }) {
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}
