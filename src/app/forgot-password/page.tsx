import { AuthCard } from "@/components/auth-card";
import { ForgotForm } from "./form";

export const metadata = { title: "Forgot password" };
// Reads the college name from the database, so it is rendered per request rather than at build time.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your college email and we'll send a link to choose a new one.">
      <ForgotForm />
    </AuthCard>
  );
}
