import { notFound } from "next/navigation";
import type { ProgramLevel } from "@prisma/client";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentStandings } from "@/lib/results";
import { ineligibility } from "@/lib/placements";
import { batchLabel, fmtDate, titleCase } from "@/lib/format";
import { setApplicationStatus, setDriveStatus } from "@/actions/placements";
import { advanceRound, saveRounds } from "@/actions/campus";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionButton } from "@/components/forms";
import { Badge, Td } from "@/components/ui";
import { Card, PageHeader, StatCard, Th, Table } from "@/components/ui-server";
import { getRules } from "@/lib/rules";

export const metadata = { title: "Placement drive" };

export default async function DrivePage(props: PageProps<"/placements/[driveId]">) {
  await requireUser(["ADMIN", "HOD"]);
  const { driveId } = await props.params;
  const drive = await db.placementDrive.findUnique({
    where: { id: driveId },
    include: { company: true, rounds: { orderBy: { position: "asc" } }, applications: { include: { student: { include: { user: true, batch: { include: { program: true } } } } }, orderBy: { appliedAt: "asc" } } },
  });
  if (!drive) notFound();
  const candidates = await db.student.findMany({ where: { status: "ACTIVE", batch: { program: { level: { in: drive.eligibleLevels.split(",") as ProgramLevel[] } } } }, include: { batch: { include: { program: true } } } });
  const rules = await getRules();
  const standings = await studentStandings([...new Set([...candidates.map((c) => c.id), ...drive.applications.map((a) => a.studentId)])]);
  const eligible = candidates.filter((c) => !ineligibility(drive, c, standings.get(c.id)!, rules.placementSemestersLeft)).length;

  return (
    <>
      <Breadcrumbs items={[{ label: "Placements", href: "/placements" }, { label: drive.company.name }]} />
      <PageHeader
        title={`${drive.company.name} — ${drive.role}`}
        subtitle={`${drive.ctcLpa} LPA · ${fmtDate(drive.driveDate)} · CGPA ≥ ${drive.minCgpa}, ≤ ${drive.maxBacklogs} backlogs · ${drive.eligibleLevels}`}
        actions={["UPCOMING", "OPEN", "CLOSED", "COMPLETED"].filter((s) => s !== drive.status).map((s) => (
          <ActionButton key={s} action={setDriveStatus} fields={{ id: drive.id, status: s }}>Mark {titleCase(s)}</ActionButton>
        ))}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Eligible students" value={eligible} />
        <StatCard label="Applied" value={drive.applications.length} tone="info" />
        <StatCard label="Shortlisted" value={drive.applications.filter((a) => a.status === "SHORTLISTED").length} tone="warning" />
        <StatCard label="Selected" value={drive.applications.filter((a) => a.status === "SELECTED").length} tone="success" />
      </div>
      {drive.description && <Card className="mt-6"><p className="text-sm whitespace-pre-line">{drive.description}</p></Card>}
      <Card title="Interview rounds" className="mt-6">
        {drive.rounds.length > 0 && (
          <ol className="mb-4 flex flex-wrap gap-2">{drive.rounds.map((r) => <li key={r.id} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">{r.position}. {r.name} · {drive.applications.filter((a) => a.roundNo >= r.position).length} cleared</li>)}</ol>
        )}
        <ActionForm action={saveRounds} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="driveId" value={drive.id} />
          <div className="min-w-64 flex-1"><label className="label" htmlFor="rounds">Rounds, one per line</label><textarea id="rounds" name="rounds" rows={3} className="input text-xs" defaultValue={drive.rounds.map((r) => r.name).join("\n") || "Online assessment\nTechnical interview\nHR interview"} /></div>
          <SubmitButton variant="secondary">Save rounds</SubmitButton>
        </ActionForm>
      </Card>
      <Card title="Applicants" className="mt-6">
        <Table>
          <thead><tr><Th>Roll no</Th><Th>Name</Th><Th>Batch</Th><Th className="text-right">CGPA</Th><Th className="text-right">Backlogs</Th><Th>Round</Th><Th>Status</Th><Th>Update</Th></tr></thead>
          <tbody>
            {drive.applications.map((a) => {
              const st = standings.get(a.studentId)!;
              return (
                <tr key={a.id}>
                  <Td className="font-mono text-xs">{a.student.rollNo}</Td>
                  <Td><Link href={`/students/${a.studentId}`} className="hover:text-brand">{a.student.user.name}</Link></Td>
                  <Td>{batchLabel(a.student.batch)}</Td>
                  <Td className="text-right tabular-nums">{st.cgpa.toFixed(2)}</Td>
                  <Td className="text-right">{st.backlogs}</Td>
                  <Td className="text-xs">{drive.rounds.length ? (a.roundNo >= drive.rounds.length ? "All cleared" : `Next: ${drive.rounds[a.roundNo]?.name}`) : "—"}</Td>
                  <Td><Badge tone={a.status === "SELECTED" ? "success" : a.status === "REJECTED" ? "danger" : a.status === "SHORTLISTED" ? "warning" : "info"}>{titleCase(a.status)}</Badge></Td>
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {drive.rounds.length > 0 && a.status !== "REJECTED" && a.roundNo < drive.rounds.length ? (
                        <>
                          <ActionButton action={advanceRound} fields={{ id: a.id, result: "pass" }} variant="secondary">Cleared {drive.rounds[a.roundNo].name.split(" ")[0]}</ActionButton>
                          <ActionButton action={advanceRound} fields={{ id: a.id, result: "fail" }} variant="ghost">Not cleared</ActionButton>
                        </>
                      ) : (["SHORTLISTED", "SELECTED", "REJECTED"] as const).filter((s) => s !== a.status).map((s) => (
                        <ActionButton key={s} action={setApplicationStatus} fields={{ id: a.id, status: s }} variant="ghost">{titleCase(s)}</ActionButton>
                      ))}
                      {a.status === "SELECTED" && <Link href={`/placements/offer/${a.id}`} className="text-xs text-brand">Offer letter</Link>}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {drive.applications.length === 0 && <p className="text-sm text-muted">No applications yet.</p>}
      </Card>
    </>
  );
}
