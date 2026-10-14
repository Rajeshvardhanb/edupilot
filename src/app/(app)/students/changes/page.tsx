import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { PROFILE_FIELDS, type ProfileField } from "@/lib/profile-fields";
import { decideProfileChange } from "@/actions/office";
import { ActionButton } from "@/components/forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Profile corrections" };

/** Corrections to contact details asked for by students and parents. Nothing changes until one is approved here. */
export default async function ProfileChangesPage() {
  await requireUser(["ADMIN", "OFFICE"]);
  const rows = await db.profileChange.findMany({ include: { student: { select: { id: true, rollNo: true, user: { select: { name: true } } } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  const pending = rows.filter((r) => r.status === "PENDING");
  return (
    <>
      <Breadcrumbs items={[{ label: "Students", href: "/students" }, { label: "Profile corrections" }]} />
      <PageHeader title="Profile corrections" subtitle={`${pending.length} waiting · asked for by students and parents from their profile page`} />
      <Card>
        {rows.length === 0 ? <EmptyState title="No corrections requested">When a student or parent asks for a phone number or address to be corrected, it appears here for approval.</EmptyState> : (
          <Table>
            <thead><tr><Th>Student</Th><Th>What</Th><Th>On record</Th><Th>Should be</Th><Th>Asked</Th><Th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <Td><Link href={`/students/${r.student.id}`} className="font-medium hover:text-brand">{r.student.user.name}</Link><p className="font-mono text-xs text-muted">{r.student.rollNo}</p></Td>
                <Td>{PROFILE_FIELDS[r.field as ProfileField] ?? r.field}</Td>
                <Td className="max-w-48 text-muted">{r.oldValue || "—"}</Td>
                <Td className="max-w-48 font-medium">{r.newValue}</Td>
                <Td className="text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</Td>
                <Td className="text-right whitespace-nowrap">{r.status === "PENDING"
                  ? <span className="inline-flex gap-1"><ActionButton action={decideProfileChange} fields={{ id: r.id, decision: "approve" }} variant="primary">Approve</ActionButton><ActionButton action={decideProfileChange} fields={{ id: r.id, decision: "reject" }} variant="ghost">Reject</ActionButton></span>
                  : <Badge tone={r.status === "APPROVED" ? "success" : "danger"}>{r.status === "APPROVED" ? "Applied" : "Rejected"}</Badge>}</Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
