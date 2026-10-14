import { banner } from "@/lib/images";
import Link from "next/link";
import { Briefcase, Building2, IndianRupee, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentStandings } from "@/lib/results";
import { ineligibility } from "@/lib/placements";
import { fmtDate, titleCase } from "@/lib/format";
import { applyToDrive, createDrive, withdrawApplication } from "@/actions/placements";
import { saveResume } from "@/actions/services";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td, type Tone } from "@/components/ui";
import { Card, StatCard, Th, Table } from "@/components/ui-server";
import { Hero } from "@/components/hero";
import { CareerIllustration } from "@/components/illustrations";
import { getRules } from "@/lib/rules";

export const metadata = { title: "Placements" };
const DRIVE_TONE: Record<string, Tone> = { OPEN: "success", UPCOMING: "info", CLOSED: "neutral", COMPLETED: "brand" };
const APP_TONE: Record<string, Tone> = { APPLIED: "info", SHORTLISTED: "warning", SELECTED: "success", REJECTED: "danger" };

export default async function PlacementsPage() {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT"]);
  const drives = await db.placementDrive.findMany({
    include: { company: true, applications: { select: { id: true, studentId: true, status: true } } },
    orderBy: { driveDate: "desc" },
  });
  const selected = await db.placementApplication.findMany({ where: { status: "SELECTED" }, include: { drive: true } });
  const placedStudents = new Set(selected.map((s) => s.studentId)).size;
  const highest = Math.max(0, ...selected.map((s) => s.drive.ctcLpa));
  const avg = selected.length ? Math.round((selected.reduce((t, s) => t + s.drive.ctcLpa, 0) / selected.length) * 10) / 10 : 0;

  // Programme-wise report: best offer per placed student.
  const programs = user.role === "STUDENT" ? [] : await db.program.findMany({
    include: { batches: { include: { students: { where: { status: "ACTIVE" }, select: { id: true } } } } }, orderBy: { code: "asc" },
  });
  const bestOffer = new Map<string, number>();
  for (const s of selected) bestOffer.set(s.studentId, Math.max(bestOffer.get(s.studentId) ?? 0, s.drive.ctcLpa));
  const report = programs.map((p) => {
    const senior = p.batches.filter((b) => b.currentSemester >= p.totalSemesters - 3).flatMap((b) => b.students.map((s) => s.id));
    const offers = senior.map((id) => bestOffer.get(id)).filter((x): x is number => !!x);
    return { code: p.code, eligible: senior.length, placed: offers.length, max: offers.length ? Math.max(...offers) : 0, avg: offers.length ? Math.round((offers.reduce((a, b) => a + b, 0) / offers.length) * 10) / 10 : 0 };
  }).filter((r) => r.eligible > 0);

  const student = user.role === "STUDENT"
    ? await db.student.findUniqueOrThrow({ where: { id: user.studentId! }, include: { batch: { include: { program: true } } } })
    : null;
  const rules = await getRules();
  const standing = student ? (await studentStandings([student.id])).get(student.id)! : null;

  return (
    <>
      <Hero
        eyebrow="Training & Placement Cell"
        title={student ? "Launch your career" : "Campus recruitment"}
        subtitle={student ? <>Your CGPA <b>{standing!.cgpa.toFixed(2)}</b> · <b>{standing!.backlogs}</b> active backlog(s). Eligibility for each drive is checked automatically.</> : <>{drives.filter((d) => d.status === "OPEN").length} drives open now · {placedStudents} students placed this season</>}
        {...banner("placements")}
        art={<CareerIllustration className="w-full [--brand-soft:rgba(255,255,255,.15)] [--brand:#ffffff] [--brand-2:#c7d2fe] [--surface:#ffffff]" />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students placed" value={placedStudents} icon={<Trophy className="size-4" />} tone="success" />
        <StatCard label="Offers" value={selected.length} icon={<Briefcase className="size-4" />} />
        <StatCard label="Highest CTC" value={`${highest} LPA`} icon={<IndianRupee className="size-4" />} tone="warning" />
        <StatCard label="Average CTC" value={`${avg} LPA`} icon={<Building2 className="size-4" />} tone="info" hint={`${new Set(drives.map((d) => d.companyId)).size} recruiters`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Drives" className={user.role === "STUDENT" ? "lg:col-span-3" : "lg:col-span-2"}>
          <Table>
            <thead><tr><Th>Company / role</Th><Th>CTC</Th><Th>Date</Th><Th>Eligibility</Th><Th>Status</Th><Th>{student ? "Your application" : "Applicants"}</Th></tr></thead>
            <tbody>
              {drives.map((d) => {
                const mine = student && d.applications.find((a) => a.studentId === student.id);
                const reason = student && ineligibility(d, student, standing!, rules.placementSemestersLeft);
                return (
                  <tr key={d.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white">{d.company.name[0]}</span>
                        <div>{user.role === "STUDENT" ? <p className="font-medium">{d.company.name}</p> : <Link href={`/placements/${d.id}`} className="font-medium hover:text-brand">{d.company.name}</Link>}<p className="text-xs text-muted">{d.role}{d.company.industry && ` · ${d.company.industry}`}</p></div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{d.ctcLpa} LPA</Td>
                    <Td className="whitespace-nowrap">{fmtDate(d.driveDate)}</Td>
                    <Td className="text-xs">CGPA ≥ {d.minCgpa} · ≤{d.maxBacklogs} backlogs<br /><span className="text-muted">{d.eligibleLevels.replace(",", ", ")}</span></Td>
                    <Td><Badge tone={DRIVE_TONE[d.status]}>{titleCase(d.status)}</Badge></Td>
                    <Td>
                      {student ? (
                        mine ? (
                          <span className="flex items-center gap-2"><Badge tone={APP_TONE[mine.status]}>{titleCase(mine.status)}</Badge>{mine.status === "SELECTED" && <Link href={`/placements/offer/${mine.id}`} className="text-xs text-brand">Offer letter</Link>}{mine.status === "APPLIED" && d.status === "OPEN" && <ActionButton action={withdrawApplication} fields={{ driveId: d.id }} variant="ghost">Withdraw</ActionButton>}</span>
                        ) : d.status !== "OPEN" ? <span className="text-xs text-muted">—</span>
                          : reason ? <span className="text-xs text-danger">{reason}</span>
                          : <ActionButton action={applyToDrive} fields={{ driveId: d.id }} variant="primary">Apply</ActionButton>
                      ) : (
                        <span className="text-xs">{d.applications.length} applied · <b className="text-success">{d.applications.filter((a) => a.status === "SELECTED").length}</b> selected</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        {student && (
          <Card title="My placement profile" className="lg:col-span-3">
            <ActionForm action={saveResume} className="grid gap-4 md:grid-cols-2">
              <Field label="About me (shown to the placement cell)" name="about" className="md:col-span-2"><textarea id="about" name="about" rows={3} defaultValue={student.about ?? ""} className="input" placeholder="Final-year CSE student interested in backend engineering…" /></Field>
              <Field label="Skills (comma separated)" name="skills" className="md:col-span-2"><input id="skills" name="skills" defaultValue={student.skills ?? ""} className="input" placeholder="Java, Spring Boot, SQL, React" /></Field>
              <Field label="LinkedIn" name="linkedin"><input id="linkedin" name="linkedin" defaultValue={student.linkedin ?? ""} className="input" placeholder="https://linkedin.com/in/…" /></Field>
              <Field label="GitHub / portfolio" name="github"><input id="github" name="github" defaultValue={student.github ?? ""} className="input" placeholder="https://github.com/…" /></Field>
              <div><SubmitButton>Save profile</SubmitButton></div>
            </ActionForm>
          </Card>
        )}
        {user.role !== "STUDENT" && (
          <Card title="Publish a drive">
            <ActionForm action={createDrive} className="space-y-3" resetOnSuccess>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company" name="company"><input id="company" name="company" className="input" required /></Field>
                <Field label="Industry" name="industry"><input id="industry" name="industry" className="input" placeholder="IT Services" /></Field>
              </div>
              <Field label="Role" name="role"><input id="role" name="role" className="input" placeholder="Graduate Engineer Trainee" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CTC (LPA)" name="ctcLpa"><input id="ctcLpa" name="ctcLpa" type="number" step="0.1" className="input" required /></Field>
                <Field label="Drive date" name="driveDate"><input id="driveDate" name="driveDate" type="date" className="input" required /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min CGPA" name="minCgpa"><input id="minCgpa" name="minCgpa" type="number" step="0.1" defaultValue={6} className="input" /></Field>
                <Field label="Max backlogs" name="maxBacklogs"><input id="maxBacklogs" name="maxBacklogs" type="number" defaultValue={0} className="input" /></Field>
              </div>
              <fieldset className="flex gap-4 text-sm">
                {["UG", "DIPLOMA", "PG"].map((l) => <label key={l} className="flex items-center gap-1.5"><input type="checkbox" name="levels" value={l} defaultChecked={l === "UG"} /> {l}</label>)}
              </fieldset>
              <Field label="Description" name="description"><textarea id="description" name="description" rows={3} className="input" /></Field>
              <SubmitButton>Publish drive</SubmitButton>
            </ActionForm>
          </Card>
        )}
        {user.role !== "STUDENT" && (
          <Card title="Placement report by programme" className="lg:col-span-3">
            <Table>
              <thead><tr><Th>Programme</Th><Th className="text-right">Final / pre-final students</Th><Th className="text-right">Placed</Th><Th className="text-right">Placement %</Th><Th className="text-right">Highest CTC</Th><Th className="text-right">Average CTC</Th></tr></thead>
              <tbody>{report.map((r) => (
                <tr key={r.code}><Td className="font-medium">{r.code}</Td><Td className="text-right">{r.eligible}</Td><Td className="text-right">{r.placed}</Td><Td className="text-right">{r.eligible ? Math.round((r.placed / r.eligible) * 100) : 0}%</Td><Td className="text-right">{r.max ? `${r.max} LPA` : "—"}</Td><Td className="text-right">{r.avg ? `${r.avg} LPA` : "—"}</Td></tr>
              ))}</tbody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
