"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { confirmTwoStep, disableTwoStep, startTwoStep } from "@/actions/auth";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field } from "@/components/ui";

/** Turn two-step sign-in on (after proving the email works) or off (after re-entering the password). */
export function TwoStep({ on, email }: { on: boolean; email: string }) {
  const [step, setStep] = useState<"idle" | "code" | "off">("idle");
  if (on) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-success" /> <Badge tone="success">On</Badge> A code is emailed to {email} at every sign-in.</p>
        {step !== "off" ? <button type="button" onClick={() => setStep("off")} className="text-sm text-danger hover:underline">Turn off…</button> : (
          <ActionForm action={disableTwoStep} className="space-y-3" toastSuccess onResult={(r) => { if (r.ok) setStep("idle"); }}>
            {(s) => (
              <>
                <Field label="Your password, to confirm" name="current" error={s.fieldErrors?.current}><input name="current" type="password" autoComplete="current-password" className="input" required /></Field>
                <SubmitButton variant="danger">Turn off two-step sign-in</SubmitButton>
              </>
            )}
          </ActionForm>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm text-muted"><ShieldOff className="mt-0.5 size-4 shrink-0" /> After your password, we email a six-digit code to {email}. Someone who learns your password still can&apos;t sign in without your mailbox.</p>
      {/* The action runs through the toast-showing button; on success the code box appears. */}
      <span onClick={() => setStep("code")}><ActionButton action={startTwoStep} fields={{}} variant="secondary" size="md">{step === "code" ? "Send the code again" : "Turn on: email me a code"}</ActionButton></span>
      {step === "code" && (
        <ActionForm action={confirmTwoStep} className="flex items-end gap-2" toastSuccess onResult={(r) => { if (r.ok) setStep("idle"); }}>
          <Field label="Six-digit code" name="code" className="flex-1"><input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="input font-mono tracking-widest" required /></Field>
          <SubmitButton>Confirm</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
