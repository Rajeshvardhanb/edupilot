import Image from "next/image";

/** Decorative art stays separate from the live, role-scoped dashboard content. */
export function AcademicWelcome({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="academic-welcome relative mb-6 overflow-hidden rounded-[var(--radius-panel)] border border-violet-400/40 px-5 py-6 text-white shadow-card sm:min-h-44 sm:px-7 sm:py-7">
      <div className="relative z-10 sm:max-w-[68%]">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-violet-200 uppercase">Your academic workspace</p>
        <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-[1.85rem]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-violet-100">{subtitle}</p>
      </div>
      <div aria-hidden className="pointer-events-none absolute right-4 bottom-0 hidden h-44 w-[28%] sm:block"><Image src="/images/academic/learning.webp" alt="" fill preload sizes="(min-width: 1280px) 300px, 28vw" className="object-contain" /></div>
    </section>
  );
}
