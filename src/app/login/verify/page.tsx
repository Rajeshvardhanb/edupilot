import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { pendingLogin } from "@/actions/auth";
import { VerifyForm } from "./form";

export const metadata = { title: "Enter your sign-in code" };
export const dynamic = "force-dynamic";

/** Second step of sign-in for accounts with two-step turned on. */
export default async function VerifyPage(props: PageProps<"/login/verify">) {
  const pending = await pendingLogin();
  if (!pending) redirect("/login");
  const sp = await props.searchParams;
  return (
    <AuthCard title="Enter your sign-in code" subtitle={`We emailed a six-digit code to ${pending.maskedEmail}. It expires in 10 minutes.`}>
      {pending.devCode && <p className="mb-4 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">No mail server is configured, so here is the code for testing: <b className="font-mono text-sm">{pending.devCode}</b></p>}
      <VerifyForm next={typeof sp.next === "string" ? sp.next : ""} />
    </AuthCard>
  );
}
