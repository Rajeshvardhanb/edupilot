import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentScope } from "@/lib/scope";
import { daysAgo, fmtDateTime, titleCase } from "@/lib/format";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Filters } from "@/components/filters";
import { Badge, Pagination, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Parent contact log" };

const PAGE = 40;
const TONE: Record<string, "success" | "info" | "brand" | "warning"> = { WHATSAPP: "success", EMAIL: "info", PHONE: "brand", IN_PERSON: "warning" };

/** Every recorded contact with a parent or guardian, newest first, for the students this person can see. */
export default async function ParentContactsPage(props: PageProps<"/students/contacts">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"]);
  const sp = await props.searchParams;
  const channel = typeof sp.channel === "string" ? sp.channel : "", purpose = typeof sp.purpose === "string" ? sp.purpose : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const scope = { student: studentScope(user) };
  const where = { ...scope, ...(channel && { channel }), ...(purpose && { purpose }) };
  const since = daysAgo(30);
  const [rows, total, byChannel, students] = await Promise.all([
    db.parentContact.findMany({ where, include: { by: { select: { name: true } }, student: { select: { id: true, rollNo: true, guardianName: true, user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.parentContact.count({ where }),
    db.parentContact.groupBy({ by: ["channel"], where: { ...scope, createdAt: { gte: since } }, _count: true }),
    db.parentContact.findMany({ where: { ...scope, createdAt: { gte: since } }, distinct: ["studentId"], select: { studentId: true } }),
  ]);
  const n = (c: string) => byChannel.find((x) => x.channel === c)?._count ?? 0;
  const qs = (p: number) => `/students/contacts?${new URLSearchParams({ ...(channel && { channel }), ...(purpose && { purpose }), page: String(p) })}`;

  return (
    <>
      <Breadcrumbs items={[{ label: "Students", href: "/students" }, { label: "Parent contact log" }]} />
      <PageHeader title="Parent contact log" subtitle="Who was contacted, how, about what, and by whom. WhatsApp and email reminders are recorded automatically; calls and meetings are added from the student's page." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Families contacted · 30 days" value={students.length} />
        <StatCard label="WhatsApp reminders" value={n("WHATSAPP")} tone="success" />
        <StatCard label="Emails" value={n("EMAIL")} tone="info" />
        <StatCard label="Calls and meetings" value={n("PHONE") + n("IN_PERSON")} tone="warning" />
      </div>
      <Filters>
        <select name="channel" aria-label="Channel" defaultValue={channel} className="input w-auto"><option value="">Any channel</option>{["WHATSAPP", "EMAIL", "PHONE", "IN_PERSON"].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select>
        <select name="purpose" aria-label="Purpose" defaultValue={purpose} className="input w-auto"><option value="">Any subject</option>{["ATTENDANCE", "FEES", "RESULTS", "CONDUCT", "GENERAL"].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-students-contacts" />
      <Card>
        {rows.length === 0 ? <EmptyState title="Nothing recorded yet">Use “Remind parent” on a fee invoice or the attendance shortage report, or add a call from a student&apos;s page.</EmptyState> : (
          <Table>
            <thead><tr><Th>When</Th><Th>Student</Th><Th>How</Th><Th>About</Th><Th>Message</Th><Th>By</Th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td className="text-xs whitespace-nowrap">{fmtDateTime(c.createdAt)}</Td>
                  <Td><Link href={`/students/${c.student.id}`} className="font-medium hover:text-brand">{c.student.user.name}</Link><p className="font-mono text-xs text-muted">{c.student.rollNo}{c.student.guardianName && <span className="font-sans"> · {c.student.guardianName}</span>}</p></Td>
                  <Td><Badge tone={TONE[c.channel] ?? "neutral"}>{titleCase(c.channel)}</Badge></Td>
                  <Td><Badge>{titleCase(c.purpose)}</Badge></Td>
                  <Td className="max-w-md text-xs text-muted"><span className="line-clamp-2">{c.message}</span></Td>
                  <Td className="text-xs whitespace-nowrap">{c.by?.name ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={qs} />
      </Card>
    </>
  );
}
