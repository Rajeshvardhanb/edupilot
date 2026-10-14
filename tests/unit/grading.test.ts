import { describe, expect, it } from "vitest";
import { computeResult, gpa, gradeFor, standing } from "@/lib/grading";

const subject = { internalMax: 40, externalMax: 60 };
const plan = [
  { id: "mid1", type: "MID_TERM", maxMarks: 30 },
  { id: "mid2", type: "MID_TERM", maxMarks: 30 },
  { id: "asg", type: "ASSIGNMENT", maxMarks: 10 },
  { id: "see", type: "END_SEM", maxMarks: 100 },
];
const marks = (m1: number, m2: number, a: number, see: number | null) => [
  { assessmentId: "mid1", marks: m1, isAbsent: false },
  { assessmentId: "mid2", marks: m2, isAbsent: false },
  { assessmentId: "asg", marks: a, isAbsent: false },
  { assessmentId: "see", marks: see, isAbsent: see === null },
];

describe("grade scale", () => {
  it.each([[100, "O", 10], [90, "O", 10], [89.9, "A+", 9], [80, "A+", 9], [70, "A", 8], [60, "B+", 7], [55, "B", 6], [50, "C", 5], [40, "P", 4], [39.9, "F", 0], [0, "F", 0]])(
    "%s%% is grade %s (%s points)", (percent, grade, point) => {
      expect(gradeFor(percent)).toMatchObject({ grade, point });
    });
});

describe("computeResult", () => {
  it("scales internals to the internal maximum and the exam to the external maximum", () => {
    // internals 56/70 → 32/40; exam 75/100 → 45/60
    const r = computeResult(subject, plan, marks(24, 24, 8, 75));
    expect(r).toMatchObject({ internal: 32, external: 45, total: 77, percent: 77, grade: "A", gradePoint: 8, passed: true, complete: true });
  });

  it("fails a student below 35% in the end-semester exam even when the total is above 40%", () => {
    // full internals (40) + 20/100 in the exam (12/60, under the 21 needed) = 52%
    const r = computeResult(subject, plan, marks(30, 30, 10, 20));
    expect(r.percent).toBe(52);
    expect(r).toMatchObject({ passed: false, grade: "F", gradePoint: 0 });
  });

  it("passes at exactly 35% in the exam when the total reaches 40%", () => {
    const r = computeResult(subject, plan, marks(30, 30, 10, 35)); // 40 + 21 = 61
    expect(r).toMatchObject({ external: 21, passed: true, grade: "B+" });
  });

  it("fails below 40% overall", () => {
    expect(computeResult(subject, plan, marks(10, 10, 2, 36))).toMatchObject({ passed: false, grade: "F" });
  });

  it("grades an absentee in the end-semester exam as AB", () => {
    const r = computeResult(subject, plan, marks(30, 30, 10, null));
    expect(r).toMatchObject({ grade: "AB", gradePoint: 0, passed: false, external: 0 });
  });

  it("reports incomplete until every assessment has an entry", () => {
    const r = computeResult(subject, plan, marks(20, 20, 5, 60).slice(0, 3));
    expect(r.complete).toBe(false);
    expect(computeResult(subject, [], []).complete).toBe(false);
  });

  it("handles a subject with no external exam (internal-only project)", () => {
    const r = computeResult({ internalMax: 100, externalMax: 0 }, [{ id: "p", type: "LAB_INTERNAL", maxMarks: 50 }], [{ assessmentId: "p", marks: 45, isAbsent: false }]);
    expect(r).toMatchObject({ internal: 90, external: 0, percent: 90, grade: "O", passed: true });
  });
});

describe("GPA and standing", () => {
  it("weights grade points by credits", () => {
    expect(gpa([{ gradePoint: 10, credits: 4 }, { gradePoint: 6, credits: 2 }])).toBe(8.67);
    expect(gpa([])).toBe(0);
  });

  it("counts a failed subject as a backlog with zero points", () => {
    const s = standing([
      { subjectId: "a", termId: "t1", gradePoint: 8, credits: 4, passed: true },
      { subjectId: "b", termId: "t1", gradePoint: 0, credits: 4, passed: false },
    ]);
    expect(s).toMatchObject({ cgpa: 4, backlogs: 1, creditsEarned: 4 });
  });

  it("clears a backlog when the subject is passed later, using the best attempt for CGPA", () => {
    const s = standing([
      { subjectId: "a", termId: "t1", gradePoint: 8, credits: 4, passed: true },
      { subjectId: "b", termId: "t1", gradePoint: 0, credits: 4, passed: false },
      { subjectId: "b", termId: "t2", gradePoint: 6, credits: 4, passed: true },
    ]);
    expect(s).toMatchObject({ cgpa: 7, backlogs: 0, creditsEarned: 8 });
    expect(s.sgpaByTerm.get("t1")).toBe(4); // the term's own SGPA still reflects the failure
    expect(s.sgpaByTerm.get("t2")).toBe(6);
  });
});
