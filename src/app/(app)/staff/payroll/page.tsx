import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, isoDate } from "@/lib/format";
import { ROLE_LABEL } from "@/components/nav";
import { runPayroll, saveSalary } from "@/actions/payroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Tabs, Th, Table } from "@/components/ui-server";
import { STAFF_TABS } from "../tabs";

export const metadata = { title: "Payroll" };

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function PayrollPage(props: PageProps<"/staff/payroll">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const manage = user.role === "ADMIN" || user.role === "ACCOUNTANT";
  const sp = await props.searchParams;
  const thisMonth = isoDate(new Date()).slice(0, 7);
  // Without a month in the address, show the latest month payroll was run for (or this month if never).
  const latest = manage ? (await db.payslip.findFirst({ orderBy: { month: "desc" }, select: { month: true } }))?.month : undefined;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : latest ?? thisMonth;

  const mine = await db.payslip.findMany({ where: { userId: user.id }, orderBy: { month: "desc" }, take: 12 });
  const [staff, slips] = manage
    ? await Promise.all([
        db.user.findMany({ where: { role: { in: ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"] }, isActive: true }, select: { id: true, name: true, role: true, salary: true, faculty: { select: { employeeId: true, designation: true } } }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
        db.payslip.findMany({ where: { month }, include: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
      ])
    : [[], []];
  const withSalary = staff.filter((s) => s.salary).length;

  return (
    <>
      <PageHeader title="Staff" subtitle={manage ? "Salaries, the monthly payroll run and payslips" : "Your payslips"} />
      <Tabs active="/staff/payroll" items={STAFF_TABS} />
      {manage && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard label="Staff with a salary set" value={`${withSalary}/${staff.length}`} tone={withSalary === staff.length ? "success" : "warning"} />
            <StatCard label={`Payslips · ${monthName(month)}`} value={slips.length} tone="brand" />
            <StatCard label="Net pay for the month" value={inr(slips.reduce((t, s) => t + s.net, 0))} tone="success" />
            <StatCard label="Loss-of-pay days" value={slips.reduce((t, s) => t + s.lopDays, 0)} tone="danger" hint="absences not covered by leave" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card title={`Payroll · ${monthName(month)}`}>
                {slips.length === 0 ? <EmptyState title="Payroll has not been run for this month">Set salaries below, then use Run payroll.</EmptyState> : (
                  <Table>
                    <thead><tr><Th>Staff member</Th><Th className="text-right">Paid days</Th><Th className="text-right">Gross</Th><Th className="text-right">Deductions</Th><Th className="text-right">Net pay</Th><Th /></tr></thead>
                    <tbody>{slips.map((s) => (
                      <tr key={s.id}>
                        <Td className="font-medium">{s.user.name}</Td>
                        <Td className="text-right tabular-nums">{s.paidDays}/{s.workingDays}{s.lopDays > 0 && <> <Badge tone="danger">{s.lopDays} LOP</Badge></>}</Td>
                        <Td className="text-right tabular-nums">{inr(s.gross)}</Td>
                        <Td className="text-right tabular-nums">{inr(s.pf + s.otherDeductions + s.lopDeduction)}</Td>
                        <Td className="text-right font-semibold tabular-nums">{inr(s.net)}</Td>
                        <Td className="text-right"><Link href={`/staff/payroll/${s.id}`} className="text-xs text-brand">Payslip →</Link></Td>
                      </tr>
                    ))}</tbody>
                  </Table>
                )}
              </Card>
              <Card title="Salaries" actions={<span className="text-xs text-muted">Monthly amounts in rupees</span>}>
                <ul className="divide-y divide-line/70">
                  {staff.map((s) => (
                    <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                      <details>
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="text-xs text-muted">{s.faculty ? `${s.faculty.employeeId} · ${s.faculty.designation}` : ROLE_LABEL[s.role]}</span></span>
                          {s.salary ? <span className="text-sm tabular-nums">{inr(s.salary.basic + s.salary.hra + s.salary.da + s.salary.allowances)} <span className="text-xs text-muted">gross</span></span> : <Badge tone="warning">Not set</Badge>}
                          <span className="text-xs text-brand">{s.salary ? "Change" : "Set salary"}</span>
                        </summary>
                        <ActionForm action={saveSalary} className="mt-3 grid gap-3 rounded-2xl bg-surface-2/50 p-3 sm:grid-cols-3 lg:grid-cols-7">
                          <input type="hidden" name="userId" value={s.id} />
                          {([["basic", "Basic"], ["hra", "HRA"], ["da", "DA"], ["allowances", "Allowances"], ["otherDeductions", "Other deductions"]] as const).map(([k, label]) => (
                            <Field key={k} label={label}><input name={k} aria-label={`${label} for ${s.name}`} type="number" min={0} defaultValue={s.salary?.[k] ?? ""} className="input py-2" required={k === "basic"} /></Field>
                          ))}
                          <Field label="PF % of basic"><input name="pfPercent" aria-label={`PF percent for ${s.name}`} type="number" min={0} max={30} step="0.5" defaultValue={s.salary?.pfPercent ?? 12} className="input py-2" /></Field>
                          <div className="flex items-end"><SubmitButton size="sm" variant="secondary">Save</SubmitButton></div>
                        </ActionForm>
                      </details>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <Card title="Run payroll" className="h-fit">
              <ActionForm action={runPayroll} className="space-y-3">
                <Field label="Month" name="month"><input name="month" type="month" defaultValue={thisMonth} max={thisMonth} className="input" required /></Field>
                <SubmitButton confirm="Run payroll for this month? Existing payslips for the month are replaced.">Run payroll</SubmitButton>
              </ActionForm>
              <form className="mt-4 flex items-end gap-2 border-t border-line/70 pt-4"><div className="flex-1"><label className="label" htmlFor="view-month">Show another month</label><input id="view-month" name="month" type="month" defaultValue={month} max={thisMonth} className="input" /></div><button className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-semibold">Show</button></form>
              <ul className="mt-4 space-y-2 text-xs text-muted">
                <li>Working days are every day of the month except Sundays and the holidays on the academic calendar.</li>
                <li>A day marked absent in staff attendance is a loss-of-pay day; a half day counts as half. Days on approved leave are paid.</li>
                <li>Provident fund is the percentage of basic pay entered for each person.</li>
                <li>This is a salary statement. It does not work out income tax.</li>
              </ul>
            </Card>
          </div>
        </>
      )}
      <Card title="My payslips" className={manage ? "mt-6" : ""}>
        {mine.length === 0 ? <EmptyState title="No payslips yet">A payslip appears here each month once payroll has been run.</EmptyState> : (
          <Table>
            <thead><tr><Th>Month</Th><Th className="text-right">Paid days</Th><Th className="text-right">Gross</Th><Th className="text-right">Net pay</Th><Th /></tr></thead>
            <tbody>{mine.map((s) => (
              <tr key={s.id}><Td className="font-medium">{monthName(s.month)}</Td><Td className="text-right tabular-nums">{s.paidDays}/{s.workingDays}</Td><Td className="text-right tabular-nums">{inr(s.gross)}</Td><Td className="text-right font-semibold tabular-nums">{inr(s.net)}</Td><Td className="text-right"><Link href={`/staff/payroll/${s.id}`} className="text-xs text-brand">Open →</Link></Td></tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
