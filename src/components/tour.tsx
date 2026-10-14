"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { Sparkles } from "lucide-react";
import { buttonClass } from "./ui";

type Step = { target?: string; title: string; body: string };

const COMMON: Step[] = [
  { target: "[data-tour=search]", title: "Search anything", body: "Press Ctrl + K to jump to any page. Staff can also find a student by name or roll number." },
  { target: "[data-tour=sidebar]", title: "Your menu", body: "Everything you can do is grouped here. On a phone, open it with the ☰ button." },
  { target: "[data-tour=bell]", title: "Notifications", body: "New notices from the college appear here." },
  { target: "[data-tour=user]", title: "Your account", body: "Change language, text size, photo or password from this menu." },
];
const FIRST: Partial<Record<Role, Step>> = {
  ADMIN: { title: "Welcome, Administrator", body: "Your dashboard shows attendance, fees, results and placements across the institution. Set your college name and logo under Administration → Branding." },
  HOD: { title: "Welcome", body: "Your dashboard covers your department. Allocate subjects under Academics and approve leave under Leave & OD." },
  FACULTY: { title: "Welcome", body: "Take attendance and enter marks for your courses. Today's classes are listed on your dashboard." },
  STUDENT: { title: "Welcome", body: "Track your attendance, results and fees here. Apply for leave, download hall tickets and request certificates from the menu." },
  PARENT: { title: "Welcome", body: "You can see your child's attendance, results and fee dues here." },
  OFFICE: { title: "Welcome", body: "Handle enquiries and admissions, keep student records up to date and issue certificates. Requests waiting on you are under My tasks." },
  ACCOUNTANT: { title: "Welcome", body: "Collect fees, print receipts and track dues. The day book lists every payment." },
};

/** First-login walkthrough. Shown once per user per browser; can be replayed from My Profile. */
export function Tour({ role, userId }: { role: Role; userId: string }) {
  const key = `edupilot-tour-${userId}`;
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const steps = [FIRST[role]!, ...COMMON].filter(Boolean);
  // It starts by itself only on the dashboard, which its first step describes, never over a page someone opened to work on.
  const onDashboard = usePathname() === "/dashboard";

  useEffect(() => {
    const start = () => setStep(0);
    let seen = true;
    try { seen = !!localStorage.getItem(key); } catch {}
    const timer = seen || !onDashboard ? undefined : setTimeout(start, 900);
    window.addEventListener("edupilot:tour", start);
    return () => { clearTimeout(timer); window.removeEventListener("edupilot:tour", start); };
  }, [key, onDashboard]);

  useEffect(() => {
    if (step < 0) return;
    const sel = steps[step]?.target;
    const el = sel ? [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.offsetParent !== null) : null;
    const r = el?.getBoundingClientRect() ?? null;
    const id = requestAnimationFrame(() => setRect(r && r.width > 0 && r.left >= 0 ? r : null));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (step < 0) return null;
  const s = steps[step];
  const finish = () => { try { localStorage.setItem(key, "1"); } catch {} setStep(-1); };
  const pos = rect
    ? { top: Math.min(window.innerHeight - 220, rect.bottom + 12), left: Math.max(12, Math.min(window.innerWidth - 332, rect.left)) }
    : { top: window.innerHeight / 2 - 110, left: window.innerWidth / 2 - 160 };

  return (
    <div className="no-print fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-900/50" onClick={finish} />
      {rect && <div className="pointer-events-none absolute rounded-xl ring-4 ring-white/90 transition-all" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: Math.min(rect.height + 8, window.innerHeight - rect.top) }} />}
      <div role="dialog" aria-label="Guided tour" className="absolute w-80 animate-fade-up rounded-2xl border border-line bg-surface p-5 shadow-2xl" style={pos}>
        <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-brand" /> {s.title}</p>
        <p className="mt-2 text-sm text-muted">{s.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted">{step + 1} / {steps.length}</span>
          <span className="flex gap-2">
            <button className={buttonClass("ghost", "sm")} onClick={finish}>Skip</button>
            <button className={buttonClass("primary", "sm")} onClick={() => (step + 1 < steps.length ? setStep(step + 1) : finish())}>{step + 1 < steps.length ? "Next" : "Done"}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

export function ReplayTourButton() {
  return <button className={buttonClass("secondary", "sm")} onClick={() => window.dispatchEvent(new Event("edupilot:tour"))}><Sparkles className="size-3.5" /> Replay the guided tour</button>;
}
