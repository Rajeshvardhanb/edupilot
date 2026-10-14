import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm } from "@/lib/scope";
import { batchOptions } from "@/lib/options";
import { attendanceSummary } from "@/lib/attendance";
import { getRules, toneFor } from "@/lib/rules";
import { batchLabel, pct } from "@/lib/format";
import { Badge, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { PrintButton } from "@/components/print-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { waLink } from "@/lib/whatsapp";
import { ActionButton } from "@/components/forms";
import { emailShortage } from "@/actions/alerts";
import { getInstitution } from "@/lib/institution";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Attendance shortage report" };

export default async function ShortageReport(props: PageProps<"/attendance/report">) {
  const rules = await getRules();
  const { attendanceRequired: ATTENDANCE_REQUIRED, attendanceCondonable: ATTENDANCE_CONDONABLE } = rules;
  const attendanceTone = toneFor(rules);
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const sp = await props.searchParams;
  const batches = await batchOptions(user.role === "ADMIN" ? undefined : user);
  const batchId = (typeof sp.batch === "string" && sp.batch) || batches[0]?.id;
  const threshold = Number(sp.below) || ATTENDANCE_REQUIRED;
  const term = await currentTerm();
  const college = (await getInstitution()).name;
  const batch = await db.batch.findUnique({
    where: { id: batchId ?? "-" },
    include: { program: true, students: { where: { status: { in: ["ACTIVE", "DETAINED"] } }, include: { user: true }, orderBy: { rollNo: "asc" } } },
  });
  const offerings = batch ? await db.courseOffering.findMany({ where: { batchId: batch.id, termId: term?.id }, include: { subject: true }, orderBy: { subject: { code: "asc" } } }) : [];
  const summary = await attendanceSummary({ offeringIds: offerings.map((o) => o.id) });

  const rows = (batch?.students ?? []).map((s) => {
    const per = offerings.map((o) => summary.get(`${s.id}:${o.id}`) ?? { attended: 0, total: 0 });
    const a = per.reduce((x, v) => x + v.attended, 0), t = per.reduce((x, v) => x + v.total, 0);
    return { s, per, overall: pct(a, t) };
  }).filter((r) => r.overall < threshold);

  return (
    <>
      <PageHeader
        title="Attendance shortage report"
        subtitle={`${term?.name} · students below ${threshold}% · condonation band ${ATTENDANCE_CONDONABLE}–${ATTENDANCE_REQUIRED}%`}
        actions={<>{batchId && threshold <= 100 && <ActionButton action={emailShortage} fields={{ batchId, below: String(threshold) }} size="md" confirm={`Email an attendance alert to every student below ${threshold}% in this batch, and to their parents?`}>Email alerts</ActionButton>}<PrintButton /></>}
      />
      <Filters>
        <select name="batch" aria-label="Batch" defaultValue={batchId} className="input w-auto">{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
        <select name="below" aria-label="Below" defaultValue={String(threshold)} className="input w-auto">
          {[...new Set([ATTENDANCE_REQUIRED, ATTENDANCE_CONDONABLE, 50, 101])].map((t) => <option key={t} value={t}>{t === 101 ? "All students" : `Below ${t}%`}</option>)}
        </select>
      </Filters>
      <SavedFilters storageKey="edupilot-filters-attendance-report" />
      <Card title={batch ? `${batchLabel(batch)} — ${rows.length} students` : "Report"}>
        {rows.length === 0 ? <EmptyState title="No students in this range" /> : (
          <Table>
            <thead>
              <tr><Th>Roll no</Th><Th>Name</Th>{offerings.map((o) => <Th key={o.id} className="text-center" ><span title={o.subject.name}>{o.subject.code}</span></Th>)}<Th className="text-right">Overall</Th><Th>Action</Th></tr>
            </thead>
            <tbody>
              {rows.map(({ s, per, overall }) => (
                <tr key={s.id}>
                  <Td className="font-mono text-xs">{s.rollNo}</Td>
                  <Td><Link href={`/students/${s.id}`} className="hover:text-brand">{s.user.name}</Link><p className="text-xs text-muted">{s.guardianPhone ?? ""}</p></Td>
                  {per.map((v, i) => { const p = pct(v.attended, v.total); return <Td key={i} className={`text-center text-xs tabular-nums ${p < ATTENDANCE_REQUIRED ? "font-semibold text-danger" : ""}`}>{p}</Td>; })}
                  <Td className="text-right"><Badge tone={attendanceTone(overall)}>{overall}%</Badge></Td>
                  <Td className="text-xs"><span className="flex items-center gap-2">{overall >= ATTENDANCE_REQUIRED ? "—" : overall >= ATTENDANCE_CONDONABLE ? "Condonation" : "Detain / notify parent"}{overall < ATTENDANCE_REQUIRED && <WhatsAppButton href={waLink(s.guardianPhone, `Dear Parent, ${s.user.name} (${s.rollNo}) has ${overall}% attendance this term. A minimum of ${ATTENDANCE_REQUIRED}% is required to appear for the end-semester exams. Kindly ensure regular attendance. — ${college}`)} label="Parent" text={`Dear Parent, ${s.user.name} (${s.rollNo}) has ${overall}% attendance this term. A minimum of ${ATTENDANCE_REQUIRED}% is required to appear for the end-semester exams. Kindly ensure regular attendance. — ${college}`} log={{ studentId: s.id, purpose: "ATTENDANCE" }} />}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
