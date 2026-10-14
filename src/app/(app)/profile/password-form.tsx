"use client";

import { changePassword } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PasswordFields } from "@/components/password-fields";
import { Field } from "@/components/ui";

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} className="space-y-3" resetOnSuccess>
      {(s) => (
        <>
          <Field label="Current password" name="current" error={s.fieldErrors?.current}><input id="current" name="current" type="password" className="input" autoComplete="current-password" required /></Field>
          <PasswordFields errors={s.fieldErrors} />
          <SubmitButton>Update password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
