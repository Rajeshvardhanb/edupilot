import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./ui";

/** The welcome panel at the top of a dashboard: greeting, context, term progress and the day's main actions. */
export function Hero({ eyebrow, title, subtitle, children, art, image, imagePosition = "right center", className }: {
  eyebrow?: string; title: string; subtitle?: ReactNode; children?: ReactNode; art?: ReactNode; className?: string;
  /** Photo URL from lib/images, shown beside the text on wider screens. */
  image?: string | null;
  /** Which part of the photo stays in view when it is cropped to its frame. */
  imagePosition?: string;
}) {
  return (
    <section className={cn("tile mb-6 animate-fade-up overflow-hidden", className)}>
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 p-5 sm:p-6">
          {eyebrow && <p className="text-xs text-muted">{eyebrow}</p>}
          <h1 className="mt-1 text-xl leading-tight font-semibold sm:text-2xl">{title}</h1>
          {subtitle && <div className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</div>}
          {children && <div className="mt-5">{children}</div>}
        </div>
        {image ? (
          <div className="relative hidden w-[min(34%,22rem)] shrink-0 border-l border-line md:block">
            <Image src={image} alt="" fill preload sizes="(min-width: 1024px) 352px, 34vw" className="object-cover" style={{ objectPosition: imagePosition }} />
          </div>
        ) : art ? <div className="hidden w-56 shrink-0 self-center p-4 md:block">{art}</div> : null}
      </div>
    </section>
  );
}

export function HeroAction({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={buttonClass("secondary")}>{children}</Link>;
}

export function TermProgress({ week, weeks, percent }: { week: number; weeks: number; percent: number }) {
  return (
    <div className="w-full max-w-sm min-w-56 flex-1">
      <div className="mb-1.5 flex justify-between gap-3 text-xs text-muted"><span>Week {week} of {weeks}</span><span className="tabular-nums">{percent}% of term complete</span></div>
      <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

/** Photo strip above a module page's heading, on wider screens only. Renders nothing until the photo exists. */
export function PhotoBanner({ image, imagePosition = "center" }: { image: string | null; imagePosition?: string }) {
  if (!image) return null;
  return (
    <div className="no-print relative mb-6 hidden h-28 overflow-hidden rounded-[var(--radius-card)] border border-line sm:block lg:h-32">
      <Image src={image} alt="" fill preload sizes="(min-width: 1280px) 1150px, 100vw" className="object-cover" style={{ objectPosition: imagePosition }} />
    </div>
  );
}
