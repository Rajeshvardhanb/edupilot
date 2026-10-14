import { BrandMark } from "@/components/brand-mark";
import type { ReactNode } from "react";
import Link from "next/link";
import { getInstitution } from "@/lib/institution";

/** Centered card used by the sign-in helper pages (forgot / reset / first-login password). Matches the sign-in page. */
export async function AuthCard({ title, subtitle, children, back = true }: { title: string; subtitle: string; children: ReactNode; back?: boolean }) {
  const inst = await getInstitution();
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex items-center gap-2.5">
          {inst.logoType
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/brand/logo" alt="" className="size-10 rounded-[var(--radius-control)] bg-white object-contain p-0.5 ring-1 ring-line" />
            : <BrandMark size={40} />}
          <span className="text-base font-semibold">{inst.shortName}</span>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-6 shadow-lift sm:p-7">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 mb-5 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
        {back && <p className="mt-4 text-center text-sm"><Link href="/login" className="text-brand hover:underline">← Back to sign in</Link></p>}
      </div>
    </div>
  );
}
