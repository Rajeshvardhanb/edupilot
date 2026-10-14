import { requireUser } from "@/lib/auth";
import { IdCard } from "@/components/id-card";
import { PageHeader } from "@/components/ui-server";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "ID card" };

export default async function MyIdCard() {
  const user = await requireUser(["STUDENT"]);
  return (
    <>
      <PageHeader title="My ID card" subtitle="Show this at the gate, library and exam hall. Update your photo under My Profile." actions={<PrintButton />} />
      <IdCard studentId={user.studentId!} />
    </>
  );
}
