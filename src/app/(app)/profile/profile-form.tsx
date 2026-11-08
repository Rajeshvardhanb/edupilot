"use client";
import { updateMyProfile } from "@/actions/profile";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";

export function ProfileForm({ defaults, student }: { defaults: Record<string, string>; student: boolean }) {
  const input = (name: string, label: string, type = "text", required = false) => (
    <Field key={name} name={`profile-${name}`} label={label}>
      <input id={`profile-${name}`} name={name} type={type} defaultValue={defaults[name] ?? ""} required={required} className="input" maxLength={name === "address" ? 1000 : name === "skills" ? 500 : 190} {...(name === "dob" ? { max: new Date().toISOString().slice(0, 10) } : {})} autoComplete={name === "currentPassword" ? "current-password" : undefined} />
    </Field>
  );
  return <ActionForm action={updateMyProfile} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      {input("name", "Full name", "text", true)}
      {input("email", "Login email", "email", true)}
      {input("phone", "Phone number", "tel")}
      {input("currentPassword", "Current password (for email changes)", "password")}
      {student && <>
        {input("dob", "Date of birth", "date")}
        <Field label="Gender" name="profile-gender"><select id="profile-gender" name="gender" className="input" defaultValue={defaults.gender}><option value="">Not specified</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></Field>
        {input("bloodGroup", "Blood group")}
        {input("address", "Address")}
        {input("guardianName", "Guardian name")}
        {input("guardianPhone", "Guardian phone", "tel")}
        {input("guardianEmail", "Guardian email", "email")}
        {input("skills", "Skills")}
        {input("linkedin", "LinkedIn URL", "url")}
        {input("github", "GitHub URL", "url")}
        <Field label="About me" name="profile-about" className="sm:col-span-2"><textarea id="profile-about" name="about" defaultValue={defaults.about} maxLength={1500} className="input" rows={3} /></Field>
      </>}
    </div>
    {student && <p className="text-xs text-muted">Your administrator manages your roll number, batch, admission and academic status.</p>}
    <SubmitButton>Save profile</SubmitButton>
  </ActionForm>;
}
