import { BrandMark } from "@/components/brand-mark";
import { getInstitution } from "@/lib/institution";
import { Award, CalendarDays, ClipboardCheck, Sparkles } from "lucide-react";
import Image from "next/image";

const FEATURES = [
  { icon: ClipboardCheck, title: "Attendance", color: "bg-sky-400/20 text-sky-100" },
  { icon: Award, title: "Marks & results", color: "bg-fuchsia-400/20 text-fuchsia-100" },
  { icon: CalendarDays, title: "Academic planning", color: "bg-emerald-400/20 text-emerald-100" },
];

/** Shared academic welcome panel for sign-in and account-recovery screens. */
export async function CampusPanel({ withPhoto = true }: { withPhoto?: boolean }) {
  const inst = await getInstitution();
  return (
    <section className="auth-campus relative hidden min-h-screen flex-col overflow-hidden p-10 text-white lg:flex xl:p-12">
      <div aria-hidden className="absolute -top-24 -right-32 size-[30rem] rounded-full border-[64px] border-white/5" />
      <div aria-hidden className="absolute -bottom-44 -left-32 size-[32rem] rounded-full bg-fuchsia-400/15" />
      <div className="relative flex items-center gap-3">
        <BrandMark size={44} />
        <div><p className="text-xl font-bold tracking-tight">{inst.shortName}</p><p className="text-xs text-violet-200">Student Management System</p></div>
      </div>
      <div className="relative my-auto pt-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-violet-100"><Sparkles className="size-3.5" /> Your academic journey, connected</p>
        <h1 className="mt-5 max-w-lg text-4xl leading-[1.12] font-extrabold tracking-tight xl:text-5xl">Learn. Manage.<br /><span className="text-violet-200">Achieve more.</span></h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-violet-100">One place for student records, attendance, examinations and everything that keeps learning moving.</p>
        {withPhoto && <div className="relative mx-auto mt-1 h-64 w-full max-w-sm xl:h-72">
          <div aria-hidden className="absolute inset-x-10 bottom-8 h-12 rounded-full bg-fuchsia-300/25 blur-2xl" />
          <Image src="/images/academic/graduation.webp" alt="" fill preload sizes="(min-width: 1280px) 360px, 320px" className="object-contain drop-shadow-2xl" />
        </div>}
        <ul className="mt-4 flex flex-wrap gap-2">
          {FEATURES.map(({ icon: Icon, title, color }) => <li key={title} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium"><span className={`grid size-6 place-items-center rounded-lg ${color}`}><Icon className="size-3.5" /></span>{title}</li>)}
        </ul>
      </div>
      <p className="relative mt-8 max-w-md text-xs leading-relaxed text-violet-200">{inst.name}<span className="mt-1 block text-violet-200/75">{inst.address}</span></p>
    </section>
  );
}
