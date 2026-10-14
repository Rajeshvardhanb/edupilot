import { requireUser } from "@/lib/auth";
import { getInstitution } from "@/lib/institution";
import { saveInstitution } from "@/actions/campus";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Letterhead } from "@/components/letterhead";
import { Field } from "@/components/ui";
import { Card, PageHeader, Tabs } from "@/components/ui-server";
import { ADMIN_TABS } from "../tabs";

export const metadata = { title: "Branding & settings" };

export default async function SettingsPage() {
  await requireUser(["ADMIN"]);
  const i = await getInstitution();
  return (
    <>
      <PageHeader title="Administration" subtitle="Your college's identity and fee rules" />
      <Tabs active="/admin/settings" items={ADMIN_TABS} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="College details">
          <ActionForm action={saveInstitution} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="College name (printed on documents)" name="name" className="sm:col-span-2"><input id="name" name="name" defaultValue={i.name} className="input" required /></Field>
              <Field label="Short name (sidebar, app name)" name="shortName"><input id="shortName" name="shortName" defaultValue={i.shortName} className="input" required /></Field>
              <Field label="Tagline" name="tagline"><input id="tagline" name="tagline" defaultValue={i.tagline} className="input" /></Field>
              <Field label="Approval / affiliation line" name="affiliation" className="sm:col-span-2"><input id="affiliation" name="affiliation" defaultValue={i.affiliation} className="input" /></Field>
              <Field label="Address" name="address" className="sm:col-span-2"><input id="address" name="address" defaultValue={i.address} className="input" /></Field>
              <Field label="Phone" name="phone"><input id="phone" name="phone" defaultValue={i.phone} className="input" /></Field>
              <Field label="Email" name="email"><input id="email" name="email" defaultValue={i.email} className="input" /></Field>
              <Field label="Principal's name (signs certificates)" name="principalName"><input id="principalName" name="principalName" defaultValue={i.principalName} className="input" /></Field>
              <Field label="Brand colour" name="brandColor"><input id="brandColor" name="brandColor" type="color" defaultValue={i.brandColor} className="h-10 w-24 cursor-pointer rounded-lg border border-line bg-surface p-1" /></Field>
              <Field label="Logo (PNG, JPEG or WebP, up to 500 KB)" name="logo" className="sm:col-span-2">
                <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="input text-xs" />
                {i.logoType && <label className="mt-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="removeLogo" /> Remove the current logo</label>}
              </Field>
            </div>
            <fieldset className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <legend className="mb-3 text-sm font-semibold">Fee rules</legend>
              <Field label="Late fine per day (₹)" name="lateFinePerDay"><input id="lateFinePerDay" name="lateFinePerDay" type="number" min={0} defaultValue={i.lateFinePerDay} className="input" /></Field>
              <Field label="Maximum late fine (₹, 0 = no cap)" name="lateFineMax"><input id="lateFineMax" name="lateFineMax" type="number" min={0} defaultValue={i.lateFineMax} className="input" /></Field>
              <Field label="Supplementary fee per subject (₹)" name="supplementaryFee"><input id="supplementaryFee" name="supplementaryFee" type="number" min={0} defaultValue={i.supplementaryFee} className="input" /></Field>
            </fieldset>
            <SubmitButton>Save settings</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Document header preview" className="h-fit">
          <Letterhead title="Fee receipt" serial="RCPT-0001" />
          <p className="mt-4 text-xs text-muted">This header appears on fee receipts, hall tickets, certificates and grade cards. The brand colour applies across the app.</p>
        </Card>
      </div>
    </>
  );
}
