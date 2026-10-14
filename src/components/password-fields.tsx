"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** New-password + confirm inputs with a live checklist of the rules and a show/hide toggle. */
export function PasswordFields({ errors }: { errors?: Record<string, string[] | undefined> }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const rules = [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[a-zA-Z]/.test(pw) && /\d/.test(pw), label: "Letters and numbers" },
    { ok: pw.length > 0 && pw === confirm, label: "Both entries match" },
  ];
  return (
    <>
      <div>
        <label className="label" htmlFor="password">New password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="input pr-10" required />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        {errors?.password?.[0] && <p className="mt-1 text-xs text-danger">{errors.password[0]}</p>}
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="input" required />
        {errors?.confirm?.[0] && <p className="mt-1 text-xs text-danger">{errors.confirm[0]}</p>}
      </div>
      <ul className="space-y-1 text-xs">
        {rules.map((r) => <li key={r.label} className={cn("flex items-center gap-1.5", r.ok ? "text-success" : "text-muted")}>{r.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}{r.label}</li>)}
      </ul>
    </>
  );
}
