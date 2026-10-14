"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const TEXT_KEY = "edupilot-text";

/** Runs before first paint so the saved text size never flashes. */
export function PrefsScript() {
  const js = `try{var z=localStorage.getItem("${TEXT_KEY}");if(z==="lg"||z==="xl")document.documentElement.dataset.text=z}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const readText = () => document.documentElement.dataset.text ?? "md";

function applyTextSize(v: string) {
  if (v === "md") delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = v;
  try { localStorage.setItem(TEXT_KEY, v); } catch {}
  listeners.forEach((l) => l());
}

/** Larger text for readability: scales the whole interface. */
export function TextSizeToggle() {
  const size = useSyncExternalStore(subscribe, readText, () => "md");
  const choose = applyTextSize;
  return (
    <div role="radiogroup" aria-label="Text size" className="inline-flex items-end rounded-lg border border-line bg-surface-2 p-0.5">
      {[["md", "A", "text-xs", "Normal text"], ["lg", "A", "text-sm", "Large text"], ["xl", "A", "text-base", "Extra large text"]].map(([v, label, cls, title]) => (
        <button key={v} role="radio" aria-checked={size === v} title={title} aria-label={title} onClick={() => choose(v)} className={cn("rounded-md px-2.5 py-1 font-semibold transition", cls, size === v ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg")}>{label}</button>
      ))}
    </div>
  );
}
