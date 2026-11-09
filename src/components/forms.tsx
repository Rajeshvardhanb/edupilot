"use client";

import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass } from "./ui";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";
import { useConfirm } from "./confirm";
import { LiveContext, validityMessage } from "./live-validation";
import { checkField } from "@/actions/validate";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * Form wired to a server action. Children may be a render function receiving the
 * last result so fields can display their own errors.
 *
 * The action is called inside a transition rather than as a native form action, so
 * React does not auto-reset the fields: users keep their input when validation fails.
 * Pass `resetOnSuccess` to clear the form after a successful save.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  onResult,
  toastSuccess,
}: {
  action: Action;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  /** Called after each server response (e.g. to clear an "unsaved changes" flag). */
  onResult?: (state: ActionState) => void;
  /** Show the success message as a toast: use when the form itself disappears on success. */
  toastSuccess?: boolean;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  // Field messages shown as the user leaves each field, before anything is submitted.
  const [live, setLive] = useState<Record<string, string>>({});
  const setField = (name: string, msg: string) => setLive((l) => (l[name] === msg || (!msg && !(name in l)) ? l : { ...l, [name]: msg }));

  return (
    <form
      ref={ref}
      className={className}
      onBlurCapture={(e) => {
        const el = e.target;
        if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) || !el.name || el.type === "hidden") return;
        const msg = validityMessage(el);
        setField(el.name, msg);
        // data-check asks the server whether the value is free (or exists); skipped when the value is unchanged on an edit form.
        const kind = el.dataset.check;
        if (!msg && kind && el.value.trim() && el.value !== (el as HTMLInputElement).defaultValue) {
          const name = el.name, value = el.value;
          void checkField(kind, value).then((m) => { if (el.value === value) setField(name, m); }, () => {});
        }
      }}
      onInputCapture={(e) => { const el = e.target as HTMLInputElement; if (el.name && live[el.name]) setField(el.name, ""); }}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form, (e.nativeEvent as SubmitEvent).submitter);
        // Handle the response here rather than in an effect: the form may be gone by the time it arrives
        // (e.g. the list it lived in re-rendered), and the user must still get the confirmation.
        startTransition(async () => {
          const result = (await action(state, fd)) ?? {};
          setState(result);
          if (result.ok && resetOnSuccess) { form.reset(); setLive({}); }
          onResult?.(result);
          if (result.ok && result.message && toastSuccess) toast({ message: result.message, tone: "success" });
        });
      }}
    >
      <PendingContext value={pending}>
        <LiveContext value={live}>
          <FormMessage state={toastSuccess && state.ok ? {} : state} />
          {typeof children === "function" ? children(state) : children}
        </LiveContext>
      </PendingContext>
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  return (
    <>
      {state.ok && state.message && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {state.message}
        </div>
      )}
      {state.error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </div>
      )}
    </>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md", className, confirm }: {
  children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md"; className?: string; confirm?: string;
}) {
  const { pending: nativePending } = useFormStatus();
  const pending = nativePending || use(PendingContext);
  const ask = useConfirm();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(buttonClass(variant, size), className)}
      onClick={(e) => {
        if (!confirm) return;
        // Hold the submit until the user confirms. requestSubmit() does not fire click, so this never loops.
        e.preventDefault();
        const btn = e.currentTarget;
        ask(confirm, { danger: variant === "danger" }).then((ok) => { if (ok) btn.form?.requestSubmit(btn); });
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/**
 * One-click action button (delete, toggle, approve…). Results surface as toasts.
 * `confirm` asks first; `undoable` instead runs after a 5-second window with an Undo toast.
 */
export function ActionButton({ action, fields, children, variant = "secondary", confirm, undoable, size = "sm", className, disabled = false }: {
  action: Action; fields: Record<string, string>; children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string; undoable?: string; size?: "sm" | "md"; className?: string; disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);
  const { toast } = useToast();
  const ask = useConfirm();

  function run() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(async () => {
      const r = await action({}, fd);
      if (r?.error) toast({ message: r.error, tone: "error" }, 6000);
      else if (r?.message) toast({ message: r.message, tone: "success" });
    });
  }

  async function onClick() {
    if (undoable) {
      let cancelled = false;
      setQueued(true);
      toast({ message: undoable, tone: "info", undo: () => { cancelled = true; setQueued(false); } }, 5000);
      setTimeout(() => { if (!cancelled) { setQueued(false); run(); } }, 5000);
      return;
    }
    if (confirm && !(await ask(confirm, { danger: variant === "danger" || variant === "ghost" }))) return;
    run();
  }

  return (
    <button type="button" disabled={disabled || pending || queued} onClick={onClick} className={cn(buttonClass(variant, size), className)}>
      {(pending || queued) && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/** Warns before leaving the page (reload, close, typed URL) while there are unsaved edits. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
