import { notFound } from "next/navigation";
import { Download, ShieldAlert } from "lucide-react";
import { getInstitution } from "@/lib/institution";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, studentScope } from "@/lib/scope";
import { hallTicketStatus } from "@/lib/eligibility";
import { batchLabel, fmtDate } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Letterhead, Sheet } from "@/components/letterhead";
import { PrintButton } from "@/components/print-button";
import { qrSvg } from "@/lib/qr";
import { LinkButton, buttonClass } from "@/components/ui";

export const metadata = { title: "Hall ticket" };

export default async function HallTicketPage(props: PageProps<"/exams/hall-tickets/[studentId]">) {
  const user = await requireUser(["ADMIN", "HOD", "STUDENT"]);
  const { studentId } = await props.params;
  const s = await db.student.findFirst({ where: { AND: [{ id: studentId }, studentScope(user)] }, include: { user: { select: { id: true, name: true, photoType: true } }, batch: { include: { program: true } } } });
  if (!s) notFound();
  const term = await currentTerm();
  const st = (await hallTicketStatus([s.id], term?.id)).get(s.id)!;
  const exams = await db.examSchedule.findMany({
    where: { kind: "END_SEM", termId: term?.id, subject: { offerings: { some: { termId: term?.id, batchId: s.batchId } } } },
    include: { subject: true, seats: { where: { studentId: s.id }, include: { room: true } } },
    orderBy: [{ date: "asc" }, { session: "asc" }],
  });

  if (!st.eligible)
    return (
      <Sheet>
        <div className="py-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-[var(--radius-card)] bg-danger-soft text-danger"><ShieldAlert className="size-7" /></span>
          <h1 className="mt-4 text-xl font-semibold">Hall ticket withheld</h1>
          <p className="mt-1 text-sm text-muted">{s.user.name} · {s.rollNo}</p>
          <ul className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm">{st.reasons.map((r) => <li key={r} className="rounded-lg bg-danger-soft px-3 py-2 text-danger">{r}</li>)}</ul>
          <p className="mt-4 text-xs text-muted">Clear the dues at the accounts section, or apply for condonation under Leave &amp; OD with a medical certificate.</p>
          <div className="mt-6 flex justify-center gap-2"><LinkButton variant="secondary" href="/fees">Fees</LinkButton><LinkButton href="/leave">Leave &amp; OD</LinkButton></div>
        </div>
      </Sheet>
    );

  const qr = await qrSvg(`HT|${s.rollNo}|${term?.name ?? ""}`);
  const inst = await getInstitution();
  return (
    <>
      <div className="no-print mx-auto mb-4 hidden max-w-3xl justify-end gap-2 sm:flex"><a href={`/exams/hall-tickets/${s.id}/pdf`} className={buttonClass("secondary")}>Download PDF</a><PrintButton label="Print" /></div>
      <div className="hidden sm:block print:block">
      <Sheet>
        <Letterhead title="Hall Ticket" serial={term?.name} />
        <div className="mt-5 flex gap-5">
          <Avatar name={s.user.name} userId={s.user.id} hasPhoto={!!s.user.photoType} size={96} className="!rounded-xl" />
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted">Name</dt><dd className="font-semibold">{s.user.name}</dd>
            <dt className="text-muted">Hall ticket no.</dt><dd className="font-mono font-semibold">{s.rollNo}</dd>
            <dt className="text-muted">Programme</dt><dd>{s.batch.program.name}</dd>
            <dt className="text-muted">Batch · semester</dt><dd>{batchLabel(s.batch)} · Semester {s.batch.currentSemester}</dd>
            <dt className="text-muted">Attendance</dt><dd>{st.attendance}%{st.condoned ? " (condoned)" : ""}</dd>
          </dl>
          <div className="size-24 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
        <div className="mt-6 overflow-x-auto print:overflow-visible"><table className="w-full border-collapse text-sm">
          <thead><tr className="bg-surface-2 text-left">{["Date", "Session", "Code", "Subject", "Hall · seat", "Invigilator"].map((h) => <th key={h} className="border border-line px-2 py-1.5 text-xs font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id}>
                <td className="border border-line px-2 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="border border-line px-2 py-2">{e.session === "FN" ? "10:00–13:00" : "14:00–17:00"}</td>
                <td className="border border-line px-2 py-2 font-mono text-xs">{e.subject.code}</td>
                <td className="border border-line px-2 py-2">{e.subject.name}</td>
                <td className="border border-line px-2 py-2">{e.seats[0] ? `${e.seats[0].room.name} · ${e.seats[0].seatNo}` : "To be notified"}</td>
                <td className="border border-line px-2 py-2" />
              </tr>
            ))}
            {exams.length === 0 && <tr><td colSpan={6} className="border border-line px-2 py-4 text-center text-muted">The exam time-table has not been published yet.</td></tr>}
          </tbody>
        </table></div>
        <ol className="mt-5 list-decimal space-y-1 pl-5 text-xs text-muted">
          <li>Carry this hall ticket and your college ID card to every examination.</li>
          <li>Report to the hall 30 minutes before the start. Entry closes 30 minutes after the start.</li>
          <li>Mobile phones, smart watches and programmable calculators are not permitted.</li>
        </ol>
        <div className="mt-12 flex justify-between text-xs"><span>Signature of the candidate</span><span>Controller of Examinations</span></div>
      </Sheet>
      </div>
      {/* Phone: the ticket as a card; the printable sheet below is for larger screens and printing. */}
      <div className="no-print sm:hidden">
        <section className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-card">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#c026d3] px-4 py-3 text-white">
            {inst.logoType
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src="/brand/logo" alt="" className="size-9 rounded-full bg-white object-contain p-0.5" />
              : null}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{inst.shortName} · Hall ticket</p><p className="truncate text-[11px] text-white/80">End semester · {term?.name}</p></div>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">Valid</span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Avatar name={s.user.name} userId={s.user.id} hasPhoto={!!s.user.photoType} size={64} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{s.user.name}</p>
              <p className="font-mono text-xs font-semibold text-brand">{s.rollNo}</p>
              <p className="truncate text-xs text-muted">{s.batch.program.code} · Semester {s.batch.currentSemester}</p>
            </div>
            <div className="size-20 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
          <ol className="space-y-2 border-t border-dashed border-line-strong p-4">
            {exams.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                <span className="w-10 shrink-0 text-center leading-tight"><span className="block text-lg font-bold text-brand">{String(e.date.getUTCDate()).padStart(2, "0")}</span><span className="text-[10px] text-muted">{e.date.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</span></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{e.subject.name}</span><span className="block text-[11px] text-muted">{e.subject.code} · {e.session === "FN" ? "FN 10:00–13:00" : "AN 14:00–17:00"}</span></span>
                <span className="shrink-0 text-[11px] text-muted">{e.seats[0] ? `${e.seats[0].room.name} · ${e.seats[0].seatNo}` : "Seat TBA"}</span>
              </li>
            ))}
            {exams.length === 0 && <li className="py-3 text-center text-sm text-muted">The exam time-table has not been published yet.</li>}
          </ol>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-3"><a href={`/exams/hall-tickets/${s.id}/pdf`} className={buttonClass("secondary")}><Download /> Download PDF</a><PrintButton label="Print" /></div>
      </div>
    </>
  );
}
