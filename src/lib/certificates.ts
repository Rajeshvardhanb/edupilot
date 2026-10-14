import "server-only";
import { fmtDate } from "./format";

export const CERT_TITLE: Record<string, string> = { BONAFIDE: "Bonafide Certificate", STUDY: "Study Certificate", CONDUCT: "Conduct Certificate", TRANSFER: "Transfer Certificate" };

type Subject = {
  type: string; purpose: string;
  student: { rollNo: string; gender: string | null; guardianName: string | null; admissionDate: Date; dob: Date | null; user: { name: string }; batch: { currentSemester: number; program: { name: string; department: { name: string } } } };
};

/** The certificate wording as plain text (used for the PDF; the on-screen page formats the same sentences). */
export function certificateText(c: Subject, cgpa: number) {
  const s = c.student, p = s.batch.program;
  const [he, his, child] = s.gender === "FEMALE" ? ["She", "her", "D/o"] : ["He", "his", "S/o"];
  const who = `${s.user.name} (${child} ${s.guardianName ?? "-"}), Roll No. ${s.rollNo}`;
  const year = Math.ceil(s.batch.currentSemester / 2), y = new Date().getFullYear();
  switch (c.type) {
    case "STUDY": return `This is to certify that ${who} has been studying in this institution since ${fmtDate(s.admissionDate)} in ${p.name}, Department of ${p.department.name}, and is presently in Semester ${s.batch.currentSemester}. ${he} has secured a CGPA of ${cgpa.toFixed(2)} so far. Issued for the purpose of ${c.purpose}.`;
    case "CONDUCT": return `This is to certify that ${who}, a student of ${p.name}, has borne a good character and conduct during ${his} period of study in this institution from ${fmtDate(s.admissionDate)}. Issued for the purpose of ${c.purpose}.`;
    case "TRANSFER": return `This is to certify that ${who}, born on ${fmtDate(s.dob)}, was admitted to ${p.name} on ${fmtDate(s.admissionDate)} and was last studying in Semester ${s.batch.currentSemester}. ${he} has cleared all dues to the institution and ${his} conduct has been good. This transfer certificate is issued at ${his} request: ${c.purpose}.`;
    default: return `This is to certify that ${who} is a bonafide student of this institution, studying in year ${year} (Semester ${s.batch.currentSemester}) of ${p.name} during the academic year ${y}-${String(y + 1).slice(2)}. This certificate is issued on ${his} request for the purpose of ${c.purpose}.`;
  }
}
