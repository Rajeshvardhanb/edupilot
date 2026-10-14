"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { PasswordFields } from "@/components/password-fields";
import { changePassword, logout } from "@/actions/auth";

export function ForcedPasswordForm() {
  return (
    <>
      <ActionForm action={changePassword} className="space-y-4">
        {(s) => (
          <>
            <input type="hidden" name="forced" value="1" />
            <div>
              <label className="label" htmlFor="current">Temporary password</label>
              <input id="current" name="current" type="password" autoComplete="current-password" className="input" required />
              {s.fieldErrors?.current?.[0] && <p className="mt-1 text-xs text-danger">{s.fieldErrors.current[0]}</p>}
            </div>
            <PasswordFields errors={s.fieldErrors} />
            <SubmitButton className="w-full">Save and continue</SubmitButton>
          </>
        )}
      </ActionForm>
      <form action={logout} className="mt-3 text-center"><button className="text-xs text-muted hover:text-fg">Sign out</button></form>
    </>
  );
}
