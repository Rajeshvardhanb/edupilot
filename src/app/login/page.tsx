import { photo } from "@/lib/images";
import { BrandMark } from "@/components/brand-mark";
import Image from "next/image";
import { Suspense } from "react";
import { ClipboardCheck, Award, Wallet, Briefcase, ShieldCheck } from "lucide-react";
import { CampusIllustration } from "@/components/illustrations";
import { LoginForm } from "./login-form";
import { getInstitution } from "@/lib/institution";

export const metadata = { title: "Sign in" };
// Shows the college name and logo from the database, so it is rendered per request, not at build time.
export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: ClipboardCheck, title: "Smart attendance", text: "Period-wise, 75% alerts" },
  { icon: Award, title: "Results & CGPA", text: "Auto SGPA, backlogs" },
  { icon: Wallet, title: "Fee management", text: "Receipts, dues, ledger" },
  { icon: Briefcase, title: "Placements", text: "Eligibility built-in" },
];

export default async function LoginPage(props: PageProps<"/login">) {
  const inst = await getInstitution();
  const logo = inst.logoType
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src="/brand/logo" alt="" className="size-11 rounded-2xl bg-white object-contain p-1" />
    : <BrandMark size={48} tile className="!rounded-2xl" />;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="brand-gradient relative hidden flex-col overflow-hidden p-10 text-white lg:flex xl:p-14">
        <div aria-hidden className="absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute bottom-0 -left-20 size-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          {logo}
          <div><p className="text-lg font-semibold">{inst.name}</p><p className="text-xs text-white/70">{inst.tagline}</p></div>
        </div>
        <div className="relative mt-12">
          <h1 className="max-w-lg text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">Your whole campus, beautifully organised.</h1>
          <p className="mt-4 max-w-md text-white/80">Admissions to placements: one secure place for students, faculty, HODs, accounts and administration.</p>
        </div>
        {photo("login")
          ? <div className="relative my-8 aspect-[16/10] w-full max-w-xl self-center overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/30"><Image src={photo("login")!} alt="" fill preload sizes="(min-width: 1024px) 576px, 100vw" className="object-cover" /></div>
          : <CampusIllustration className="relative my-8 w-full max-w-xl self-center drop-shadow-2xl" />}
        <div className="relative mt-auto grid grid-cols-2 gap-3 xl:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
              <Icon className="size-5" />
              <p className="mt-2 text-sm font-semibold">{title}</p>
              <p className="text-xs text-white/70">{text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <BrandMark size={44} />
            <span className="text-lg font-semibold">{inst.shortName}</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 mb-8 text-sm text-muted">Sign in with your college email to continue.</p>
          <Suspense>
            <LoginForm searchParams={props.searchParams} />
          </Suspense>
          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5" /> Encrypted sessions · role-based access · audit trail</p>
        </div>
      </div>
    </div>
  );
}
