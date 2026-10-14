"use client";

import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Undo2, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "success" | "error" | "info"; undo?: () => void };
type Ctx = { toast: (t: Omit<Toast, "id">, ms?: number) => number; dismiss: (id: number) => void };

const ToastContext = createContext<Ctx>({ toast: () => 0, dismiss: () => {} });
export const useToast = () => use(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, "id">, ms = 4000) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  return (
    <ToastContext value={{ toast, dismiss }}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto flex max-w-md animate-fade-up items-center gap-3 rounded-[var(--radius-card)] border bg-surface px-4 py-3 text-sm shadow-lift", t.tone === "error" ? "border-danger/40" : "border-line")}>
            {t.tone === "error" ? <AlertCircle className="size-4 shrink-0 text-danger" /> : t.tone === "info" ? <Info className="size-4 shrink-0 text-info" /> : <CheckCircle2 className="size-4 shrink-0 text-success" />}
            <span className="flex-1">{t.message}</span>
            {t.undo && (
              <button onClick={() => { t.undo!(); dismiss(t.id); }} className="flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand"><Undo2 className="size-3.5" /> Undo</button>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-fg"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
