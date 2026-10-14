import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, computeResult, gradeFor, parseGradeScale } from "@/lib/grading";

const subject = { internalMax: 40, externalMax: 60 };
const plan = [{ id: "mid", type: "MID_TERM", maxMarks: 40 }, { id: "see", type: "END_SEM", maxMarks: 60 }];
const marks = (mid: number, see: number) => [{ assessmentId: "mid", marks: mid, isAbsent: false }, { assessmentId: "see", marks: see, isAbsent: false }];

describe("college-defined pass rules", () => {
  it("uses the built-in rules when none are given", () => {
    expect(computeResult(subject, plan, marks(20, 21))).toMatchObject({ passed: true, grade: "P" }); // 41%, SEE 35%
    expect(computeResult(subject, plan, marks(20, 21), DEFAULT_RULES)).toMatchObject({ passed: true, grade: "P" });
  });

  it("a higher pass mark fails a student the default would pass", () => {
    const strict = { ...DEFAULT_RULES, passPercent: 50 };
    expect(computeResult(subject, plan, marks(20, 25), strict)).toMatchObject({ percent: 45, passed: false, grade: "F" });
    expect(computeResult(subject, plan, marks(20, 25))).toMatchObject({ passed: true });
  });

  it("the end-semester minimum can be raised or removed", () => {
    // 30 + 20 = 50% overall, but only 33% of the end-semester paper.
    expect(computeResult(subject, plan, marks(30, 20))).toMatchObject({ passed: false });
    expect(computeResult(subject, plan, marks(30, 20), { ...DEFAULT_RULES, minExternalPercent: 0 })).toMatchObject({ passed: true, grade: "C" });
    expect(computeResult(subject, plan, marks(30, 26), { ...DEFAULT_RULES, minExternalPercent: 45 })).toMatchObject({ passed: false });
  });

  it("grades come from the college's own scale", () => {
    const scale = parseGradeScale([{ grade: "S", min: 85, point: 10 }, { grade: "A", min: 70, point: 9 }, { grade: "B", min: 50, point: 7 }, { grade: "C", min: 40, point: 5 }, { grade: "U", min: 0, point: 0 }])!;
    expect(gradeFor(86, scale)).toMatchObject({ grade: "S", point: 10 });
    expect(gradeFor(69.9, scale)).toMatchObject({ grade: "B", point: 7 });
    expect(computeResult(subject, plan, marks(36, 50), { ...DEFAULT_RULES, gradeScale: scale })).toMatchObject({ grade: "S", gradePoint: 10 });
    expect(computeResult(subject, plan, marks(10, 10), { ...DEFAULT_RULES, gradeScale: scale })).toMatchObject({ grade: "F", gradePoint: 0, passed: false });
  });
});

describe("grade scale validation", () => {
  const good = [{ grade: "A", min: 60, point: 8 }, { grade: "B", min: 40, point: 5 }, { grade: "F", min: 0, point: 0 }];
  it("accepts a sensible scale and sorts it highest first", () => {
    expect(parseGradeScale([good[2], good[0], good[1]])!.map((r) => r.grade)).toEqual(["A", "B", "F"]);
    expect(parseGradeScale(DEFAULT_RULES.gradeScale)).toHaveLength(8);
  });
  it.each([
    ["nothing", null], ["a single row", [good[2]]],
    ["no row starting at 0", [good[0], good[1]]],
    ["a repeated grade", [...good, { grade: "A", min: 80, point: 9 }]],
    ["a repeated starting mark", [...good, { grade: "C", min: 40, point: 4 }]],
    ["points that rise as marks fall", [{ grade: "A", min: 60, point: 5 }, { grade: "B", min: 40, point: 8 }, { grade: "F", min: 0, point: 0 }]],
    ["points above 10", [{ grade: "A", min: 60, point: 11 }, good[2]]],
    ["a blank grade", [{ grade: " ", min: 60, point: 8 }, good[2]]],
    ["marks above 100", [{ grade: "A", min: 120, point: 8 }, good[2]]],
  ])("rejects %s", (_, input) => { expect(parseGradeScale(input)).toBeNull(); });
});

describe("classes needed to reach the attendance rule", () => {
  it("follows the college's rule, not a fixed 75%", async () => {
    const { classesToReach } = await import("@/lib/grading");
    expect(classesToReach(75, 6, 10)).toBe(6); // (7.5 - 6) / 0.25
    expect(classesToReach(80, 6, 10)).toBe(10); // (8 - 6) / 0.2
    expect(classesToReach(65, 7, 10)).toBe(0);
    expect(classesToReach(100, 9, 10)).toBe(Infinity);
    expect(classesToReach(75, 0, 0)).toBe(0);
  });
});
