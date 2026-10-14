"use client";

import { saveRules } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field } from "@/components/ui";
import type { GradeRow } from "@/lib/grading";

const ROWS = 10;

export function RulesForm({ rules: r, custom }: { rules: { attendanceRequired: number; attendanceCondonable: number; passPercent: number; minExternalPercent: number; gradeScale: GradeRow[]; promoteMaxBacklogs: number | null; placementSemestersLeft: number }; custom: boolean }) {
  const rows = [...r.gradeScale, ...Array.from({ length: Math.max(0, ROWS - r.gradeScale.length) }, () => null)];
  return (
    <ActionForm action={saveRules} className="lg:col-span-2">
          {(s) => (
            <div className="space-y-6">
              <Card title="Attendance">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Required attendance (%)" name="attendanceRequired" error={s.fieldErrors?.attendanceRequired}><input name="attendanceRequired" type="number" min={1} max={100} defaultValue={r.attendanceRequired} className="input" required /></Field>
                  <Field label="Condonation allowed down to (%)" name="attendanceCondonable" error={s.fieldErrors?.attendanceCondonable}><input name="attendanceCondonable" type="number" min={0} max={100} defaultValue={r.attendanceCondonable} className="input" required /></Field>
                </div>
                <p className="mt-3 text-xs text-muted">A student at or above the required percentage gets a hall ticket. Between the two figures, a hall ticket needs an approved medical leave (condonation). Below the lower figure the student is detained. Set both to the same number if your university has no condonation.</p>
              </Card>
              <Card title="Passing a subject">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Minimum total to pass (%)" name="passPercent" error={s.fieldErrors?.passPercent}><input name="passPercent" type="number" min={1} max={100} defaultValue={r.passPercent} className="input" required /></Field>
                  <Field label="Minimum in the end-semester exam (%)" name="minExternalPercent" error={s.fieldErrors?.minExternalPercent}><input name="minExternalPercent" type="number" min={0} max={100} defaultValue={r.minExternalPercent} className="input" required /></Field>
                </div>
                <p className="mt-3 text-xs text-muted">Both must be met. The second is a share of the end-semester marks only; enter 0 if your university has no separate minimum for it.</p>
              </Card>
              <Card title="Promotion and placements">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Detain when active backlogs are more than" name="promoteMaxBacklogs" error={s.fieldErrors?.promoteMaxBacklogs}><input name="promoteMaxBacklogs" type="number" min={0} max={60} defaultValue={r.promoteMaxBacklogs ?? ""} placeholder="No limit: promote everyone" className="input" /></Field>
                  <Field label="Placement drives are open to" name="placementSemestersLeft">
                    <select name="placementSemestersLeft" defaultValue={String(r.placementSemestersLeft)} className="input">
                      <option value="1">Final year only</option>
                      <option value="3">Pre-final and final year</option>
                      <option value="5">The last three years</option>
                      <option value="99">Every year</option>
                    </select>
                  </Field>
                </div>
                <p className="mt-3 text-xs text-muted">When a batch is promoted, students over the backlog limit are listed as “detain” and you confirm each one before anything changes. Leave it empty to promote everyone.</p>
              </Card>
              <Card title="Grade scale" actions={custom ? <Badge tone="info">Customised</Badge> : <Badge>Standard 10-point</Badge>}>
                <div className="overflow-x-auto">
                  <table className="w-full max-w-lg text-sm">
                    <thead><tr className="text-left text-xs text-muted"><th className="pb-2 font-medium">Grade</th><th className="pb-2 font-medium">From (% of total)</th><th className="pb-2 font-medium">Grade points</th></tr></thead>
                    <tbody>
                      {rows.map((g, i) => (
                        <tr key={i}>
                          <td className="py-1 pr-2"><input name="grade" aria-label={`Grade ${i + 1}`} defaultValue={g?.grade ?? ""} maxLength={4} className="input w-24 py-2 font-semibold" /></td>
                          <td className="py-1 pr-2"><input name="min" aria-label={`Grade ${i + 1} starts at`} type="number" min={0} max={100} step="0.5" defaultValue={g?.min ?? ""} className="input w-32 py-2" /></td>
                          <td className="py-1"><input name="point" aria-label={`Grade ${i + 1} points`} type="number" min={0} max={10} step="1" defaultValue={g?.point ?? ""} className="input w-32 py-2" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted">One row per grade, in any order. The row starting at 0% is the fail grade and carries 0 points. Leave a row empty to remove it.</p>
              </Card>
              <SubmitButton confirm="Save these rules? Attendance changes apply everywhere at once; pass marks and grades apply to results published from now on.">Save rules</SubmitButton>
            </div>
          )}
        </ActionForm>
  );
}
