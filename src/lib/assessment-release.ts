type AssessmentMark = { studentId: string; marks: number | null; isAbsent: boolean };
/** Only the selected assessment must be complete to release mid/internal marks. */
export function missingAssessmentMarks(studentIds: string[], marks: AssessmentMark[], maxMarks: number) {
  const byStudent = new Map(marks.map(m => [m.studentId, m]));
  return studentIds.filter(id => {
    const mark = byStudent.get(id);
    return !mark || !mark.isAbsent && (mark.marks === null || !Number.isFinite(mark.marks) || mark.marks < 0 || mark.marks > maxMarks);
  }).length;
}
