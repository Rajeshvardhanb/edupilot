"use client";

import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { resendLoginCode, verifyLoginCode } from "@/actions/auth";

export function VerifyForm({ next }: { next: string }) {
  return (
    <>
      <ActionForm action={verifyLoginCode} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="code">Six-digit code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} autoFocus required className="input h-12 text-center font-mono text-xl tracking-[0.4em]" />
        </div>
        <SubmitButton className="w-full">Verify and sign in</SubmitButton>
      </ActionForm>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>Didn&apos;t get it? Check spam, or</span>
        <ActionButton action={resendLoginCode} fields={{}} variant="ghost">Send a new code</ActionButton>
      </div>
    </>
  );
}
