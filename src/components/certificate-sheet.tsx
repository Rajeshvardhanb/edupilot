import { db } from "@/lib/db";
import { getInstitution } from "@/lib/institution";
import { studentStandings } from "@/lib/results";
import { fmtDate } from "@/lib/format";
import { Letterhead, Sheet } from "@/components/letterhead";

const TITLE: Record<string, string> = { BONAFIDE: "Bonafide Certificate", STUDY: "Study Certificate", CONDUCT: "Conduct Certificate", TRANSFER: "Transfer Certificate" };

/** One issued certificate, laid out on the college letterhead. Used for a single certificate and for a whole batch. */
export async function CertificateSheet({ id }: { id: string }) {
  const c = await db.certificateRequest.findFirst({
    where: { id, status: "APPROVED" },
    include: { student: { include: { user: { select: { name: true } }, batch: { include: { program: { include: { department: true } } } } } } },
  });
  if (!c) return null;
  const inst = await getInstitution();
  const s = c.student, p = s.batch.program;
  const pronoun = s.gender === "FEMALE" ? ["She", "her", "D/o"] : ["He", "his", "S/o"];
  const year = Math.ceil(s.batch.currentSemester / 2);
  const cgpa = (await studentStandings([s.id])).get(s.id)!.cgpa;
  const who = <><b>{s.user.name}</b> ({pronoun[2]} {s.guardianName ?? "—"}), Roll No. <b>{s.rollNo}</b></>;

  const body = {
    BONAFIDE: <>This is to certify that {who} is a bonafide student of this institution, studying in year {year} (Semester {s.batch.currentSemester}) of <b>{p.name}</b> during the academic year {new Date().getFullYear()}-{String(new Date().getFullYear() + 1).slice(2)}. This certificate is issued on {pronoun[1]} request for the purpose of <b>{c.purpose}</b>.</>,
    STUDY: <>This is to certify that {who} has been studying in this institution since {fmtDate(s.admissionDate)} in <b>{p.name}</b>, Department of {p.department.name}, and is presently in Semester {s.batch.currentSemester}. {pronoun[0]} has secured a CGPA of <b>{cgpa.toFixed(2)}</b> so far. Issued for the purpose of <b>{c.purpose}</b>.</>,
    CONDUCT: <>This is to certify that {who}, a student of <b>{p.name}</b>, has borne a <b>good</b> character and conduct during {pronoun[1]} period of study in this institution from {fmtDate(s.admissionDate)}. Issued for the purpose of <b>{c.purpose}</b>.</>,
    TRANSFER: <>This is to certify that {who}, born on {fmtDate(s.dob)}, was admitted to <b>{p.name}</b> on {fmtDate(s.admissionDate)} and was last studying in Semester {s.batch.currentSemester}. {pronoun[0]} has cleared all dues to the institution and {pronoun[1]} conduct has been good. This transfer certificate is issued at {pronoun[1]} request: <b>{c.purpose}</b>.</>,
  }[c.type];

  return (
    <Sheet>
      <Letterhead serial={c.serialNo ?? undefined} title={`Date: ${fmtDate(c.issuedAt)}`} />
      <h1 className="mt-10 text-center text-xl font-bold tracking-widest uppercase underline underline-offset-8">{TITLE[c.type]}</h1>
      <p className="mt-10 text-justify text-[15px] leading-8 indent-12">{body}</p>
      <div className="mt-24 flex items-end justify-between text-sm">
        <div><p>Place: ____________</p><p className="mt-1">Date: {fmtDate(c.issuedAt)}</p></div>
        <div className="text-center"><p className="font-semibold">{inst.principalName || "Principal"}</p><p className="text-xs text-muted">Principal · {inst.name}</p><p className="mt-1 text-xs text-muted">(Seal &amp; signature)</p></div>
      </div>
    </Sheet>
  );
}
