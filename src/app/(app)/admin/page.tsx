import type { Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { createStaffUser, resetPassword, toggleUserActive, turnOffTwoStep } from "@/actions/admin";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Pagination, Td } from "@/components/ui";
import { Card, PageHeader, StatCard, Tabs, Th, Table } from "@/components/ui-server";
import { Filters, SearchInput } from "@/components/filters";
import { ROLE_LABEL } from "@/components/nav";
import { ResetResult } from "./reset-result";
import { ADMIN_TABS } from "./tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Administration" };
const PAGE = 30;

export default async function AdminPage(props: PageProps<"/admin">) {
  const me = await requireUser(["ADMIN"]);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {
    ...(role && { role: role as Role }),
    ...(q && { OR: [{ name: { contains: q } }, { email: { contains: q } }] }),
  };
  const [users, total, counts] = await Promise.all([
    db.user.findMany({ where, orderBy: [{ role: "asc" }, { name: "asc" }], skip: (page - 1) * PAGE, take: PAGE }),
    db.user.count({ where }),
    db.user.groupBy({ by: ["role"], _count: true }),
  ]);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "page") as [string, string][]);
  return (
    <>
      <PageHeader title="Administration" subtitle="User accounts, access and audit trail" />
      <Tabs active="/admin" items={ADMIN_TABS} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {counts.map((c) => <StatCard key={c.role} label={ROLE_LABEL[c.role]} value={c._count} tone="neutral" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Filters>
            <SearchInput placeholder="Name or email" defaultValue={q} />
            <select name="role" aria-label="Role" defaultValue={role} className="input w-auto"><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Filters>
      <SavedFilters storageKey="edupilot-filters-admin" />
          <Card>
            <Table>
              <thead><tr><Th>User</Th><Th>Role</Th><Th>Last login</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <Td><p className="font-medium">{u.name}</p><p className="text-xs text-muted">{u.email}</p></Td>
                    <Td><Badge tone={u.role === "ADMIN" ? "brand" : "neutral"}>{ROLE_LABEL[u.role]}</Badge></Td>
                    <Td className="text-xs whitespace-nowrap">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</Td>
                    <Td><span className="flex flex-wrap gap-1"><Badge tone={u.isActive ? "success" : "danger"}>{u.isActive ? "Active" : "Disabled"}</Badge>{u.twoStep && <Badge tone="info">2-step</Badge>}</span></Td>
                    <Td className="text-right whitespace-nowrap">
                      {u.id !== me.id && (
                        <span className="inline-flex items-start gap-2">
                          <ResetResult action={resetPassword} id={u.id} />
                          {u.twoStep && <ActionButton action={turnOffTwoStep} fields={{ id: u.id }} variant="ghost" confirm={`Turn off two-step sign-in for ${u.email}? Do this only if they have lost access to their mailbox.`}>2-step off</ActionButton>}
                          <ActionButton action={toggleUserActive} fields={{ id: u.id }} variant="ghost" confirm={u.isActive ? `Disable ${u.email}?` : undefined}>{u.isActive ? "Disable" : "Enable"}</ActionButton>
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/admin?${query}&page=${p}`} />
          </Card>
        </div>
        <Card title="Add admin / accounts user" className="h-fit">
          <ActionForm action={createStaffUser} className="space-y-3" resetOnSuccess>
            <Field label="Name" name="name"><input id="name" name="name" className="input" required /></Field>
            <Field label="Email" name="email"><input id="email" name="email" type="email" data-check="email" className="input" required /></Field>
            <Field label="Role" name="role"><select id="role" name="role" className="input"><option value="ACCOUNTANT">Accounts Officer</option><option value="OFFICE">Office Staff</option><option value="ADMIN">Administrator</option></select></Field>
            <Field label="Initial password" name="password"><input id="password" name="password" type="password" minLength={8} className="input" required /></Field>
            <SubmitButton>Create user</SubmitButton>
            <p className="text-xs text-muted">Faculty and students are added from the Faculty and Students modules.</p>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
