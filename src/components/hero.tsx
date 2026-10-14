import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Gradient welcome banner with an illustration and quick actions. */
export function Hero({ eyebrow, title, subtitle, children, art, image, imagePosition = "right center", className }: {
  eyebrow?: string; title: string; subtitle?: ReactNode; children?: ReactNode; art?: ReactNode; className?: string;
  /** Photo URL from lib/images. When present it replaces the illustration. */
  image?: string | null;
  /** Which part of the photo stays in view when it is cropped to the banner's shape. */
  imagePosition?: string;
}) {
  return (
    <section className={cn("brand-gradient relative mb-6 animate-fade-up overflow-hidden rounded-[28px] p-6 text-white shadow-lift ring-1 ring-white/10 ring-inset sm:p-9", className)}>
      {image && (
        <>
          <Image src={image} alt="" fill preload sizes="(min-width: 1280px) 1150px, 100vw" className="object-cover" style={{ objectPosition: imagePosition }} />
          {/* Brand-coloured veil: solid under the text, clearing towards the photo's subject on the right. */}
          <div aria-hidden className="absolute inset-0 hidden md:block" style={{ background: "linear-gradient(90deg, var(--brand-start, #1668f5) 0%, color-mix(in oklab, var(--brand-end, #4a28e6) 90%, transparent) 36%, color-mix(in oklab, var(--brand-end, #4a28e6) 30%, transparent) 62%, transparent 85%)" }} />
          {/* On phones the text covers the whole card, so the veil does too. */}
          <div aria-hidden className="absolute inset-0 md:hidden" style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--brand-start, #1668f5) 92%, transparent) 0%, color-mix(in oklab, var(--brand-end, #4a28e6) 78%, transparent) 100%)" }} />
        </>
      )}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-medium tracking-wider text-white/75 uppercase">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-2 max-w-2xl text-sm text-white/85">{subtitle}</div>}
          {children && <div className="mt-5">{children}</div>}
        </div>
        {art && !image && <div className="hidden w-72 md:block lg:w-80">{art}</div>}
        {image && <div className="hidden h-44 w-72 md:block lg:w-96" />}
      </div>
    </section>
  );
}

export function HeroAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ring-1 ring-white/25 backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:bg-white/25">
      {children}
    </Link>
  );
}

export function TermProgress({ week, weeks, percent }: { week: number; weeks: number; percent: number }) {
  return (
    <div className="w-full max-w-sm min-w-56 flex-1">
      <div className="mb-1.5 flex justify-between gap-3 text-xs text-white/80"><span>Week {week} of {weeks}</span><span>{percent}% of term complete</span></div>
      <div className="h-2 rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

/** Photo strip above a module page's heading. Renders nothing until the photo exists. */
export function PhotoBanner({ image, imagePosition = "center" }: { image: string | null; imagePosition?: string }) {
  if (!image) return null;
  return (
    <div className="no-print relative mb-6 h-40 animate-fade-up overflow-hidden rounded-[28px] shadow-lift ring-1 ring-black/5 sm:h-52 lg:h-60">
      <Image src={image} alt="" fill preload sizes="(min-width: 1280px) 1150px, 100vw" className="object-cover" style={{ objectPosition: imagePosition }} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" />
    </div>
  );
}
