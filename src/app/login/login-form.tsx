"use client";

import Link from "next/link";
import { use, useRef } from "react";
import { Lock, Mail, ShieldCheck, Users, BookOpen, Wallet, GraduationCap, ClipboardList } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { login } from "@/actions/auth";

const DEMO = [
  { role: "Admin", email: "admin@edupilot.edu", icon: ShieldCheck },
  { role: "HOD", email: "hod.cse@edupilot.edu", icon: Users },
  { role: "Faculty", email: "faculty@edupilot.edu", icon: BookOpen },
  { role: "Accounts", email: "accounts@edupilot.edu", icon: Wallet },
  { role: "Office", email: "office@edupilot.edu", icon: ClipboardList },
  { role: "Student", email: "student@edupilot.edu", icon: GraduationCap },
];

export function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next, expired, reset } = use(searchParams);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  return (
    <>
      {expired && <p role="status" className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">Your session has ended. Please sign in again.</p>}
      {reset && <p role="status" className="mb-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">Password changed. Sign in with your new password.</p>}
      <ActionForm action={login} className="space-y-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input ref={email} id="email" name="email" type="email" required autoComplete="username" placeholder="you@college.edu" className="input h-11 pl-9" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between"><label className="label" htmlFor="password">Password</label><Link href="/forgot-password" className="mb-1 text-xs text-brand">Forgot password?</Link></div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input ref={password} id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className="input h-11 pl-9" />
          </div>
        </div>
        <SubmitButton className="brand-gradient h-11 w-full shadow-lg shadow-indigo-500/25">Sign in</SubmitButton>
      </ActionForm>
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />Try a demo account<span className="h-px flex-1 bg-line" /></div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DEMO.map(({ role, email: e, icon: Icon }) => (
              <button
                key={e} type="button" title={e}
                onClick={() => { if (email.current && password.current) { email.current.value = e; password.current.value = "password123"; password.current.form?.requestSubmit(); } }}
                className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-2 text-[11px] text-muted transition hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand"
              >
                <Icon className="size-4" />{role}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
