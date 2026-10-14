"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/action-state";

/** Reset-password button that shows the generated temporary password inline. */
export function ResetResult({ action, id }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; id: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col items-end">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="sm" confirm="Generate a new temporary password for this user?">Reset password</SubmitButton>
      {state.message && <code className="mt-1 rounded bg-success-soft px-2 py-0.5 text-xs text-success select-all">{state.message.split(": ").pop()}</code>}
    </form>
  );
}
