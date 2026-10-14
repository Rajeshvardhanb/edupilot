"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { saveFaculty } from "@/actions/faculty";

const DESIGNATIONS = ["Professor", "Associate Professor", "Assistant Professor", "Lecturer", "Senior Lecturer", "Lab Instructor"];

export function FacultyForm({ departments, defaults = {} }: { departments: { id: string; label: string }[]; defaults?: Record<string, string | null | undefined> }) {
  const d = (k: string) => defaults[k] ?? "";
  return (
    <ActionForm action={saveFaculty} className="space-y-4">
      {(state) => (
        <>
          {defaults.id && <input type="hidden" name="id" value={d("id")} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name *" name="name" error={state.fieldErrors?.name}><input id="name" name="name" defaultValue={d("name")} className="input" required /></Field>
            <Field label="Email *" name="email" error={state.fieldErrors?.email}><input id="email" name="email" type="email" data-check="email" defaultValue={d("email")} className="input" required /></Field>
            <Field label="Phone" name="phone"><input id="phone" name="phone" defaultValue={d("phone")} className="input" /></Field>
            <Field label="Employee ID *" name="employeeId" error={state.fieldErrors?.employeeId}><input id="employeeId" name="employeeId" data-check="employeeId" defaultValue={d("employeeId")} className="input uppercase" required /></Field>
            <Field label="Department *" name="departmentId">
              <select id="departmentId" name="departmentId" defaultValue={d("departmentId")} className="input" required>
                <option value="">Select</option>{departments.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Field>
            <Field label="Designation" name="designation">
              <select id="designation" name="designation" defaultValue={d("designation") || "Assistant Professor"} className="input">{DESIGNATIONS.map((x) => <option key={x}>{x}</option>)}</select>
            </Field>
            <Field label="Qualification" name="qualification"><input id="qualification" name="qualification" defaultValue={d("qualification")} className="input" placeholder="M.Tech, Ph.D" /></Field>
            <Field label="Specialization" name="specialization"><input id="specialization" name="specialization" defaultValue={d("specialization")} className="input" /></Field>
            <Field label="Date of joining" name="joiningDate"><input id="joiningDate" name="joiningDate" type="date" defaultValue={d("joiningDate")} className="input" /></Field>
          </div>
          <div className="flex justify-end"><SubmitButton>{defaults.id ? "Save changes" : "Add faculty"}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}
