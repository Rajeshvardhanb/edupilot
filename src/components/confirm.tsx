"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { buttonClass } from "./ui";

type Ask = (message: string, opts?: { danger?: boolean; confirmLabel?: string }) => Promise<boolean>;
const ConfirmContext = createContext<Ask>(async () => true);
export const useConfirm = () => use(ConfirmContext);

/** In-app confirmation dialog (replaces the browser's confirm box). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; danger?: boolean; confirmLabel?: string; resolve: (v: boolean) => void } | null>(null);
  const ask: Ask = useCallback((message, opts) => new Promise<boolean>((resolve) => setState({ message, ...opts, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmContext value={ask}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={() => close(false)}>
          <div role="alertdialog" aria-modal className="w-full max-w-sm animate-fade-up rounded-2xl border border-line bg-surface p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${state.danger ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}><AlertTriangle className="size-5" /></span>
              <p className="pt-1.5 text-sm">{state.message}</p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className={buttonClass("secondary")} onClick={() => close(false)}>Cancel</button>
              <button autoFocus className={buttonClass(state.danger ? "danger" : "primary")} onClick={() => close(true)}>{state.confirmLabel ?? "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext>
  );
}
