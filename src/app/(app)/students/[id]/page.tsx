import { resendAccountSetup } from "@/actions/account-setup";
import { createParentLogin } from "@/actions/services";
import { updateStudentContact, deleteStudent } from "@/actions/students";
import { AcademicRecord } from "@/components/academic-record";
import { AttendanceHeatmap } from "@/components/attendance-heatmap";
import { Avatar } from "@/components/avatar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionButton,ActionForm,SubmitButton } from "@/components/forms";
import { InlineEdit } from "@/components/inline-edit";
import { Badge,LinkButton,Progress } from "@/components/ui";
import { Card } from "@/components/ui-server";
import { attendanceSummary } from "@/lib/attendance";
import { isOffice,requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchLabel,fmtDate,pct,titleCase } from "@/lib/format";
import { getRules,toneFor } from "@/lib/rules";
import { currentTerm,studentScope } from "@/lib/scope";
import { Mail,MapPin,Pencil,Phone,User } from "lucide-react";
import { notFound } from "next/navigation";
import { STATUS_TONE } from "../filter";

export const metadata = { title: "Student profile" };


export default async function StudentProfile(props: PageProps<"/students/[id]">) {
  const rules = await getRules();
  const attendanceTone = toneFor(rules);
  const user = await requireUser();
  const { id } = await props.params;
  const s = await db.student.findFirst({
    where: { AND: [{ id }, studentScope(user)] },
    include: {
      user: true, batch: { include: { program: { include: { department: true } } } },
      applications: { include: { drive: { include: { company: true } } } },
    },
  });
  if (!s) notFound();
  const term = await currentTerm();
  const parents = isOffice(user) ? await db.parentLink.findMany({ where: { studentId: s.id }, include: { user: { select: { name: true, email: true } } } }) : [];
  const offerings = await db.courseOffering.findMany({ where: { batchId: s.batchId, termId: term?.id }, include: { subject: true } });
  const att = await attendanceSummary({ studentIds: [s.id], offeringIds: offerings.map((o) => o.id) });
  const admin = isOffice(user);
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
            <Avatar name={s.user.name} size={72} />
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
            {isOffice(user) && <LinkButton variant="secondary" href={`/students/${s.id}/edit`}><Pencil className="size-4" /> Edit student</LinkButton>}
            {isOffice(user) && s.user.mustChangePassword && <ActionButton action={resendAccountSetup} fields={{ studentId: s.id }} variant="secondary">Resend password setup</ActionButton>}
            {user.role === "ADMIN" && <ActionButton action={deleteStudent} fields={{ id: s.id }} variant="danger" confirm={`Delete ${s.user.name}? This permanently removes their login and all related records, including marks and attendance. This cannot be undone.`}>Delete student</ActionButton>}
            {user.role === "STUDENT" && user.studentId === s.id && <LinkButton href="/profile#edit-profile">Edit my profile</LinkButton>}
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
          {[["Semester", s.batch.currentSemester], ["Batch", `${s.batch.admissionYear}-${s.batch.section}`], ["Attendance", `${overallAtt}%`]].map(([k, v]) => (
            <div key={k} className="px-5 py-3 sm:px-6"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>
      </section>
      {isOffice(user) && s.user.mustChangePassword && <div className="mb-6 rounded-xl border border-line bg-brand-soft p-4 text-sm"><strong>Password setup pending</strong><p className="mt-1">Login username: {s.user.email}. The setup invitation includes a link to choose a password after email OTP verification. Check Administration → Email delivery for delivery status, or use Resend password setup above. A working email inbox is required.</p></div>}
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
          {isOffice(user) && (
            <Card title="Parent login">
              {parents.length > 0 && <ul className="mb-3 space-y-1 text-sm">{parents.map((p) => <li key={p.userId} className="flex justify-between"><span>{p.user.name}</span><span className="text-muted">{p.user.email}</span></li>)}</ul>}
              <ActionForm action={createParentLogin} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="studentId" value={s.id} />
                <div className="min-w-56 flex-1"><label className="label" htmlFor="pemail">Parent&apos;s email</label><input id="pemail" name="email" type="email" className="input" placeholder="parent@example.com" required /></div>
                <SubmitButton variant="secondary">Create / link parent login</SubmitButton>
              </ActionForm>
              <p className="mt-2 text-xs text-muted">Parents can view this student&apos;s attendance and results. The temporary password is shown once after creation.</p>
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
