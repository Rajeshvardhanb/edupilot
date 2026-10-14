import { requireUser } from "@/lib/auth";
import { batchOptions } from "@/lib/options";
import { Card, PageHeader } from "@/components/ui-server";
import { isoDate } from "@/lib/format";
import { ImportForm } from "./import-form";

export const metadata = { title: "Bulk import students" };

export default async function ImportPage() {
  const user = await requireUser(["ADMIN", "OFFICE"]);
  return (
    <>
      <PageHeader title="Bulk import students" subtitle="Upload a CSV exported from the admissions / counselling portal." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><ImportForm batches={await batchOptions(user)} today={isoDate(new Date())} /></Card>
        <Card title="CSV format">
          <p className="text-sm text-muted">First row must be a header. Required columns: <code>rollNo</code>, <code>name</code>, <code>email</code>.</p>
          <pre tabIndex={0} className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{`rollNo,name,email,phone,gender,dob,category,admissionType,guardianName,guardianPhone
26BTCSE001,Asha Rao,asha@example.com,9876543210,FEMALE,2008-04-12,OBC,REGULAR,Mohan Rao,9876500000
26BTCSE301,Kiran Kumar,kiran@example.com,,MALE,2006-01-30,GENERAL,LATERAL,,`}</pre>
          <p className="mt-3 text-xs text-muted">Lateral entry students automatically start from semester 3. Rows with duplicate roll numbers or emails are skipped and reported.</p>
        </Card>
      </div>
    </>
  );
}
