import { BrandMark, Wordmark } from "@/components/brand-mark";
import Image from "next/image";
import { Award, Briefcase, ClipboardCheck, Sparkles, TrendingUp, Wallet, CheckCircle2 } from "lucide-react";
import { getInstitution } from "@/lib/institution";
import { photo } from "@/lib/images";

const FEATURES = [
  { icon: ClipboardCheck, title: "Attendance", text: "Period-wise, with shortage alerts", chip: "chip-info" },
  { icon: Award, title: "Results", text: "SGPA, CGPA and grade cards", chip: "chip-violet" },
  { icon: Wallet, title: "Fees", text: "Receipts, dues and day book", chip: "chip-success" },
  { icon: Briefcase, title: "Placements", text: "Drives with built-in eligibility", chip: "chip-warning" },
];

/** The marketing half shared by the sign-in and forgot-password pages. */
export async function CampusPanel({ withPhoto = true }: { withPhoto?: boolean }) {
  const inst = await getInstitution();
  const img = withPhoto ? photo("hero-admin") ?? photo("login") : null;
  return (
    <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#eef0ff] via-[#f7f3ff] to-[#eefcff] p-10 lg:block xl:p-12">
      <span aria-hidden className="pointer-events-none absolute -top-24 right-10 size-80 rounded-full bg-[#c4b5fd]/40 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgb(139_92_246/0.12)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <BrandMark size={34} /><Wordmark className="text-xl" />
          <span aria-hidden className="mx-1 h-6 w-px bg-line-strong" />
          {inst.logoType
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/brand/logo" alt="" className="size-7 rounded-full bg-white object-contain ring-1 ring-line" />
            : null}
          <span className="text-sm text-fg-2">{inst.shortName} · demo data</span>
        </div>
        <p className="mt-10 inline-flex items-center gap-2 rounded-full border border-[#e0dcfb] bg-white px-3.5 py-1.5 text-xs font-semibold text-brand shadow-xs">
          <Sparkles className="size-3.5" /> College management, all in one place
        </p>
        <h1 className="mt-4 max-w-lg text-[2.6rem] leading-[1.08] font-extrabold tracking-tight xl:text-5xl">
          Run your whole campus from <span className="brand-text">one screen.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-fg-2">
          Admissions to placements for students, parents, teachers, heads of department, accounts and the office — each with exactly what they need.
        </p>

        {img && (
          <div className="relative mt-8 mr-10 ml-6 max-w-[34rem]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-panel)] shadow-lift">
              <Image src={img} alt="" fill preload sizes="(min-width: 1024px) 540px, 0px" className="object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#1e1b4b]/70 via-transparent to-transparent" />
              <p className="absolute right-4 bottom-3 max-w-[60%] text-right text-xs leading-snug font-semibold text-white">{inst.name}{inst.address && <span className="block font-normal text-white/80">{inst.address}</span>}</p>
            </div>
            <div className="absolute -top-6 -left-8 w-52 rounded-xl border border-line bg-white p-3.5 shadow-lift">
              <p className="flex items-center gap-2 text-xs text-fg-2"><span className="chip-soft chip-success size-6"><ClipboardCheck className="size-3.5" /></span>Attendance this term</p>
              <p className="mt-2 flex items-end gap-2"><span className="text-2xl font-bold tabular-nums">88.1%</span><span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-success-soft px-1.5 text-[10px] font-semibold text-success"><TrendingUp className="size-3" /> 2.4 pts</span></p>
              <svg viewBox="0 0 180 34" className="mt-1 h-8 w-full" aria-hidden>
                <path d="M0 26 L20 24 L40 25 L60 20 L80 22 L100 15 L120 17 L140 10 L160 12 L180 6 L180 34 L0 34Z" fill="#10b981" opacity=".12" />
                <path d="M0 26 L20 24 L40 25 L60 20 L80 22 L100 15 L120 17 L140 10 L160 12 L180 6" fill="none" stroke="#10b981" strokeWidth="2" />
              </svg>
            </div>
            <div className="absolute top-10 -right-10 w-48 rounded-xl border border-line bg-white p-3.5 shadow-lift">
              <p className="flex items-center gap-2 text-xs text-fg-2"><span className="chip-soft chip-info size-6"><Wallet className="size-3.5" /></span>Fees collected</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">67%</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-[#eceef6]"><div className="h-full w-[67%] rounded-full bg-gradient-to-r from-sky-400 to-sky-600" /></div>
              <p className="mt-1.5 text-[11px] text-muted">of this year&apos;s demand</p>
            </div>
            <div className="absolute -bottom-5 left-4 flex w-60 items-center gap-2.5 rounded-xl border border-line bg-white p-3 shadow-lift">
              <span className="chip chip-violet size-8"><CheckCircle2 className="size-4" /></span>
              <span className="min-w-0"><span className="block text-[13px] font-semibold">Result published</span><span className="block text-[11px] text-muted">Students and parents notified instantly</span></span>
            </div>
          </div>
        )}

        <ul className="mt-14 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4">
          {FEATURES.map(({ icon: Icon, title, text, chip }) => (
            <li key={title} className="flex items-start gap-3">
              <span className={`chip size-9 ${chip}`}><Icon className="size-[18px]" /></span>
              <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{text}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

