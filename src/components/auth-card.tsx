import { BrandMark } from "@/components/brand-mark";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { photo } from "@/lib/images";
import { getInstitution } from "@/lib/institution";

/** Centered card used by the sign-in helper pages (forgot / reset / first-login password). */
export async function AuthCard({ title, subtitle, children, back = true }: { title: string; subtitle: string; children: ReactNode; back?: boolean }) {
  const inst = await getInstitution();
  const bg = photo("login");
  return (
    <div className="relative grid min-h-screen place-items-center p-6">
      {bg && <Image src={bg} alt="" fill sizes="100vw" className="object-cover" />}
      {bg && <div aria-hidden className="absolute inset-0 bg-bg/85 backdrop-blur-sm" />}
      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark size={44} />
          <span className="text-lg font-semibold">{inst.shortName}</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 mb-5 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
        {back && <p className="mt-4 text-center text-sm"><Link href="/login" className="text-brand">← Back to sign in</Link></p>}
      </div>
    </div>
  );
}
