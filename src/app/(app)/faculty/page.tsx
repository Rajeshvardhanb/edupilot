import Link from "next/link";
import { UserPlus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { fmtDate } from "@/lib/format";
import { Badge, LinkButton, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters, SearchInput } from "@/components/filters";
import { Avatar } from "@/components/avatar";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Faculty" };

export default async function FacultyPage(props: PageProps<"/faculty">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const dept = user.role === "HOD" ? user.departmentId ?? "-" : typeof sp.dept === "string" ? sp.dept : "";
  const term = await currentTerm();
  const where: Prisma.FacultyWhereInput = {
    ...(dept && { departmentId: dept }),
    ...(q && { OR: [{ employeeId: { contains: q } }, { user: { name: { contains: q } } }, { specialization: { contains: q } }] }),
  };
  const [faculty, depts] = await Promise.all([
    db.faculty.findMany({
      where, include: { user: true, department: true, headOf: true, _count: { select: { offerings: { where: { termId: term?.id } } } } },
      orderBy: [{ department: { code: "asc" } }, { user: { name: "asc" } }],
    }),
    db.department.findMany({ orderBy: { code: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Faculty" subtitle={`${faculty.length} members`} actions={<LinkButton href="/faculty/new"><UserPlus className="size-4" /> Add faculty</LinkButton>} />
      <Filters>
        <SearchInput placeholder="Search by name, employee ID, specialization" defaultValue={q} />
        {user.role === "ADMIN" && (
          <select name="dept" aria-label="Department" defaultValue={dept} className="input w-auto"><option value="">All departments</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        )}
      </Filters>
      <SavedFilters storageKey="edupilot-filters-faculty" />
      <Card>
        <Table>
          <thead><tr><Th>Emp. ID</Th><Th>Name</Th><Th>Department</Th><Th>Designation</Th><Th>Qualification</Th><Th>Joined</Th><Th className="text-right">Courses (term)</Th><Th /></tr></thead>
          <tbody>
            {faculty.map((f) => (
              <tr key={f.id}>
                <Td className="font-mono text-xs">{f.employeeId}</Td>
                <Td><div className="flex items-center gap-3"><Avatar name={f.user.name} userId={f.userId} hasPhoto={!!f.user.photoType} size={34} /><div><p className="font-medium">{f.user.name} {f.headOf && <Badge tone="brand">HOD</Badge>} {!f.user.isActive && <Badge tone="danger">Inactive</Badge>}</p><p className="text-xs text-muted">{f.user.email} · {f.user.phone}</p></div></div></Td>
                <Td>{f.department.code}</Td>
                <Td>{f.designation}</Td>
                <Td>{f.qualification}</Td>
                <Td className="whitespace-nowrap">{fmtDate(f.joiningDate)}</Td>
                <Td className="text-right">{f._count.offerings}</Td>
                <Td><Link href={`/faculty/${f.id}`} className="text-xs text-brand">Edit</Link></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
