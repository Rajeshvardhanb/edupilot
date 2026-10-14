import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, titleCase } from "@/lib/format";
import { deleteAchievement, saveAchievement } from "@/actions/staff";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Tabs, Th, Table } from "@/components/ui-server";
import { Filters } from "@/components/filters";
import { PrintButton } from "@/components/print-button";
import { staffTabs } from "../tabs";
import { SavedFilters } from "@/components/saved-filters";

export const metadata = { title: "Appraisal records" };
const KINDS = ["PUBLICATION", "CONFERENCE", "WORKSHOP", "FDP", "PATENT", "FUNDED_PROJECT", "AWARD"] as const;
const LABEL: Record<string, string> = { PUBLICATION: "Journal publication", CONFERENCE: "Conference paper", WORKSHOP: "Workshop / seminar", FDP: "Faculty development programme", PATENT: "Patent", FUNDED_PROJECT: "Funded project", AWARD: "Award / recognition" };

export default async function AchievementsPage(props: PageProps<"/staff/achievements">) {
  const user = await requireUser(["ADMIN", "HOD", "FACULTY"]);
  const sp = await props.searchParams;
  const year = Number(sp.year) || 0;
  const scope = user.role === "ADMIN" ? {} : user.role === "HOD" && sp.view !== "mine" ? { faculty: { departmentId: user.departmentId ?? "-" } } : { facultyId: user.facultyId ?? "-" };
  const rows = await db.achievement.findMany({
    where: { ...scope, ...(year && { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } }) },
    include: { faculty: { include: { user: { select: { name: true } }, department: true } } }, orderBy: { date: "desc" },
  });
  const count = (k: string) => rows.filter((r) => r.kind === k).length;
  const thisYear = new Date().getFullYear();
  return (
    <>
      <PageHeader title="Staff" subtitle="Publications, conferences, FDPs, patents and funded projects, ready for appraisal and accreditation files" actions={<PrintButton />} />
      <Tabs active="/staff/achievements" items={staffTabs(user.role)} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Publications" value={count("PUBLICATION") + count("CONFERENCE")} /><StatCard label="FDPs & workshops" value={count("FDP") + count("WORKSHOP")} tone="info" />
        <StatCard label="Patents & projects" value={count("PATENT") + count("FUNDED_PROJECT")} tone="success" /><StatCard label="Awards" value={count("AWARD")} tone="warning" />
      </div>
      <Filters>
        <select name="year" aria-label="Year" defaultValue={year ? String(year) : ""} className="input w-auto"><option value="">All years</option>{[0, 1, 2, 3, 4].map((i) => <option key={i} value={thisYear - i}>{thisYear - i}</option>)}</select>
        {user.role === "HOD" && <select name="view" aria-label="View" defaultValue={String(sp.view ?? "")} className="input w-auto"><option value="">Whole department</option><option value="mine">Only mine</option></select>}
      </Filters>
      <SavedFilters storageKey="edupilot-filters-staff-achievements" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={user.facultyId ? "lg:col-span-2" : "lg:col-span-3"} title={`${rows.length} records`}>
          {rows.length === 0 ? <EmptyState title="No records yet" /> : (
            <Table>
              <thead><tr><Th>Date</Th><Th>Record</Th><Th>Type</Th>{user.role !== "FACULTY" && <Th>Faculty</Th>}<Th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                  <Td><p className="font-medium">{r.title} {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="no-print inline-block align-middle text-brand"><ExternalLink className="size-3.5" /></a>}</p><p className="text-xs text-muted">{r.venue}{r.details && ` · ${r.details}`}</p></Td>
                  <Td><Badge tone={r.kind === "PATENT" || r.kind === "FUNDED_PROJECT" ? "success" : r.kind === "AWARD" ? "warning" : "brand"}>{LABEL[r.kind] ?? titleCase(r.kind)}</Badge></Td>
                  {user.role !== "FACULTY" && <Td>{r.faculty.user.name}<p className="text-xs text-muted">{r.faculty.department.code}</p></Td>}
                  <Td className="no-print">{(user.role === "ADMIN" || r.facultyId === user.facultyId) && <ActionButton action={deleteAchievement} fields={{ id: r.id }} variant="ghost" undoable={`Removing “${r.title.slice(0, 40)}”`}>×</ActionButton>}</Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
        {user.facultyId && (
          <Card title="Add a record" className="no-print h-fit">
            <ActionForm action={saveAchievement} className="space-y-3" resetOnSuccess>
              <Field label="Type" name="kind"><select id="kind" name="kind" className="input">{KINDS.map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</select></Field>
              <Field label="Title" name="title"><input id="title" name="title" className="input" required /></Field>
              <Field label="Journal / conference / organiser / agency" name="venue"><input id="venue" name="venue" className="input" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" name="date"><input id="date" type="date" name="date" className="input" required /></Field>
                <Field label="Link (DOI, certificate)" name="url"><input id="url" name="url" className="input" placeholder="https://…" /></Field>
              </div>
              <Field label="Details (indexing, amount, co-authors)" name="details"><input id="details" name="details" className="input" /></Field>
              <SubmitButton>Add</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
