import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchOptions } from "@/lib/options";
import { inr } from "@/lib/format";
import { generateInvoices, saveStructure } from "@/actions/fees";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";
import { FeeTabs } from "../tabs";

export const metadata = { title: "Fee structures" };

export default async function StructuresPage() {
  await requireUser(["ADMIN", "ACCOUNTANT"]);
  const [structures, programs, batches] = await Promise.all([
    db.feeStructure.findMany({ include: { items: true, program: true, _count: { select: { invoices: true } } }, orderBy: [{ academicYear: "desc" }, { program: { code: "asc" } }, { yearOfStudy: "asc" }] }),
    db.program.findMany({ orderBy: { code: "asc" } }),
    batchOptions(),
  ]);
  const year = new Date().getFullYear();
  return (
    <>
      <PageHeader title="Fees" subtitle="Fee structures per programme and year of study" />
      <FeeTabs active="/fees/structures" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Structures" className="lg:col-span-2">
          <Table>
            <thead><tr><Th>Structure</Th><Th>Heads</Th><Th className="text-right">Total</Th><Th className="text-right">Invoices</Th></tr></thead>
            <tbody>
              {structures.map((s) => (
                <tr key={s.id}>
                  <Td><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{s.program.code} · Year {s.yearOfStudy} · {s.academicYear}</p></Td>
                  <Td className="text-xs text-muted">{s.items.map((i) => `${i.head} ${inr(i.amount)}`).join(" · ")}</Td>
                  <Td className="text-right font-medium tabular-nums">{inr(s.items.reduce((t, i) => t + i.amount, 0))}</Td>
                  <Td className="text-right">{s._count.invoices}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-6">
          <Card title="Generate invoices for a batch">
            <ActionForm action={generateInvoices} className="space-y-3">
              <Field label="Fee structure" name="structureId"><select id="structureId" name="structureId" className="input" required>{structures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Batch" name="batchId"><select id="batchId" name="batchId" className="input" required>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Field>
              <Field label="Due date" name="dueDate"><input id="dueDate" name="dueDate" type="date" className="input" required /></Field>
              <SubmitButton>Generate</SubmitButton>
              <p className="text-xs text-muted">Students who already have an invoice for this structure are skipped.</p>
            </ActionForm>
          </Card>
          <Card title="New fee structure">
            <ActionForm action={saveStructure} className="space-y-3" resetOnSuccess>
              <Field label="Name" name="name"><input id="name" name="name" className="input" placeholder={`BTCSE — Year 1 (${year}-${String(year + 1).slice(2)})`} required /></Field>
              <Field label="Programme" name="programId"><select id="programId" name="programId" className="input" required>{programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Year of study" name="yearOfStudy"><input id="yearOfStudy" name="yearOfStudy" type="number" min={1} max={6} defaultValue={1} className="input" /></Field>
                <Field label="Academic year" name="academicYear"><input id="academicYear" name="academicYear" defaultValue={`${year}-${String(year + 1).slice(2)}`} className="input" /></Field>
              </div>
              <Field label="Fee heads (one per line)" name="items"><textarea id="items" name="items" rows={5} className="input font-mono text-xs" defaultValue={"Tuition Fee: 85000\nSpecial / Development Fee: 5000\nExamination Fee: 3500\nLibrary & Lab Fee: 4000"} /></Field>
              <SubmitButton>Create structure</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
