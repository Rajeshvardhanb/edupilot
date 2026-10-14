import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Field } from "@/components/ui";
import { Card, PageHeader } from "@/components/ui-server";
import { PasswordForm } from "./password-form";
import { TwoStep } from "./two-step";
import { ReplayTourButton } from "@/components/tour";
import { PhotoUpload } from "@/components/photo-upload";
import { Avatar } from "@/components/avatar";
import { ROLE_LABEL } from "@/components/nav";
import { fmtDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ALERT_KINDS } from "@/lib/notify";
import { saveNotificationPrefs } from "@/actions/prefs";
import { PROFILE_FIELDS, type ProfileField } from "@/lib/profile-fields";
import { requestProfileChange } from "@/actions/office";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, include: { faculty: { include: { department: true } }, student: true } });
  const corrections = me.studentId ? await db.profileChange.findMany({ where: { studentId: me.studentId }, orderBy: { createdAt: "desc" }, take: 5 }) : [];
  const muted = ((user.prefs as { mutedEmail?: string[] } | null)?.mutedEmail) ?? [];
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
        <Card title="Help">
          <p className="mb-3 text-sm text-muted">New here, or want a refresher? The guided tour points out search, the menu, notifications and your account.</p>
          <ReplayTourButton />
          <p className="mt-4 text-xs text-muted">Language and text size can be changed from the menu at the top right. On a phone, add this site to your home screen to use it like an app.</p>
        </Card>
        {(user.role === "STUDENT" || user.role === "PARENT") && me.studentId && (
          <Card title="Request a correction">
            <p className="mb-3 text-sm text-muted">If a contact detail on the college record is wrong, ask the office to correct it. The record changes once they approve.</p>
            {corrections.length > 0 && <ul className="mb-4 space-y-1.5 text-sm">{corrections.map((c) => <li key={c.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{PROFILE_FIELDS[c.field as ProfileField] ?? c.field}: <b>{c.newValue}</b></span><Badge tone={c.status === "APPROVED" ? "success" : c.status === "REJECTED" ? "danger" : "warning"}>{c.status === "APPROVED" ? "Applied" : c.status === "REJECTED" ? "Rejected" : "Waiting"}</Badge></li>)}</ul>}
            <ActionForm action={requestProfileChange} className="space-y-3" resetOnSuccess>
              <Field label="What is wrong" name="field"><select name="field" className="input">{Object.entries(PROFILE_FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="What it should be" name="newValue"><input name="newValue" className="input" required /></Field>
              <SubmitButton variant="secondary">Send to the office</SubmitButton>
            </ActionForm>
          </Card>
        )}
        <Card title="Notification preferences">
          <p className="mb-3 text-sm text-muted">Every alert appears under the bell. Tick the kinds you also want by email at {user.email}.</p>
          <ActionForm action={saveNotificationPrefs} className="space-y-2" toastSuccess>
            {Object.entries(ALERT_KINDS).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-2"><input type="checkbox" name="email" value={k} defaultChecked={!muted.includes(k)} className="size-4 accent-[var(--brand)]" /> {label}</label>
            ))}
            <div className="pt-2"><SubmitButton variant="secondary">Save preferences</SubmitButton></div>
            <p className="text-xs text-muted">Password resets and sign-in codes are always emailed.</p>
          </ActionForm>
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
