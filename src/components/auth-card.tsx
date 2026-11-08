import { BrandMark, Wordmark } from "@/components/brand-mark";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CampusPanel } from "./campus-panel";

/** The sign-in helper pages (forgot / reset / first-login password): the campus panel on the left, the form on the right. */
export async function AuthCard({ title, subtitle, children, back = true }: { title: string; subtitle: string; children: ReactNode; back?: boolean }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.12fr_1fr]">
      <CampusPanel />
      <main className="auth-form-panel flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center gap-2.5 lg:hidden"><BrandMark size={32} /><Wordmark className="text-lg" /></div>
        <div className="mx-auto my-auto w-full max-w-[460px] animate-fade-up rounded-3xl border border-white bg-white/95 p-6 shadow-lift sm:p-8">
          {back && <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft className="size-4" /> Back to sign in</Link>}
          <span className="chip chip-violet mb-5 size-14 rounded-2xl"><ShieldCheck className="size-7" /></span>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 mb-6 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
