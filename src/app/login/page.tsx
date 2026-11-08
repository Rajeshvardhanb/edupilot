import { BrandMark, Wordmark } from "@/components/brand-mark";
import { Suspense } from "react";
import { Lock, ShieldCheck, History, UserRound } from "lucide-react";
import { LoginForm } from "./login-form";
import { getInstitution } from "@/lib/institution";
import { CampusPanel } from "@/components/campus-panel";

export const metadata = { title: "Sign in" };
// Shows the college name and logo from the database, so it is rendered per request, not at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const inst = await getInstitution();
  // One-click demo sign-in: always while developing; on a server only when DEMO_LOGINS=1 (a demo deployment).
  const showDemo = process.env.NODE_ENV !== "production" || process.env.DEMO_LOGINS === "1";

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.12fr_1fr]">
      <CampusPanel />
      <main className="auth-form-panel relative flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center gap-2.5 lg:hidden"><BrandMark size={32} /><Wordmark className="text-lg" /></div>
        {inst.phone && <p className="mt-2 text-right text-sm text-muted lg:mt-6">Need help? <a href={`tel:${inst.phone.replace(/[^0-9+]/g, "")}`} className="font-semibold text-brand">{inst.phone}</a></p>}
        <div className="auth-login-card mx-auto my-auto w-full max-w-[460px] animate-fade-up rounded-3xl border border-white bg-white/95 p-6 shadow-lift sm:p-8">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-violet-100 text-brand"><UserRound className="size-8" /></span>
          <h2 className="text-center text-[1.75rem] leading-tight font-bold tracking-tight">Welcome back!</h2>
          <p className="mt-1.5 mb-7 text-center text-sm text-muted">Sign in to your {inst.shortName} account.</p>
          <Suspense>
            <LoginForm searchParams={props.searchParams} showDemo={showDemo} />
          </Suspense>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
            <li className="flex items-center gap-1.5"><Lock className="size-3.5" /> Encrypted sessions</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Role-based access</li>
            <li className="flex items-center gap-1.5"><History className="size-3.5" /> Every change logged</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
