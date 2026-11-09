"use client";
import { buttonClass } from "@/components/ui";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PasswordFields } from "@/components/password-fields";
import { completeAccountSetup, requestSetupCode } from "@/actions/account-setup";
export function SetupForm({ token }: { token: string }) {
  const [challengeId, setChallengeId] = useState("");
  return <ActionForm className="space-y-4" action={(state, form) => form.get("intent") === "code" ? requestSetupCode(state, form) : completeAccountSetup(state, form)} onResult={s => { if (s.challengeId) setChallengeId(s.challengeId); }}>
    <input type="hidden" name="token" value={token} /><input type="hidden" name="challengeId" value={challengeId} />
    <button type="submit" name="intent" value="code" formNoValidate className={buttonClass("secondary") + " w-full"}>{challengeId ? "Resend email code" : "Send email verification code"}</button>
    <label className="label" htmlFor="setup-code">Six-digit email code</label><input id="setup-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input" required />
    <PasswordFields />
    <SubmitButton className="w-full">Verify email and set password</SubmitButton>
    <p className="text-xs text-muted">Codes expire in ten minutes. Wait one minute between requests. No temporary password is needed.</p>
  </ActionForm>;
}
