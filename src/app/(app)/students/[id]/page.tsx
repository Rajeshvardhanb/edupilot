import { logParentContact } from "@/actions/contacts";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Phone, Mail, MapPin, User } from "lucide-react";
import { isLearner, isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, studentScope } from "@/lib/scope";
import { attendanceSummary } from "@/lib/attendance";
import { getRules, toneFor } from "@/lib/rules";
import { invoiceStatus, statusTone } from "@/lib/fees";
import { batchLabel, fmtDate, fmtDateTime, inr, pct, titleCase } from "@/lib/format";
import { Badge, Field, LinkButton, Progress, Td } from "@/components/ui";
import { Card, Th, Table } from "@/components/ui-server";
import { AcademicRecord } from "@/components/academic-record";
import { Avatar } from "@/components/avatar";
import { PhotoUpload } from "@/components/photo-upload";
import { STATUS_TONE } from "../filter";
import { AttendanceHeatmap } from "@/components/attendance-heatmap";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createParentLogin } from "@/actions/services";
import { updateStudentContact } from "@/actions/students";
import { InlineEdit } from "@/components/inline-edit";

export const metadata = { title: "Student profile" };

const CONTACT_TONE: Record<string, "success" | "info" | "brand" | "warning"> = { WHATSAPP: "success", EMAIL: "info", PHONE: "brand", IN_PERSON: "warning" };

export default async function StudentProfile(props: PageProps<"/students/[id]">) {
  const rules = await getRules();
  const attendanceTone = toneFor(rules);
  const user = await requireUser();
  const { id } = await props.params;
  const s = await db.student.findFirst({
    where: { AND: [{ id }, studentScope(user)] },
    include: {
      user: true, batch: { include: { program: { include: { department: true } } } },
      invoices: { include: { payments: true, instalments: true }, orderBy: { createdAt: "desc" } },
      applications: { include: { drive: { include: { company: true } } } },
    },
  });
  if (!s) notFound();
  const term = await currentTerm();
  const parents = isOffice(user) ? await db.parentLink.findMany({ where: { studentId: s.id }, include: { user: { select: { name: true, email: true } } } }) : [];
  const offerings = await db.courseOffering.findMany({ where: { batchId: s.batchId, termId: term?.id }, include: { subject: true } });
  const att = await attendanceSummary({ studentIds: [s.id], offeringIds: offerings.map((o) => o.id) });
  const admin = isOffice(user);
  const contacts = isLearner(user) ? [] : await db.parentContact.findMany({ where: { studentId: s.id }, include: { by: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 });
  const canSeeFees = ["ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"].includes(user.role);
  const attTotals = [...att.values()].reduce((x, v) => ({ a: x.a + v.attended, t: x.t + v.total }), { a: 0, t: 0 });
  const overallAtt = pct(attTotals.a, attTotals.t);

  const info: [string, React.ReactNode][] = [
    ["Programme", s.batch.program.name], ["Department", s.batch.program.department.name], ["Batch", batchLabel(s.batch)],
    ["Current semester", s.batch.currentSemester], ["Admission", `${titleCase(s.admissionType)} · ${fmtDate(s.admissionDate)}`],
    ["Entry semester", s.entrySemester], ["Date of birth", fmtDate(s.dob)], ["Gender", s.gender ? titleCase(s.gender) : "—"],
    ["Category", s.category], ["Blood group", s.bloodGroup ?? "—"], ["Previous institution", s.previousSchool ?? "—"],
    ["Qualifying %", s.previousScore ?? "—"],
    ["Guardian", admin ? <InlineEdit key="gn" action={updateStudentContact} fields={{ studentId: s.id }} name="guardianName" label="Guardian name" value={s.guardianName ?? ""} /> : s.guardianName ?? "—"],
    ["Guardian phone", admin ? <InlineEdit key="gp" action={updateStudentContact} fields={{ studentId: s.id }} name="guardianPhone" label="Guardian phone" type="tel" value={s.guardianPhone ?? ""} /> : s.guardianPhone ?? "—"],
    ["Guardian email", admin ? <InlineEdit key="ge" action={updateStudentContact} fields={{ studentId: s.id }} name="guardianEmail" label="Guardian email" type="email" value={s.guardianEmail ?? ""} /> : s.guardianEmail ?? "—"],
  ];

  return (
    <>
      {user.role !== "STUDENT" && user.role !== "PARENT" && <Breadcrumbs items={[{ label: "Students", href: "/students" }, { label: s.user.name }]} />}
      {/* Record header: who this is, their identifiers and standing, and what can be done with the record. */}
      <section className="tile mb-6 animate-fade-up">
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <div className="shrink-0">
            {isOffice(user)
              ? <PhotoUpload compact userId={s.userId} current={<Avatar name={s.user.name} userId={s.userId} hasPhoto={!!s.user.photoType} size={72} />} />
              : <Avatar name={s.user.name} userId={s.userId} hasPhoto={!!s.user.photoType} size={72} />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold sm:text-2xl">{s.user.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-mono">{s.rollNo}</span>·<span>{s.batch.program.name}</span>
              <Badge tone={STATUS_TONE[s.status]}>{titleCase(s.status)}</Badge>
              {s.admissionType === "LATERAL" && <Badge tone="brand">Lateral entry</Badge>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(isOffice(user) || user.role === "HOD") && <LinkButton variant="secondary" href={`/students/${s.id}/id-card`}>ID card</LinkButton>}
            {isOffice(user) && <LinkButton variant="secondary" href={`/students/${s.id}/edit`}><Pencil className="size-4" /> Edit</LinkButton>}
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
          {[["Semester", s.batch.currentSemester], ["Batch", `${s.batch.admissionYear}-${s.batch.section}`], ["Attendance", `${overallAtt}%`]].map(([k, v]) => (
            <div key={k} className="px-5 py-3 sm:px-6"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile">
          <div className="mb-4 space-y-1.5 text-sm">
            <p className="flex items-center gap-2"><Mail className="size-4 text-muted" />{s.user.email}</p>
            <p className="flex items-center gap-2"><Phone className="size-4 text-muted" />{admin ? <InlineEdit action={updateStudentContact} fields={{ studentId: s.id }} name="phone" label="Phone" type="tel" value={s.user.phone ?? ""} /> : s.user.phone ?? "—"}</p>
            <p className="flex items-center gap-2"><MapPin className="size-4 text-muted" />{admin ? <InlineEdit action={updateStudentContact} fields={{ studentId: s.id }} name="address" label="Address" value={s.address ?? ""} /> : s.address ?? "—"}</p>
          </div>
          <dl className="divide-y divide-line text-sm">
            {info.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>)}
          </dl>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          {term && (
            <Card title="Attendance calendar" actions={<span className="text-xs text-muted">{term.name}</span>}>
              <AttendanceHeatmap studentId={s.id} termId={term.id} from={term.startDate} to={term.endDate} />
            </Card>
          )}
          <Card title={`Attendance · ${term?.name ?? ""}`}>
            {offerings.length === 0 ? <p className="text-sm text-muted">No courses this term.</p> : (
              <ul className="space-y-3">
                {offerings.map((o) => {
                  const v = att.get(`${s.id}:${o.id}`) ?? { attended: 0, total: 0 };
                  const p = pct(v.attended, v.total);
                  return (
                    <li key={o.id}>
                      <div className="mb-1 flex justify-between text-sm"><span>{o.subject.name}</span><span className="text-xs text-muted">{v.attended}/{v.total} · <b className="text-fg">{p}%</b></span></div>
                      <Progress value={p} tone={attendanceTone(p)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {canSeeFees && (
            <Card title="Fees" actions={<Link href={`/fees/statement/${s.id}`} className="text-xs text-brand">Statement / no-dues →</Link>}>
              <Table>
                <thead><tr><Th>Invoice</Th><Th className="text-right">Payable</Th><Th className="text-right">Paid</Th><Th className="text-right">Balance</Th><Th>Status</Th><Th /></tr></thead>
                <tbody>
                  {s.invoices.map((inv) => {
                    const st = invoiceStatus(inv);
                    return (
                      <tr key={inv.id}>
                        <Td><p className="font-medium">{inv.title}</p><p className="font-mono text-xs text-muted">{inv.invoiceNo} · due {fmtDate(inv.dueDate)}</p></Td>
                        <Td className="text-right">{inr(st.payable)}</Td><Td className="text-right">{inr(st.paid)}</Td><Td className="text-right">{inr(st.balance)}</Td>
                        <Td><Badge tone={statusTone[st.status]}>{st.status}</Badge></Td>
                        <Td>{(user.role === "ADMIN" || user.role === "ACCOUNTANT") && <Link className="text-xs text-brand" href={`/fees/${inv.id}`}>Open</Link>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}
          {isOffice(user) && (
            <Card title="Parent login">
              {parents.length > 0 && <ul className="mb-3 space-y-1 text-sm">{parents.map((p) => <li key={p.userId} className="flex justify-between"><span>{p.user.name}</span><span className="text-muted">{p.user.email}</span></li>)}</ul>}
              <ActionForm action={createParentLogin} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="studentId" value={s.id} />
                <div className="min-w-56 flex-1"><label className="label" htmlFor="pemail">Parent&apos;s email</label><input id="pemail" name="email" type="email" className="input" placeholder="parent@example.com" required /></div>
                <SubmitButton variant="secondary">Create / link parent login</SubmitButton>
              </ActionForm>
              <p className="mt-2 text-xs text-muted">Parents can view this student&apos;s attendance, results and fee dues. The temporary password is shown once after creation.</p>
            </Card>
          )}
          {!isLearner(user) && (
            <Card title="Parent contact log" actions={<span className="text-xs text-muted">{contacts.length ? `${contacts.length} most recent` : ""}</span>}>
              {contacts.length === 0 ? <p className="mb-4 text-sm text-muted">No contact with the parent or guardian has been recorded yet. WhatsApp and email reminders are added here automatically.</p> : (
                <ul className="mb-5 space-y-3">
                  {contacts.map((c) => (
                    <li key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface-2/40 p-3 text-sm">
                      <p className="flex flex-wrap items-center gap-2"><Badge tone={CONTACT_TONE[c.channel] ?? "neutral"}>{titleCase(c.channel)}</Badge><Badge>{titleCase(c.purpose)}</Badge><span className="ml-auto text-xs text-muted">{fmtDateTime(c.createdAt)}{c.by && ` · ${c.by.name}`}</span></p>
                      <p className="mt-2 whitespace-pre-line text-[13px] text-muted">{c.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={logParentContact} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
                <input type="hidden" name="studentId" value={s.id} />
                <Field label="How" name="channel"><select name="channel" className="input"><option value="PHONE">Phone call</option><option value="IN_PERSON">In person</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></select></Field>
                <Field label="About" name="purpose"><select name="purpose" className="input">{["ATTENDANCE", "FEES", "RESULTS", "CONDUCT", "GENERAL"].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></Field>
                <Field label="What was said" name="message" className="sm:col-span-2"><textarea name="message" rows={2} className="input" placeholder="e.g. Spoke to the father; he will meet the class teacher on Monday." required /></Field>
                <div className="sm:col-span-2"><SubmitButton variant="secondary">Add to log</SubmitButton></div>
              </ActionForm>
            </Card>
          )}
          {s.applications.length > 0 && (
            <Card title="Placement applications">
              <ul className="space-y-2 text-sm">
                {s.applications.map((a) => (
                  <li key={a.id} className="flex justify-between"><span>{a.drive.company.name} — {a.drive.role} ({a.drive.ctcLpa} LPA)</span><Badge tone={a.status === "SELECTED" ? "success" : a.status === "REJECTED" ? "danger" : "info"}>{a.status}</Badge></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <h2 className="mt-8 mb-4 flex items-center gap-2 text-lg font-semibold"><User className="size-5" /> Academic record</h2>
      <AcademicRecord studentId={s.id} />
    </>
  );
}
