"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { useToast } from "./toast";

/** Click the value to edit it where it is. Enter saves, Escape cancels. */
export function InlineEdit({ action, fields, name, value, label, type = "text", placeholder = "Add" }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; fields: Record<string, string>; name: string; value: string; label: string; type?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(value);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function save() {
    const next = input.current?.value.trim() ?? "";
    if (next === shown) return setEditing(false);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    fd.set("field", name); fd.set("value", next);
    start(async () => {
      const r = await action({}, fd);
      if (r?.error) toast({ message: r.error, tone: "error" }, 6000);
      else { setShown(next); setEditing(false); toast({ message: `${label} updated.`, tone: "success" }); }
    });
  }
  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} title={`Edit ${label.toLowerCase()}`} className="group inline-flex items-center gap-1.5 rounded px-1 text-left hover:bg-surface-2">
        <span className={shown ? "" : "text-muted"}>{shown || placeholder}</span><Pencil className="size-3 text-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <input ref={input} autoFocus type={type} defaultValue={shown} aria-label={label} disabled={pending}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") setEditing(false); }}
        className="w-44 rounded-md border border-brand bg-surface px-2 py-0.5 text-sm outline-none ring-2 ring-brand/20" />
      <button type="button" onClick={save} disabled={pending} aria-label="Save" className="rounded p-1 text-success hover:bg-success-soft">{pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}</button>
      <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="rounded p-1 text-muted hover:bg-surface-2"><X className="size-3.5" /></button>
    </span>
  );
}
