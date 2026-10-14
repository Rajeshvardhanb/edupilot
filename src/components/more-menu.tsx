"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { buttonClass } from "./ui";

/** A "More" button that opens a short list of the less-used actions of a page. Closes on a click outside, Escape, or after choosing. */
export function MoreMenu({ children, label = "More" }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary className={`${buttonClass("secondary")} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <MoreHorizontal className="size-4" /> {label}
      </summary>
      <div
        className="more-menu absolute left-0 z-30 mt-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-0.5 rounded-[var(--radius-panel)] border border-line bg-surface p-1.5 shadow-lift"
        onClick={(e) => { if ((e.target as HTMLElement).closest("a")) ref.current!.open = false; }}
      >
        {children}
      </div>
    </details>
  );
}
