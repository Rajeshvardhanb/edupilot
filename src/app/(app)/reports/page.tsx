import { Download, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { programScope } from "@/lib/scope";
import { batchOptions } from "@/lib/options";
import { allowedDatasets, DATASETS } from "@/lib/reports";
import { Td, buttonClass } from "@/components/ui";
import { Card, EmptyState, PageHeader, Tabs, Th, Table } from "@/components/ui-server";
import { PrintButton } from "@/components/print-button";
import { REPORT_TABS } from "./tabs";

export const metadata = { title: "Report builder" };
const PREVIEW = 50;

export default async function ReportsPage(props: PageProps<"/reports">) {
  const user = await requireUser(["ADMIN", "HOD", "ACCOUNTANT"]);
  const sp = await props.searchParams;
  const datasets = allowedDatasets(user);
  const key = typeof sp.dataset === "string" && datasets.some(([k]) => k === sp.dataset) ? sp.dataset : datasets[0][0];
  const ds = DATASETS[key];
  const chosen = [sp.cols].flat().filter((c): c is string => typeof c === "string");
  const cols = ds.columns.filter((c) => (chosen.length ? chosen.includes(c.key) : c.default));
  const f = { program: typeof sp.program === "string" ? sp.program : "", batch: typeof sp.batch === "string" ? sp.batch : "", from: typeof sp.from === "string" ? sp.from : "", to: typeof sp.to === "string" ? sp.to : "" };
  const ran = sp.run === "1";
  const [programs, batches, rows] = await Promise.all([
    db.program.findMany({ where: programScope(user), orderBy: { code: "asc" } }),
    batchOptions(user.role === "HOD" ? user : undefined),
    ran ? ds.rows(user, f) : Promise.resolve([]),
  ]);
  const query = new URLSearchParams({ dataset: key, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
  cols.forEach((c) => query.append("cols", c.key));

  return (
    <>
      <PageHeader title="Reports" subtitle="Pick what you need, choose the columns, then download for Excel or as a PDF." />
      <Tabs active="/reports" items={REPORT_TABS} />
      <div className="grid gap-6 lg:grid-cols-4">
        <Card title="Build a report" className="no-print h-fit">
          <form className="space-y-4">
            <input type="hidden" name="run" value="1" />
            <div>
              <label className="label" htmlFor="dataset">Report on</label>
              <select id="dataset" name="dataset" defaultValue={key} className="input">{datasets.map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}</select>
              <p className="mt-1 text-xs text-muted">{ds.description}</p>
            </div>
            {ds.filters.includes("program") && <div><label className="label" htmlFor="program">Programme</label><select id="program" name="program" defaultValue={f.program} className="input"><option value="">All</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></div>}
            {ds.filters.includes("batch") && <div><label className="label" htmlFor="batch">Batch</label><select id="batch" name="batch" defaultValue={f.batch} className="input"><option value="">All</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>}
            {ds.filters.includes("dates") && <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="from">From</label><input id="from" type="date" name="from" defaultValue={f.from} className="input" /></div><div><label className="label" htmlFor="to">To</label><input id="to" type="date" name="to" defaultValue={f.to} className="input" /></div></div>}
            <fieldset>
              <legend className="label">Columns</legend>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                {ds.columns.map((c) => <label key={c.key} className="flex items-center gap-2 text-sm"><input type="checkbox" name="cols" value={c.key} defaultChecked={cols.some((x) => x.key === c.key)} /> {c.label}</label>)}
              </div>
            </fieldset>
            <button className={`${buttonClass("primary")} w-full`}>Run report</button>
            <p className="text-xs text-muted">Changing “Report on”? Run once to load that report&apos;s columns.</p>
          </form>
        </Card>
        <Card className="lg:col-span-3" title={ran ? `${ds.label} · ${rows.length.toLocaleString("en-IN")} rows` : ds.label}
          actions={ran && rows.length > 0 && <span className="no-print flex gap-2"><a className={buttonClass("secondary", "sm")} href={`/reports/export?${query}&format=csv`}><Download className="size-3.5" /> Excel (CSV)</a><a className={buttonClass("secondary", "sm")} href={`/reports/export?${query}&format=pdf`}><FileText className="size-3.5" /> PDF</a><PrintButton /></span>}>
          {!ran ? <EmptyState title="Choose a report and columns, then press Run report" /> : rows.length === 0 ? <EmptyState title="No rows match" /> : (
            <>
              <Table>
                <thead><tr>{cols.map((c) => <Th key={c.key}>{c.label}</Th>)}</tr></thead>
                <tbody>{rows.slice(0, PREVIEW).map((r, i) => <tr key={i}>{cols.map((c) => <Td key={c.key} className="text-xs whitespace-nowrap">{r[c.key]}</Td>)}</tr>)}</tbody>
              </Table>
              {rows.length > PREVIEW && <p className="no-print mt-3 text-xs text-muted">Showing the first {PREVIEW} rows. The downloads contain all {rows.length.toLocaleString("en-IN")}.</p>}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
