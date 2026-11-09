"use client";
import { useState } from "react";
import { updateMyProfile, requestProfileCode } from "@/actions/profile";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, buttonClass } from "@/components/ui";

export function ProfileForm({ defaults, student }: { defaults: Record<string, string>; student: boolean }) {
  const [codes, setCodes] = useState({ challengeId: "", newEmailChallengeId: "" });
  const input = (name: string, label: string, type = "text", required = false) => (
    <Field key={name} name={`profile-${name}`} label={label}>
      <input id={`profile-${name}`} name={name} type={type} defaultValue={defaults[name] ?? ""} required={required} className="input" maxLength={name === "address" ? 1000 : name === "skills" ? 500 : 190} {...(name === "dob" ? { max: new Date().toISOString().slice(0, 10) } : {})} autoComplete={name === "currentPassword" ? "current-password" : undefined} />
    </Field>
  );
  return <ActionForm action={(state, form) => form.get("intent") === "verify" ? requestProfileCode(state, form) : updateMyProfile(state, form)} className="space-y-5" onResult={s => { if (s.challengeId) setCodes({ challengeId: s.challengeId, newEmailChallengeId: s.newEmailChallengeId ?? "" }); }}>
    <input type="hidden" name="challengeId" value={codes.challengeId} /><input type="hidden" name="newEmailChallengeId" value={codes.newEmailChallengeId} />
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
    <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-3">
      <p className="text-sm">Name, email, phone and personal/guardian changes require an email OTP. Biography, skills and links can be saved directly.</p>
      <p className="text-xs text-muted">Using a demo username? Change Login email to your working email and enter your current password first. Your new email becomes your login username after verification.</p>
      <button type="submit" name="intent" value="verify" className={buttonClass("secondary")}>{codes.challengeId ? "Request new verification code" : "Send verification code"}</button>
      {codes.challengeId && <>{input("verificationCode", "Email verification code")}{codes.newEmailChallengeId && input("newEmailCode", "Code sent to the new email")}</>}
    </div>
    <SubmitButton>Save profile</SubmitButton>
  </ActionForm>;
}
