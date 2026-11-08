import { logout } from "@/actions/auth";
import { Avatar } from "@/components/avatar";
import { ROLE_LABEL } from "@/components/nav";
import { PhotoUpload } from "@/components/photo-upload";
import { TextSizeToggle } from "@/components/theme";
import { buttonClass } from "@/components/ui";
import { Card,PageHeader } from "@/components/ui-server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";
import { TwoStep } from "./two-step";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, include: { faculty: { include: { department: true } }, student: true } });
  const rows: [string, string][] = [
    ["Name", user.name], ["Email", user.email], ["Phone", user.phone ?? "—"], ["Role", ROLE_LABEL[user.role]],
    ...(user.faculty ? [["Employee ID", user.faculty.employeeId], ["Department", user.faculty.department.name], ["Designation", user.faculty.designation]] as [string, string][] : []),
    ...(user.student ? [["Roll no", user.student.rollNo]] as [string, string][] : []),
    ["Last login", user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "—"],
  ];
  return (
    <>
      <PageHeader title="My profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <div className="mb-5 border-b border-line pb-5"><PhotoUpload userId={user.id} current={<Avatar name={user.name} userId={user.id} hasPhoto={!!user.photoType} size={80} />} /></div>
          <dl className="divide-y divide-line text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {user.student && <Link href={`/students/${user.student.id}`} className="mt-4 inline-block text-sm text-brand">View full student record →</Link>}
        </Card>
        <Card title="Edit my details">
          <div id="edit-profile"><ProfileForm student={user.role === "STUDENT"} defaults={{
            name: user.name, email: user.email, phone: user.phone ?? "",
            dob: user.student?.dob?.toISOString().slice(0, 10) ?? "", gender: user.student?.gender ?? "",
            ...Object.fromEntries(["bloodGroup", "address", "guardianName", "guardianPhone", "guardianEmail", "about", "skills", "linkedin", "github"].map(key => [key, (user.student as unknown as Record<string, string | null> | null)?.[key] ?? ""])),
          }} /></div>
        </Card>
        <Card title="Display">
          <TextSizeToggle />
          <form action={logout} className="mt-5"><button className={buttonClass("secondary")}><LogOut /> Sign out</button></form>
        </Card>
        <Card title="Change password">
          <PasswordForm />
        </Card>
        {user.role !== "STUDENT" && user.role !== "PARENT" && (
          <Card title="Two-step sign-in">
            <TwoStep on={user.twoStep} email={user.email} />
          </Card>
        )}
      </div>
    </>
  );
}
