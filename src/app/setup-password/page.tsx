import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { setupInformation } from "@/actions/account-setup";
import { SetupForm } from "./setup-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your password" };
export default async function SetupPasswordPage(props: PageProps<"/setup-password">) {
  const { token } = await props.searchParams;
  const value = typeof token === "string" ? token : "";
  const info = await setupInformation(value);
  return <AuthCard title="Set up your password" subtitle="Verify your email, choose a password, then sign in.">
    {info ? <><p className="mb-5 rounded-xl bg-brand-soft p-4 text-sm">Your login username: <strong className="break-all">{info.username}</strong></p><SetupForm token={value} /></> : <p>This invitation is expired, invalid or already used. Ask the administrator or office staff to resend your setup email. <Link href="/login" className="text-brand">Back to sign in</Link></p>}
  </AuthCard>;
}
