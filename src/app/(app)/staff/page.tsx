import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { managedStaff } from "@/lib/staff";
import { fmtDate, isoDate, pct, titleCase } from "@/lib/format";
import { saveStaffAttendance } from "@/actions/staff";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar } from "@/components/avatar";
import { ROLE_LABEL } from "@/components/nav";
import { Badge, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Tabs, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { STAFF_TABS } from "./tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Staff attendance" };
const TONE: Record<string, Tone> = { PRESENT: "success", ABSENT: "danger", HALF_DAY: "warning", ON_LEAVE: "info" };

export default async function StaffAttendancePage(props: PageProps<"/staff">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const sp = await props.searchParams;
  const manager = user.role === "ADMIN" || user.role === "HOD";
  const today = isoDate(new Date());
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const monthStart = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);

  // Everyone sees their own month; managers also get the marking sheet.
  const mine = await db.staffAttendance.findMany({ where: { userId: user.id, date: { gte: monthStart } }, orderBy: { date: "desc" } });
  const count = (s: string) => mine.filter((m) => m.status === s).length;
  const staff = manager ? await db.user.findMany({ where: { ...managedStaff(user), isActive: true }, include: { faculty: { include: { department: true } }, staffAttendance: { where: { date: new Date(`${date}T00:00:00Z`) } }, staffLeaves: { where: { status: "APPROVED", fromDate: { lte: new Date(`${date}T00:00:00Z`) }, toDate: { gte: new Date(`${date}T00:00:00Z`) } } } }, orderBy: [{ role: "asc" }, { name: "asc" }] }) : [];
  const monthAll = manager ? await db.staffAttendance.groupBy({ by: ["status"], where: { user: managedStaff(user), date: { gte: monthStart } }, _count: true }) : [];
  const totalMarks = monthAll.reduce((s, x) => s + x._count, 0);

  return (
    <>
      <PageHeader title="Staff" subtitle={manager ? "Daily attendance for the staff you manage" : "Your attendance this month"} />
      <Tabs active="/staff" items={STAFF_TABS} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {manager ? (
          <>
            <StatCard label="Staff managed" value={staff.length} />
            <StatCard label="Present this month" value={`${pct(monthAll.find((x) => x.status === "PRESENT")?._count ?? 0, totalMarks)}%`} tone="success" />
            <StatCard label="Absences this month" value={monthAll.find((x) => x.status === "ABSENT")?._count ?? 0} tone="danger" />
            <StatCard label="Leave days this month" value={monthAll.find((x) => x.status === "ON_LEAVE")?._count ?? 0} tone="info" />
          </>
        ) : (
          <>
            <StatCard label="Present" value={count("PRESENT")} tone="success" /><StatCard label="Half days" value={count("HALF_DAY")} tone="warning" />
            <StatCard label="On leave" value={count("ON_LEAVE")} tone="info" /><StatCard label="Absent" value={count("ABSENT")} tone="danger" />
          </>
        )}
      </div>
      {manager ? (
        <Card title={`Mark attendance · ${fmtDate(new Date(`${date}T00:00:00Z`))}`}>
          <Filters><div><label className="label">Date</label><input type="date" name="date" aria-label="Date" defaultValue={date} max={today} className="input" /></div><button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">Load</button></Filters>
      <SavedFilters storageKey="edupilot-filters-staff" />
          {staff.length === 0 ? <EmptyState title="No staff to manage" /> : (
            <ActionForm key={date} action={saveStaffAttendance}>
              <input type="hidden" name="date" value={date} />
              <Table>
                <thead><tr><Th>Staff member</Th><Th>Role</Th><Th>Status</Th></tr></thead>
                <tbody>{staff.map((s) => {
                  const current = s.staffAttendance[0]?.status ?? (s.staffLeaves.length ? "ON_LEAVE" : "PRESENT");
                  return (
                    <tr key={s.id}>
                      <Td><div className="flex items-center gap-3"><Avatar name={s.name} userId={s.id} hasPhoto={!!s.photoType} size={32} /><div><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{s.faculty ? `${s.faculty.employeeId} · ${s.faculty.department.code}` : s.email}</p></div></div></Td>
                      <Td className="text-xs">{ROLE_LABEL[s.role]}{s.staffLeaves.length > 0 && <Badge tone="info">Approved leave</Badge>}</Td>
                      <Td><select name={`u_${s.id}`} defaultValue={current} aria-label={`Status for ${s.name}`} className="input w-36 py-1">{["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Td>
                    </tr>
                  );
                })}</tbody>
              </Table>
              <div className="mt-4 flex justify-end"><SubmitButton>Save attendance</SubmitButton></div>
            </ActionForm>
          )}
        </Card>
      ) : (
        <Card title="This month">
          {mine.length === 0 ? <EmptyState title="No attendance recorded yet this month" /> : (
            <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">{mine.map((m) => <li key={m.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm"><span>{fmtDate(m.date)}</span><Badge tone={TONE[m.status]}>{titleCase(m.status)}</Badge></li>)}</ul>
          )}
        </Card>
      )}
    </>
  );
}
