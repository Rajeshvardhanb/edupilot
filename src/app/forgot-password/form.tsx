"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { forgotPassword } from "@/actions/auth";

export function ForgotForm() {
  return (
    <ActionForm action={forgotPassword} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" className="input h-11" required />
      </div>
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </ActionForm>
  );
}
