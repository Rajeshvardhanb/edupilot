import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveTerm, setCurrentTerm, deleteRecord } from "@/actions/academics";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field, Td } from "@/components/ui";
import { Card, PageHeader, Th, Table } from "@/components/ui-server";
import { fmtDate, isoDate } from "@/lib/format";
import { AcademicsTabs } from "../tabs";

export const metadata = { title: "Academic terms" };

export default async function TermsPage(props: PageProps<"/academics/terms">) {
  const user = await requireUser(["ADMIN", "HOD"]);
  const { edit } = await props.searchParams;
  const terms = await db.term.findMany({ include: { _count: { select: { offerings: true } } }, orderBy: { startDate: "desc" } });
  const e = terms.find((t) => t.id === edit);
  return (
    <>
      <PageHeader title="Academics" subtitle="Semester calendar. The current term drives attendance, timetable and dashboards." />
      <AcademicsTabs active="/academics/terms" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Terms">
          <Table>
            <thead><tr><Th>Term</Th><Th>Start</Th><Th>End</Th><Th className="text-right">Courses</Th><Th /></tr></thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id}>
                  <Td className="font-medium">{t.name} {t.isCurrent && <Badge tone="success">Current</Badge>}</Td>
                  <Td>{fmtDate(t.startDate)}</Td><Td>{fmtDate(t.endDate)}</Td>
                  <Td className="text-right">{t._count.offerings}</Td>
                  <Td className="text-right whitespace-nowrap">{user.role === "ADMIN" && (
                    <span className="inline-flex items-center gap-2">
                      {!t.isCurrent && <ActionButton action={setCurrentTerm} fields={{ id: t.id }}>Make current</ActionButton>}
                      <Link href={`/academics/terms?edit=${t.id}`} className="text-xs text-brand">Edit</Link>
                      <ActionButton action={deleteRecord} fields={{ model: "term", id: t.id }} variant="ghost" confirm="Delete this term?">Delete</ActionButton>
                    </span>
                  )}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        {user.role === "ADMIN" && (
          <Card title={e ? "Edit term" : "Add term"}>
            <ActionForm key={e?.id ?? "new"} action={saveTerm} className="space-y-4" resetOnSuccess={!e}>
              {e && <input type="hidden" name="id" value={e.id} />}
              <Field label="Name" name="name"><input id="name" name="name" defaultValue={e?.name} className="input" placeholder="2026-27 Even Semester" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start" name="startDate"><input id="startDate" name="startDate" type="date" defaultValue={isoDate(e?.startDate)} className="input" required /></Field>
                <Field label="End" name="endDate"><input id="endDate" name="endDate" type="date" defaultValue={isoDate(e?.endDate)} className="input" required /></Field>
              </div>
              <SubmitButton>{e ? "Save" : "Add term"}</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
