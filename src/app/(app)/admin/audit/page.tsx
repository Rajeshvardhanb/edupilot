import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { Badge, Pagination, Td } from "@/components/ui";
import { Card, PageHeader, Tabs, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { ADMIN_TABS } from "../tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Audit log" };
const PAGE = 50;

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireUser(["ADMIN"]);
  const sp = await props.searchParams;
  const entity = typeof sp.entity === "string" ? sp.entity : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = entity ? { entity } : {};
  const [logs, total, entities] = await Promise.all([
    db.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Administration" subtitle="Every create, update, delete, publish and login is recorded" />
      <Tabs active="/admin/audit" items={ADMIN_TABS} />
      <Filters>
        <select name="entity" aria-label="Entity" defaultValue={entity} className="input w-auto"><option value="">All entities</option>{entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}</select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-admin-audit" />
      <Card>
        <Table>
          <thead><tr><Th>When</Th><Th>User</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="text-xs whitespace-nowrap">{fmtDateTime(l.createdAt)}</Td>
                <Td>{l.user?.name ?? "System"}</Td>
                <Td><Badge tone={l.action === "DELETE" ? "danger" : l.action === "LOGIN" ? "neutral" : "brand"}>{l.action}</Badge></Td>
                <Td>{l.entity}</Td>
                <Td className="text-xs text-muted">{l.details}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {logs.length === 0 && <p className="text-sm text-muted">No activity recorded yet.</p>}
        <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/admin/audit?entity=${entity}&page=${p}`} />
      </Card>
    </>
  );
}
