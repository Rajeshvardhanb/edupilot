"use client";

import Link from "next/link";
import { use, useRef, useState } from "react";
import { Lock, Mail, ShieldCheck, Users, BookOpen, Wallet, GraduationCap, ClipboardList, HeartHandshake, Eye, EyeOff, ArrowRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { login } from "@/actions/auth";

const DEMO = [
  { role: "Admin", email: "admin@edupilot.edu", icon: ShieldCheck, chip: "chip-brand" },
  { role: "HOD", email: "hod.cse@edupilot.edu", icon: Users, chip: "chip-violet" },
  { role: "Faculty", email: "faculty@edupilot.edu", icon: BookOpen, chip: "chip-pink" },
  { role: "Accounts", email: "accounts@edupilot.edu", icon: Wallet, chip: "chip-success" },
  { role: "Office", email: "office@edupilot.edu", icon: ClipboardList, chip: "chip-warning" },
  { role: "Student", email: "student@edupilot.edu", icon: GraduationCap, chip: "chip-info" },
  { role: "Parent", email: "parent@edupilot.edu", icon: HeartHandshake, chip: "chip-danger" },
];

export function LoginForm({ searchParams, showDemo }: { searchParams: Promise<Record<string, string | string[] | undefined>>; showDemo: boolean }) {
  const { next, expired, reset } = use(searchParams);
  const [show, setShow] = useState(false);
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
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input ref={email} id="email" name="email" type="email" required autoComplete="username" placeholder="you@college.edu" className="input h-11 pl-10" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between"><label className="label" htmlFor="password">Password</label><Link href="/forgot-password" className="mb-1 text-xs text-brand">Forgot password?</Link></div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input ref={password} id="password" name="password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••" className="input h-11 pr-11 pl-10" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <SubmitButton className="group h-11 w-full text-[15px]">Sign in <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></SubmitButton>
      </ActionForm>
      {showDemo && (
        <div className="mt-7">
          <div className="mb-3 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />Explore the demo as<span className="h-px flex-1 bg-line" /></div>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO.map(({ role, email: e, icon: Icon, chip }) => (
              <button
                key={e} type="button" title={e}
                onClick={() => { if (email.current && password.current) { email.current.value = e; password.current.value = "password123"; password.current.form?.requestSubmit(); } }}
                className={`flex w-[calc(25%-6px)] flex-col items-center gap-1.5 rounded-xl border border-line bg-gradient-to-b from-white to-[#f8f8fd] px-1 py-3 text-xs font-semibold text-fg transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card`}
              >
                <span className={`chip size-8 ${chip}`}><Icon className="size-4" /></span>{role}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
