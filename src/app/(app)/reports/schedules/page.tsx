import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SCHEDULED } from "@/lib/scheduler";
import { mailConfigured } from "@/lib/mail";
import { fmtDateTime, titleCase } from "@/lib/format";
import { deleteSchedule, saveSchedule, sendScheduleNow } from "@/actions/reports";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Tabs, Th, Table } from "@/components/ui-server";
import { reportTabs } from "../tabs";

export const metadata = { title: "Scheduled reports" };

export default async function SchedulesPage() {
  const user = await requireUser(["ADMIN", "HOD", "ACCOUNTANT"]);
  const options = Object.entries(SCHEDULED).filter(([, s]) => s.roles.includes(user.role));
  const mine = await db.reportSchedule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader title="Reports" subtitle={`Summaries emailed to ${user.email} automatically. HODs receive figures for their own department.`} />
      <Tabs active="/reports/schedules" items={reportTabs(user.role)} />
      {!mailConfigured() && <p className="mb-6 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">No mail server is configured yet, so scheduled reports are written to Administration → Email outbox instead of being delivered.</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="My scheduled reports">
          {mine.length === 0 ? <EmptyState title="Nothing scheduled yet" /> : (
            <Table>
              <thead><tr><Th>Report</Th><Th>How often</Th><Th>Last sent</Th><Th /></tr></thead>
              <tbody>{mine.map((s) => (
                <tr key={s.id}>
                  <Td><p className="font-medium">{SCHEDULED[s.report]?.label ?? s.report}</p><p className="text-xs text-muted">{SCHEDULED[s.report]?.description}</p></Td>
                  <Td><Badge tone="brand">{titleCase(s.frequency)}</Badge></Td>
                  <Td className="text-xs">{s.lastSentAt ? fmtDateTime(s.lastSentAt) : "Not yet"}</Td>
                  <Td className="whitespace-nowrap"><span className="flex gap-1"><ActionButton action={sendScheduleNow} fields={{ id: s.id }}>Send now</ActionButton><ActionButton action={deleteSchedule} fields={{ id: s.id }} variant="ghost" confirm="Stop this scheduled report?">Remove</ActionButton></span></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        <Card title="Schedule a report" className="h-fit">
          <ActionForm action={saveSchedule} className="space-y-3">
            <Field label="Report" name="report"><select id="report" name="report" className="input">{options.map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></Field>
            <Field label="How often" name="frequency"><select id="frequency" name="frequency" className="input"><option value="WEEKLY">Every week</option><option value="MONTHLY">Every month</option></select></Field>
            <SubmitButton>Schedule</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-xs text-muted">The server checks hourly and sends anything that is due. It must be running for emails to go out.</p>
        </Card>
      </div>
    </>
  );
}
