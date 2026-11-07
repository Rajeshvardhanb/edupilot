import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./ui";

/** The welcome panel at the top of a dashboard: date, greeting, context, term progress and the day's main actions, with a photo on the right. */
export function Hero({ eyebrow, title, subtitle, children, art, image, imagePosition = "right center", className, phoneLine, progress, phone, phoneAfter }: {
  eyebrow?: string; title: string; subtitle?: ReactNode; children?: ReactNode; art?: ReactNode; className?: string;
  /** Photo URL from lib/images, shown on the right and fading into the panel. */
  image?: string | null;
  /** Which part of the photo stays in view when it is cropped to its frame. */
  imagePosition?: string;
  /** Phones: the small line over the greeting (e.g. "Tue 20 Oct · Week 15 of 23") and the term progress bar. */
  phoneLine?: string; progress?: number;
  /** Phones: show this instead of the banner (a role whose phone home starts differently); `false` shows nothing. */
  phone?: ReactNode | false;
  /** Phones: shown just under the photo card (e.g. the class happening now). */
  phoneAfter?: ReactNode;
}) {
  return (
    <>
      {/* Phone (after the banner in the page, so text searches find the visible copy first): the photo fills the
          card and the greeting sits on it; the bottom bar carries the actions. */}
    <section className={cn("relative mb-6 animate-fade-up overflow-hidden rounded-[var(--radius-panel)] border border-[#e4e3f6] bg-gradient-to-br from-[#f7f6ff] via-white to-[#fbf5ff] shadow-card", (image || phone !== undefined) && "hidden sm:block", className)}>
      <span aria-hidden className="pointer-events-none absolute top-0 left-[38%] size-64 -translate-y-1/2 rounded-full bg-[#c4b5fd]/30 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgb(139_92_246/0.12)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(90deg,black,transparent_70%)]" />
      {image && (
        <div className="absolute inset-y-0 right-0 hidden w-[42%] md:block [mask-image:linear-gradient(90deg,transparent,black_30%)]">
          <Image src={image} alt="" fill preload sizes="(min-width: 1024px) 480px, 42vw" className="object-cover" style={{ objectPosition: imagePosition }} />
        </div>
      )}
      <div className="relative flex items-center p-5 sm:p-7">
        <div className={cn("min-w-0 flex-1", image && "md:max-w-[60%]")}>
          {eyebrow && <p className="text-xs font-semibold text-brand">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl leading-tight font-bold tracking-tight sm:text-[1.85rem]">{title}</h1>
          {subtitle && <div className="mt-1 max-w-2xl text-sm text-fg-2">{subtitle}</div>}
          {children && <div className="mt-4">{children}</div>}
        </div>
        {!image && art && <div className="hidden w-56 shrink-0 md:block">{art}</div>}
      </div>
    </section>
      {phone && <div className="mb-4 sm:hidden">{phone}</div>}
      {image && phone === undefined && (
        <section className="relative mb-4 h-48 animate-fade-up overflow-hidden rounded-[var(--radius-panel)] shadow-card sm:hidden">
          <Image src={image} alt="" fill preload sizes="100vw" className="object-cover" style={{ objectPosition: imagePosition }} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#1e1b4b]/90 via-[#312e81]/35 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 text-white">
            {(phoneLine ?? eyebrow) && <p className="text-xs text-white/85">{phoneLine ?? eyebrow}</p>}
            <p className="mt-0.5 text-[1.4rem] leading-tight font-bold">{title}</p>
            {progress !== undefined && (
              <div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} /></div><span className="text-[11px] tabular-nums text-white/85">{progress}%</span></div>
            )}
          </div>
        </section>
      )}
      {phoneAfter && <div className="mb-4 sm:hidden">{phoneAfter}</div>}
    </>
  );
}

export function HeroAction({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return <Link href={href} className={buttonClass(primary ? "primary" : "secondary")}>{children}</Link>;
}

export function TermProgress({ week, weeks, percent }: { week: number; weeks: number; percent: number }) {
  return (
    <div className="flex w-full max-w-md min-w-56 flex-1 items-center gap-3 text-xs text-muted">
      <span className="shrink-0">Week {week} of {weeks}</span>
      <div className="h-1.5 flex-1 rounded-full bg-[#e7e5f7]"><div className="brand-gradient h-full rounded-full" style={{ width: `${percent}%` }} /></div>
      <span className="shrink-0 tabular-nums">{percent}% of term complete</span>
    </div>
  );
}

/** Photo banner at the top of a module page, with the page's heading and main action over a tinted veil. */
export function PhotoBanner({ image, imagePosition = "center", eyebrow, title, subtitle, actions, tint = "#3b2a8f" }: {
  image: string | null; imagePosition?: string;
  eyebrow?: string; title?: string; subtitle?: ReactNode; actions?: ReactNode;
  /** The veil's colour (from the left, where the text sits). */
  tint?: string;
}) {
  if (!image && !title) return null;
  return (
    // Phones already show the page name in the top bar, so the banner is for larger screens.
    <div className="relative mb-6 hidden animate-fade-up overflow-hidden rounded-[var(--radius-panel)] shadow-card sm:block" style={{ background: tint }}>
      {image && <Image src={image} alt="" fill preload sizes="(min-width: 1280px) 1150px, 100vw" className="object-cover" style={{ objectPosition: imagePosition }} />}
      <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${tint} 88%, transparent) 0%, color-mix(in oklab, ${tint} 55%, transparent) 50%, color-mix(in oklab, ${tint} 10%, transparent) 100%)` }} />
      <div className="relative flex min-h-36 flex-wrap items-end justify-between gap-4 p-5 text-white sm:min-h-40 sm:p-7">
        {title && (
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold text-white/85">{eyebrow}</p>}
            <h1 className="mt-1 text-2xl leading-tight font-bold tracking-tight text-white sm:text-[1.85rem]">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-white/85">{subtitle}</div>}
          </div>
        )}
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
