import "server-only";
import { db } from "./db";
import { computeResult, standing } from "./grading";
import { getRules } from "./rules";

/** Live (unpublished) results for every student in an offering's batch. */
export async function offeringResults(offeringId: string) {
  const offering = await db.courseOffering.findUniqueOrThrow({
    where: { id: offeringId },
    include: {
      subject: true,
      assessments: { orderBy: { createdAt: "asc" }, include: { marks: true } },
      batch: { include: { program: true, students: { where: { status: { in: ["ACTIVE", "DETAINED"] } }, include: { user: true }, orderBy: { rollNo: "asc" } } } },
    },
  });
  const allMarks = offering.assessments.flatMap((a) => a.marks);
  const rules = await getRules();
  const rows = offering.batch.students.map((s) => ({
    student: s,
    marks: new Map(allMarks.filter((m) => m.studentId === s.id).map((m) => [m.assessmentId, m])),
    result: computeResult(offering.subject, offering.assessments, allMarks.filter((m) => m.studentId === s.id), rules),
  }));
  return { offering, rows };
}

/** CGPA / backlogs / SGPA-per-term for a set of students from published results. */
export async function studentStandings(studentIds: string[]) {
  const results = await db.subjectResult.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, gradePoint: true, credits: true, passed: true, offering: { select: { subjectId: true, termId: true } } },
  });
  const grouped = new Map<string, typeof results>();
  for (const r of results) grouped.set(r.studentId, [...(grouped.get(r.studentId) ?? []), r]);
  return new Map(
    studentIds.map((id) => [
      id,
      standing((grouped.get(id) ?? []).map((r) => ({ ...r, subjectId: r.offering.subjectId, termId: r.offering.termId }))),
    ]),
  );
}
