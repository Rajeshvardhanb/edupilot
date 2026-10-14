import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthCard } from "@/components/auth-card";
import { ForcedPasswordForm } from "./form";

export const metadata = { title: "Set your password" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/session/expired");
  if (!user.mustChangePassword) redirect("/profile");
  return (
    <AuthCard title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="You signed in with a temporary password. Choose your own to continue." back={false}>
      <ForcedPasswordForm />
    </AuthCard>
  );
}
