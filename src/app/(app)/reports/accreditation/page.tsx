import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { programScope } from "@/lib/scope";
import { pct, yearsSince } from "@/lib/format";
import { Td } from "@/components/ui";
import { Card, PageHeader, Tabs, Th, Table } from "@/components/ui-server";
import { PrintButton } from "@/components/print-button";
import { Letterhead } from "@/components/letterhead";
import { reportTabs } from "../tabs";

export const metadata = { title: "Accreditation data" };
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

export default async function AccreditationPage() {
  const user = await requireUser(["ADMIN", "HOD"]);
  const pScope = programScope(user);
  const dScope = user.role === "HOD" ? { id: user.departmentId ?? "-" } : {};
  const [programs, depts, results, selected, achievements] = await Promise.all([
    db.program.findMany({ where: pScope, include: { batches: { include: { students: { select: { id: true, gender: true, category: true, status: true, admissionType: true } } } } }, orderBy: { code: "asc" } }),
    db.department.findMany({ where: dScope, include: { faculty: { select: { qualification: true, designation: true, joiningDate: true } }, programs: { select: { batches: { select: { _count: { select: { students: { where: { status: "ACTIVE" } } } } } } } } }, orderBy: { code: "asc" } }),
    db.subjectResult.findMany({ where: { offering: { batch: { program: pScope } } }, select: { passed: true, studentId: true, offering: { select: { termId: true, term: { select: { name: true, startDate: true } }, batch: { select: { program: { select: { code: true } } } } } } } }),
    db.placementApplication.findMany({ where: { status: "SELECTED", student: { batch: { program: pScope } } }, select: { studentId: true, drive: { select: { ctcLpa: true } }, student: { select: { batch: { select: { program: { select: { code: true } } } } } } } }),
    db.achievement.groupBy({ by: ["kind", "facultyId"], _count: true }),
  ]);
  const facultyDept = new Map((await db.faculty.findMany({ where: user.role === "HOD" ? { departmentId: user.departmentId ?? "-" } : {}, select: { id: true, department: { select: { code: true } } } })).map((f) => [f.id, f.department.code]));

  // Results: per programme per term — students appeared and students who passed every subject.
  const res = new Map<string, { term: string; start: Date; code: string; students: Map<string, boolean> }>();
  for (const r of results) {
    const k = `${r.offering.batch.program.code}|${r.offering.termId}`;
    const x = res.get(k) ?? { term: r.offering.term.name, start: r.offering.term.startDate, code: r.offering.batch.program.code, students: new Map() };
    x.students.set(r.studentId, (x.students.get(r.studentId) ?? true) && r.passed);
    res.set(k, x);
  }
  const resultRows = [...res.values()].sort((a, b) => a.code.localeCompare(b.code) || a.start.getTime() - b.start.getTime());
  const best = new Map<string, { code: string; ctc: number }>();
  for (const s of selected) { const cur = best.get(s.studentId); if (!cur || s.drive.ctcLpa > cur.ctc) best.set(s.studentId, { code: s.student.batch.program.code, ctc: s.drive.ctcLpa }); }
  const kinds = ["PUBLICATION", "CONFERENCE", "PATENT", "FUNDED_PROJECT", "FDP", "WORKSHOP", "AWARD"] as const;
  const contrib = new Map<string, Record<string, number>>();
  for (const a of achievements) { const d = facultyDept.get(a.facultyId); if (!d) continue; const x = contrib.get(d) ?? {}; x[a.kind] = (x[a.kind] ?? 0) + a._count; contrib.set(d, x); }

  return (
    <>
      <PageHeader title="Reports" subtitle="Figures commonly asked for in AICTE, NAAC and NBA submissions. Print this page or copy the numbers into the official forms." actions={<PrintButton />} />
      <Tabs active="/reports/accreditation" items={reportTabs(user.role)} />
      <div className="mb-6 hidden print:block"><Letterhead title="Accreditation data" /></div>
      <p className="no-print mb-6 rounded-xl bg-surface-2 px-4 py-3 text-xs text-muted">These tables are computed live from the records in this system. They are data sheets, not the agencies&apos; official templates: check each figure against the definition in the form you are filling.</p>
      <div className="space-y-6">
        <Card title="1 · Student strength (sanctioned intake and admitted)">
          <Table>
            <thead><tr><Th>Programme</Th><Th>Admission year</Th><Th className="text-right">Sanctioned intake</Th><Th className="text-right">Admitted</Th><Th className="text-right">Lateral entry</Th><Th className="text-right">Male</Th><Th className="text-right">Female</Th><Th className="text-right">SC / ST</Th><Th className="text-right">OBC</Th><Th className="text-right">EWS</Th><Th className="text-right">Currently active</Th></tr></thead>
            <tbody>{programs.flatMap((p) => [...new Set(p.batches.map((b) => b.admissionYear))].sort((a, b) => b - a).map((y) => {
              const st = p.batches.filter((b) => b.admissionYear === y).flatMap((b) => b.students);
              const n = (f: (s: (typeof st)[number]) => boolean) => st.filter(f).length;
              return (
                <tr key={`${p.id}${y}`}><Td className="font-medium">{p.code}</Td><Td>{y}</Td><Td className="text-right">{p.intake}</Td><Td className="text-right">{st.length} <span className="text-xs text-muted">({pct(st.length, p.intake)}%)</span></Td><Td className="text-right">{n((s) => s.admissionType === "LATERAL")}</Td>
                  <Td className="text-right">{n((s) => s.gender === "MALE")}</Td><Td className="text-right">{n((s) => s.gender === "FEMALE")}</Td><Td className="text-right">{n((s) => s.category === "SC" || s.category === "ST")}</Td><Td className="text-right">{n((s) => s.category === "OBC")}</Td><Td className="text-right">{n((s) => s.category === "EWS")}</Td><Td className="text-right">{n((s) => s.status === "ACTIVE")}</Td></tr>
              );
            }))}</tbody>
          </Table>
        </Card>
        <Card title="2 · Faculty (cadre, qualification, student–faculty ratio)">
          <Table>
            <thead><tr><Th>Department</Th><Th className="text-right">Faculty</Th><Th className="text-right">Professors</Th><Th className="text-right">Associate</Th><Th className="text-right">Assistant / other</Th><Th className="text-right">With Ph.D</Th><Th className="text-right">Avg. experience (yrs)</Th><Th className="text-right">Active students</Th><Th className="text-right">Student : faculty</Th></tr></thead>
            <tbody>{depts.map((d) => {
              const f = d.faculty, students = d.programs.flatMap((p) => p.batches).reduce((s, b) => s + b._count.students, 0);
              const prof = f.filter((x) => x.designation === "Professor").length, assoc = f.filter((x) => x.designation.startsWith("Associate")).length;
              return (
                <tr key={d.id}><Td className="font-medium">{d.code} <span className="text-xs font-normal text-muted">{d.name}</span></Td><Td className="text-right">{f.length}</Td><Td className="text-right">{prof}</Td><Td className="text-right">{assoc}</Td><Td className="text-right">{f.length - prof - assoc}</Td>
                  <Td className="text-right">{f.filter((x) => /ph\.?\s?d/i.test(x.qualification ?? "")).length} <span className="text-xs text-muted">({pct(f.filter((x) => /ph\.?\s?d/i.test(x.qualification ?? "")).length, f.length)}%)</span></Td>
                  <Td className="text-right">{f.length ? (f.reduce((s, x) => s + yearsSince(x.joiningDate), 0) / f.length).toFixed(1) : "—"}</Td><Td className="text-right">{students}</Td><Td className="text-right">{f.length ? `${Math.round(students / f.length)} : 1` : "—"}</Td></tr>
              );
            })}</tbody>
          </Table>
        </Card>
        <Card title="3 · Examination results (students passing all subjects in a term)">
          <Table>
            <thead><tr><Th>Programme</Th><Th>Term</Th><Th className="text-right">Appeared</Th><Th className="text-right">Passed all subjects</Th><Th className="text-right">Pass %</Th></tr></thead>
            <tbody>{resultRows.map((r) => { const passed = [...r.students.values()].filter(Boolean).length; return <tr key={r.code + r.term}><Td className="font-medium">{r.code}</Td><Td>{r.term}</Td><Td className="text-right">{r.students.size}</Td><Td className="text-right">{passed}</Td><Td className="text-right">{pct(passed, r.students.size)}%</Td></tr>; })}</tbody>
          </Table>
        </Card>
        <Card title="4 · Placements (pre-final and final-year students)">
          <Table>
            <thead><tr><Th>Programme</Th><Th className="text-right">Eligible students</Th><Th className="text-right">Placed</Th><Th className="text-right">Placement %</Th><Th className="text-right">Highest (LPA)</Th><Th className="text-right">Median (LPA)</Th><Th className="text-right">Average (LPA)</Th></tr></thead>
            <tbody>{programs.map((p) => {
              const eligible = p.batches.filter((b) => b.currentSemester >= p.totalSemesters - 3).flatMap((b) => b.students).filter((s) => s.status === "ACTIVE" || s.status === "GRADUATED");
              const offers = eligible.map((s) => best.get(s.id)?.ctc).filter((x): x is number => !!x);
              if (!eligible.length) return null;
              return <tr key={p.id}><Td className="font-medium">{p.code}</Td><Td className="text-right">{eligible.length}</Td><Td className="text-right">{offers.length}</Td><Td className="text-right">{pct(offers.length, eligible.length)}%</Td><Td className="text-right">{offers.length ? Math.max(...offers) : "—"}</Td><Td className="text-right">{offers.length ? median(offers) : "—"}</Td><Td className="text-right">{offers.length ? (offers.reduce((a, b) => a + b, 0) / offers.length).toFixed(2) : "—"}</Td></tr>;
            })}</tbody>
          </Table>
        </Card>
        <Card title="5 · Faculty contributions (from appraisal records)">
          <Table>
            <thead><tr><Th>Department</Th>{["Journal papers", "Conference papers", "Patents", "Funded projects", "FDPs", "Workshops", "Awards"].map((h) => <Th key={h} className="text-right">{h}</Th>)}</tr></thead>
            <tbody>{depts.map((d) => <tr key={d.id}><Td className="font-medium">{d.code}</Td>{kinds.map((k) => <Td key={k} className="text-right">{contrib.get(d.code)?.[k] ?? 0}</Td>)}</tr>)}</tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
