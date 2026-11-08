"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Defaults = Partial<Record<string, string | number | null | undefined>>;

export function StudentForm({ action, batches, defaults = {}, submitLabel }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  batches: { id: string; label: string }[];
  defaults?: Defaults;
  submitLabel: string;
}) {
  const d = (k: string) => (defaults[k] ?? "") as string;
  return (
    <ActionForm action={action} className="space-y-6">
      {(state) => {
        const e = state.fieldErrors ?? {};
        return (
          <>
            {defaults.id && <input type="hidden" name="id" value={d("id")} />}
            <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <legend className="mb-3 text-sm font-semibold">Personal details</legend>
              <Field label="Full name *" name="name" error={e.name}><input id="name" name="name" defaultValue={d("name")} className="input" required /></Field>
              <Field label="Email *" name="email" error={e.email}><input id="email" name="email" type="email" data-check="email" defaultValue={d("email")} className="input" required /></Field>
              <Field label="Phone" name="phone" error={e.phone}><input id="phone" name="phone" defaultValue={d("phone")} className="input" inputMode="tel" /></Field>
              <Field label="Date of birth" name="dob" error={e.dob}><input id="dob" name="dob" type="date" defaultValue={d("dob")} className="input" /></Field>
              <Field label="Gender" name="gender">
                <select id="gender" name="gender" defaultValue={d("gender")} className="input"><option value="">—</option><option>MALE</option><option>FEMALE</option><option>OTHER</option></select>
              </Field>
              <Field label="Category" name="category">
                <select id="category" name="category" defaultValue={d("category") || "GENERAL"} className="input">{["GENERAL", "OBC", "SC", "ST", "EWS"].map((c) => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="Blood group" name="bloodGroup"><input id="bloodGroup" name="bloodGroup" defaultValue={d("bloodGroup")} className="input" /></Field>
              <Field label="Address" name="address" className="sm:col-span-2"><input id="address" name="address" defaultValue={d("address")} className="input" /></Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <legend className="mb-3 text-sm font-semibold">Admission</legend>
              <Field label="Roll / registration no. *" name="rollNo" error={e.rollNo}><input id="rollNo" name="rollNo" data-check="rollNo" defaultValue={d("rollNo")} className="input font-mono uppercase" required /></Field>
              <Field label="Batch *" name="batchId" error={e.batchId}>
                <select id="batchId" name="batchId" defaultValue={d("batchId")} className="input" required>
                  <option value="">Select batch</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </Field>
              <Field label="Admission type" name="admissionType">
                <select id="admissionType" name="admissionType" defaultValue={d("admissionType") || "REGULAR"} className="input">
                  <option value="REGULAR">Regular (Convener / counselling)</option>
                  <option value="LATERAL">Lateral entry (Diploma → 2nd year)</option>
                  <option value="MANAGEMENT">Management quota</option>
                  <option value="SPOT">Spot admission</option>
                </select>
              </Field>
              <Field label="Admission date *" name="admissionDate" error={e.admissionDate}><input id="admissionDate" name="admissionDate" type="date" defaultValue={d("admissionDate")} className="input" required /></Field>
              <Field label="Previous institution" name="previousSchool"><input id="previousSchool" name="previousSchool" defaultValue={d("previousSchool")} className="input" placeholder="School / Polytechnic" /></Field>
              <Field label="Qualifying exam %" name="previousScore" error={e.previousScore}><input id="previousScore" name="previousScore" type="number" step="0.1" min="0" max="100" defaultValue={d("previousScore")} className="input" /></Field>
              {defaults.id && (
                <Field label="Status" name="status">
                  <select id="status" name="status" defaultValue={d("status")} className="input">{["ACTIVE", "DETAINED", "SUSPENDED", "DROPPED", "GRADUATED"].map((c) => <option key={c}>{c}</option>)}</select>
                </Field>
              )}
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <legend className="mb-3 text-sm font-semibold">Parent / guardian</legend>
              <Field label="Guardian name" name="guardianName"><input id="guardianName" name="guardianName" defaultValue={d("guardianName")} className="input" /></Field>
              <Field label="Guardian phone" name="guardianPhone"><input id="guardianPhone" name="guardianPhone" defaultValue={d("guardianPhone")} className="input" inputMode="tel" /></Field>
              <Field label="Guardian email" name="guardianEmail" error={e.guardianEmail}><input id="guardianEmail" name="guardianEmail" type="email" defaultValue={d("guardianEmail")} className="input" /></Field>
            </fieldset>
            <div className="flex justify-end"><SubmitButton>{submitLabel}</SubmitButton></div>
          </>
        );
      }}
    </ActionForm>
  );
}
