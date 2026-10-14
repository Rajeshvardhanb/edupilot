import { BrandMark } from "@/components/brand-mark";
import { Suspense } from "react";
import { Award, Briefcase, ClipboardCheck, Lock, ShieldCheck, TrendingUp, Wallet, History, CheckCircle2 } from "lucide-react";
import { LoginForm } from "./login-form";
import { getInstitution } from "@/lib/institution";

export const metadata = { title: "Sign in" };
// Shows the college name and logo from the database, so it is rendered per request, not at build time.
export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: ClipboardCheck, title: "Attendance", text: "Period-wise, with shortage alerts" },
  { icon: Award, title: "Results", text: "SGPA, CGPA and grade cards" },
  { icon: Wallet, title: "Fees", text: "Receipts, dues and day book" },
  { icon: Briefcase, title: "Placements", text: "Drives with built-in eligibility" },
];

export default async function LoginPage(props: PageProps<"/login">) {
  const inst = await getInstitution();
  // One-click demo sign-in: always while developing; on a server only when DEMO_LOGINS=1 (a demo deployment).
  const showDemo = process.env.NODE_ENV !== "production" || process.env.DEMO_LOGINS === "1";
  const logo = inst.logoType
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src="/brand/logo" alt="" className="size-11 shrink-0 rounded-[var(--radius-card)] bg-white object-contain p-1 shadow-sm ring-1 ring-line" />
    : <BrandMark size={44} tile className="!rounded-[var(--radius-card)] ring-1 ring-line" />;

  return (
    <div className="relative flex min-h-screen flex-col bg-bg">

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center gap-3 px-5 pt-6 sm:px-8">
        {logo}
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold tracking-tight sm:text-base">{inst.name}</p>
          <p className="truncate text-xs text-muted">{inst.tagline}</p>
        </div>
        {(inst.phone || inst.email) && (
          <p className="ml-auto hidden text-right text-xs leading-relaxed text-muted md:block">
            Need help signing in?<br />
            <span className="text-fg">{[inst.phone, inst.email].filter(Boolean).join(" · ")}</span>
          </p>
        )}
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* The story: what the product is, shown with its own interface rather than a photograph. */}
        <section className="hidden lg:block">
          <p className="text-sm font-medium text-brand">College management, all in one place</p>
          <h1 className="mt-3 text-[2.5rem] leading-[1.1] font-bold xl:text-[2.875rem]">
            Run your whole campus from one screen.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            Admissions to placements for students, parents, teachers, heads of department, accounts and the office — each with exactly what they need.
          </p>

          <div className="relative mt-10 h-[300px] max-w-[540px]">
            <div className="absolute top-0 left-0 w-[300px] rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-lift">
              <div className="flex items-center gap-2.5">
                <span className="chip chip-success size-9"><ClipboardCheck className="size-4" /></span>
                <p className="text-[13px] font-medium text-muted">Attendance this term</p>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <p className="font-display text-[2rem] leading-none font-bold tabular-nums">88.1%</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success"><TrendingUp className="size-3" /> 2.4 pts</span>
              </div>
              <svg viewBox="0 0 260 48" className="mt-3 h-12 w-full" aria-hidden>
                <defs><linearGradient id="lg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--success)" stopOpacity="0.25" /><stop offset="1" stopColor="var(--success)" stopOpacity="0" /></linearGradient></defs>
                <path d="M0 34 L26 30 L52 33 L78 24 L104 27 L130 18 L156 21 L182 13 L208 16 L234 9 L260 11 L260 48 L0 48 Z" fill="url(#lg-area)" />
                <path d="M0 34 L26 30 L52 33 L78 24 L104 27 L130 18 L156 21 L182 13 L208 16 L234 9 L260 11" fill="none" stroke="var(--success)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
            <div className="absolute top-8 right-0 w-[230px] rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-lift">
              <div className="flex items-center gap-2.5">
                <span className="chip chip-info size-9"><Wallet className="size-4" /></span>
                <p className="text-[13px] font-medium text-muted">Fees collected</p>
              </div>
              <p className="mt-3 font-display text-2xl font-bold tabular-nums">67%</p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-2">
                <span className="h-full w-[67%] rounded-full bg-brand" />
              </div>
              <p className="mt-2 text-[11px] text-muted">of this year&apos;s demand</p>
            </div>
            <div className="absolute bottom-0 left-20 flex w-[320px] items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 shadow-lift">
              <span className="chip size-9 shrink-0"><CheckCircle2 className="size-4" /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Result published</p>
                <p className="text-xs text-muted">Students and parents notified instantly</p>
              </div>
            </div>
          </div>

          <ul className="mt-10 grid max-w-[520px] grid-cols-2 gap-x-6 gap-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="size-4" /></span>
                <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{text}</span></span>
              </li>
            ))}
          </ul>
        </section>

        {/* The sign-in card. */}
        <section className="mx-auto w-full max-w-[440px] animate-fade-up">
          <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-7 shadow-lift sm:p-9">
            <h2 className="text-2xl leading-tight font-semibold">Welcome back</h2>
            <p className="mt-1.5 mb-7 text-sm text-muted">Sign in to {inst.shortName} with your college email.</p>
            <Suspense>
              <LoginForm searchParams={props.searchParams} showDemo={showDemo} />
            </Suspense>
          </div>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
            <li className="flex items-center gap-1.5"><Lock className="size-3.5" /> Encrypted sessions</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Role-based access</li>
            <li className="flex items-center gap-1.5"><History className="size-3.5" /> Every change logged</li>
          </ul>
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-5 pb-6 text-xs text-muted sm:justify-between sm:px-8">
        <span className="hidden sm:block">© {new Date().getFullYear()} {inst.name}</span>
        <span className="flex items-center gap-1.5">Powered by <BrandMark size={18} /> <span className="font-semibold text-fg">EduPilot</span></span>
      </footer>
    </div>
  );
}
