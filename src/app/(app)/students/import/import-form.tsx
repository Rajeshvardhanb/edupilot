"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { importStudents } from "@/actions/students";

export function ImportForm({ batches, today }: { batches: { id: string; label: string }[]; today: string }) {
  return (
    <ActionForm action={importStudents} className="space-y-4" resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch" name="batchId">
          <select id="batchId" name="batchId" className="input" required>
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Admission date" name="admissionDate"><input id="admissionDate" type="date" name="admissionDate" defaultValue={today} className="input" required /></Field>
      </div>
      <Field label="CSV file" name="file"><input id="file" name="file" type="file" accept=".csv,text/csv" className="input" required /></Field>
      <SubmitButton>Import students</SubmitButton>
    </ActionForm>
  );
}
