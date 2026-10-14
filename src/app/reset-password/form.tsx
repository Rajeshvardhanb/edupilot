"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { PasswordFields } from "@/components/password-fields";
import { resetPassword } from "@/actions/auth";

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPassword} className="space-y-4">
      {(s) => (
        <>
          <input type="hidden" name="token" value={token} />
          <PasswordFields errors={s.fieldErrors} />
          <SubmitButton className="w-full">Set new password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
