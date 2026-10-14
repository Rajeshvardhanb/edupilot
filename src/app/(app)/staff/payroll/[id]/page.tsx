import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, inr, inWords } from "@/lib/format";
import { ROLE_LABEL } from "@/components/nav";
import { Letterhead, Sheet } from "@/components/letterhead";
import { PrintButton } from "@/components/print-button";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Payslip" };

/** A printable payslip. Staff can open only their own; the administrator and accounts can open anyone's. */
export default async function PayslipPage(props: PageProps<"/staff/payroll/[id]">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const { id } = await props.params;
  const s = await db.payslip.findUnique({ where: { id }, include: { user: { select: { name: true, role: true, email: true, faculty: { select: { employeeId: true, designation: true, department: { select: { name: true } } } } } } } });
  if (!s || (s.userId !== user.id && user.role !== "ADMIN" && user.role !== "ACCOUNTANT")) notFound();
  const month = new Date(`${s.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const earnings: [string, number][] = [["Basic pay", s.basic], ["House rent allowance", s.hra], ["Dearness allowance", s.da], ["Other allowances", s.allowances]];
  const deductions: [string, number][] = [["Provident fund", s.pf], ["Loss of pay", s.lopDeduction], ["Other deductions", s.otherDeductions]];
  const rows = Math.max(earnings.length, deductions.length);
  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-between"><LinkButton variant="secondary" href="/staff/payroll">Back</LinkButton><PrintButton /></div>
      <Sheet>
        <Letterhead title="Payslip" serial={month} />
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 py-5 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted">Name</dt><dd className="font-medium">{s.user.name}</dd></div>
          <div><dt className="text-xs text-muted">Employee ID</dt><dd className="font-mono">{s.user.faculty?.employeeId ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted">Designation</dt><dd>{s.user.faculty?.designation ?? ROLE_LABEL[s.user.role]}</dd></div>
          <div><dt className="text-xs text-muted">Department</dt><dd>{s.user.faculty?.department.name ?? "Administration"}</dd></div>
          <div><dt className="text-xs text-muted">Working days</dt><dd className="tabular-nums">{s.workingDays}</dd></div>
          <div><dt className="text-xs text-muted">Paid days</dt><dd className="tabular-nums">{s.paidDays}</dd></div>
          <div><dt className="text-xs text-muted">Loss-of-pay days</dt><dd className="tabular-nums">{s.lopDays}</dd></div>
          <div><dt className="text-xs text-muted">Generated</dt><dd>{fmtDate(s.generatedAt)}</dd></div>
        </dl>
        <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse text-sm">
          <thead><tr className="bg-surface-2 text-left"><th className="border border-line px-3 py-2 text-xs font-semibold">Earnings</th><th className="border border-line px-3 py-2 text-right text-xs font-semibold">₹</th><th className="border border-line px-3 py-2 text-xs font-semibold">Deductions</th><th className="border border-line px-3 py-2 text-right text-xs font-semibold">₹</th></tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr key={i}>
                <td className="border border-line px-3 py-2">{earnings[i]?.[0] ?? ""}</td><td className="border border-line px-3 py-2 text-right tabular-nums">{earnings[i] ? earnings[i][1].toLocaleString("en-IN") : ""}</td>
                <td className="border border-line px-3 py-2">{deductions[i]?.[0] ?? ""}</td><td className="border border-line px-3 py-2 text-right tabular-nums">{deductions[i] ? deductions[i][1].toLocaleString("en-IN") : ""}</td>
              </tr>
            ))}
            <tr className="bg-surface-2 font-semibold"><td className="border border-line px-3 py-2">Gross earnings</td><td className="border border-line px-3 py-2 text-right tabular-nums">{s.gross.toLocaleString("en-IN")}</td><td className="border border-line px-3 py-2">Total deductions</td><td className="border border-line px-3 py-2 text-right tabular-nums">{(s.pf + s.lopDeduction + s.otherDeductions).toLocaleString("en-IN")}</td></tr>
          </tbody>
        </table></div>
        <div className="mt-5 rounded-xl bg-surface-2 p-4"><div className="flex items-baseline justify-between"><span className="text-sm">Net pay</span><span className="font-display text-2xl font-bold tabular-nums">{inr(s.net)}</span></div><p className="mt-1 text-xs text-muted">{inWords(s.net)}</p></div>
        <p className="mt-10 text-xs text-muted">Computer-generated statement; no signature required. Income tax is not worked out here.</p>
      </Sheet>
    </>
  );
}
