import { AuthCard } from "@/components/auth-card";
import { ResetForm } from "./form";

export const metadata = { title: "Choose a new password" };
// Shows the college name and logo from the database, so it is rendered per request, not at build time.
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  return (
    <AuthCard title="Choose a new password" subtitle="This link works once and expires 30 minutes after it was requested.">
      <ResetForm token={typeof token === "string" ? token : ""} />
    </AuthCard>
  );
}
