import { Boxes, PackageCheck, PackageOpen, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, inr, isoDate, titleCase } from "@/lib/format";
import { issueAsset, returnAsset, saveAsset } from "@/actions/office";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Filters } from "@/components/filters";
import { SavedFilters } from "@/components/saved-filters";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Th, Table } from "@/components/ui-server";

export const metadata = { title: "Inventory" };

const TONE: Record<string, Tone> = { GOOD: "success", NEEDS_REPAIR: "warning", CONDEMNED: "danger" };
const CATEGORIES = ["Computer", "Lab equipment", "Projector / AV", "Furniture", "Network", "Tools", "Other"];

/** Lab equipment and other assets: what the college owns, where it is, its condition and who has it. */
export default async function InventoryPage(props: PageProps<"/inventory">) {
  const user = await requireUser(["ADMIN", "HOD", "OFFICE"]);
  const sp = await props.searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = pick("q"), category = pick("category"), condition = pick("condition");
  const own = user.role === "HOD" ? { departmentId: user.departmentId ?? "-" } : pick("dept") ? { departmentId: pick("dept") } : {};
  const where = { ...own, ...(category && { category }), ...(condition && { condition }), ...(q && { OR: [{ name: { contains: q } }, { tag: { contains: q } }, { location: { contains: q } }] }) };
  const [assets, all, out, depts] = await Promise.all([
    db.asset.findMany({ where, include: { department: { select: { code: true } }, issues: { where: { returnedAt: null }, select: { quantity: true } } }, orderBy: [{ category: "asc" }, { tag: "asc" }], take: 300 }),
    db.asset.findMany({ where: own, select: { quantity: true, cost: true, condition: true } }),
    db.assetIssue.findMany({ where: { returnedAt: null, asset: own }, include: { asset: { select: { tag: true, name: true } } }, orderBy: { issuedAt: "asc" } }),
    user.role === "HOD" ? [] : db.department.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
  ]);
  const today = new Date(isoDate(new Date()));
  const units = all.reduce((t, a) => t + a.quantity, 0);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Lab equipment and other assets: what there is, where it is and who has it" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Items on record" value={units.toLocaleString("en-IN")} icon={<Boxes className="size-5" />} hint={`${all.length} entries`} />
        <StatCard label="Value at cost" value={inr(all.reduce((t, a) => t + (a.cost ?? 0) * a.quantity, 0))} tone="info" icon={<PackageCheck className="size-5" />} />
        <StatCard label="Issued right now" value={out.reduce((t, i) => t + i.quantity, 0)} tone="warning" icon={<PackageOpen className="size-5" />} hint={`${out.filter((i) => i.dueBack && i.dueBack < today).length} overdue`} />
        <StatCard label="Needs repair" value={all.filter((a) => a.condition === "NEEDS_REPAIR").reduce((t, a) => t + a.quantity, 0)} tone="danger" icon={<Wrench className="size-5" />} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Filters>
            <input name="q" aria-label="Search" defaultValue={q} placeholder="Name, tag or room" className="input min-w-48 flex-1" />
            <select name="category" aria-label="Category" defaultValue={category} className="input w-auto"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select name="condition" aria-label="Condition" defaultValue={condition} className="input w-auto"><option value="">Any condition</option>{Object.keys(TONE).map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select>
            {user.role !== "HOD" && <select name="dept" aria-label="Department" defaultValue={pick("dept")} className="input w-auto"><option value="">All departments</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>}
          </Filters>
          <SavedFilters storageKey="edupilot-filters-inventory" />
          <Card title="Assets">
            {assets.length === 0 ? <EmptyState title="No assets recorded">Add the first one with the form on the right.</EmptyState> : (
              <Table>
                <thead><tr><Th>Tag</Th><Th>Item</Th><Th>Where</Th><Th className="text-right">Qty</Th><Th className="text-right">Free</Th><Th>Condition</Th></tr></thead>
                <tbody>{assets.map((a) => { const issued = a.issues.reduce((t, i) => t + i.quantity, 0); return (
                  <tr key={a.id}>
                    <Td className="font-mono text-xs">{a.tag}</Td>
                    <Td className="font-medium">{a.name}<p className="text-xs font-normal text-muted">{a.category}{a.department && ` · ${a.department.code}`}</p></Td>
                    <Td>{a.location}</Td>
                    <Td className="text-right tabular-nums">{a.quantity}</Td>
                    <Td className="text-right tabular-nums">{a.quantity - issued}</Td>
                    <Td><Badge tone={TONE[a.condition] ?? "neutral"}>{titleCase(a.condition)}</Badge></Td>
                  </tr>
                ); })}</tbody>
              </Table>
            )}
          </Card>
          <Card title="Out on issue">
            {out.length === 0 ? <p className="text-sm text-muted">Nothing is issued at the moment.</p> : (
              <Table>
                <thead><tr><Th>Item</Th><Th>Issued to</Th><Th className="text-right">Qty</Th><Th>Since</Th><Th>Due back</Th><Th /></tr></thead>
                <tbody>{out.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-medium">{i.asset.name}<p className="font-mono text-xs font-normal text-muted">{i.asset.tag}</p></Td>
                    <Td>{i.issuedTo}</Td><Td className="text-right tabular-nums">{i.quantity}</Td><Td className="whitespace-nowrap">{fmtDate(i.issuedAt)}</Td>
                    <Td className="whitespace-nowrap">{i.dueBack ? <span className={i.dueBack < today ? "font-medium text-danger" : ""}>{fmtDate(i.dueBack)}{i.dueBack < today && " · overdue"}</span> : "—"}</Td>
                    <Td className="text-right"><ActionButton action={returnAsset} fields={{ id: i.id }}>Returned</ActionButton></Td>
                  </tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Issue an item">
            <ActionForm action={issueAsset} className="space-y-3" resetOnSuccess>
                <Field label="Asset tag" name="tag"><input name="tag" className="input font-mono uppercase" list="asset-tags" required /></Field>
                <datalist id="asset-tags">{assets.slice(0, 200).map((a) => <option key={a.id} value={a.tag}>{a.name}</option>)}</datalist>
                <Field label="Issued to (name, class or lab)" name="issuedTo"><input name="issuedTo" className="input" required /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity" name="quantity"><input name="quantity" type="number" min={1} defaultValue={1} className="input" /></Field>
                  <Field label="Due back" name="dueBack"><input name="dueBack" type="date" className="input" /></Field>
                </div>
                <SubmitButton variant="secondary">Issue</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Add an asset">
            <ActionForm action={saveAsset} className="space-y-3" resetOnSuccess>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tag *" name="tag"><input name="tag" className="input font-mono uppercase" placeholder="CSE-LAB2-PC-014" required /></Field>
                  <Field label="Category *" name="category"><select name="category" className="input">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                </div>
                <Field label="Name *" name="name"><input name="name" className="input" placeholder="Desktop computer, i5 / 16 GB" required /></Field>
                <Field label="Room or lab *" name="location"><input name="location" className="input" placeholder="CSE Lab 2" required /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Quantity" name="quantity"><input name="quantity" type="number" min={1} defaultValue={1} className="input" /></Field>
                  <Field label="Cost each (₹)" name="cost"><input name="cost" type="number" min={0} className="input" /></Field>
                  <Field label="Bought on" name="purchaseDate"><input name="purchaseDate" type="date" className="input" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Condition" name="condition"><select name="condition" className="input">{Object.keys(TONE).map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
                  {user.role !== "HOD" && <Field label="Department" name="departmentId"><select name="departmentId" className="input"><option value="">College-wide</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select></Field>}
                </div>
                <SubmitButton>Add asset</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
