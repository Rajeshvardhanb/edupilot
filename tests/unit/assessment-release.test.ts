import { describe, expect, it } from "vitest";
import { missingAssessmentMarks } from "@/lib/assessment-release";
describe("independent assessment release readiness", () => {
 it("accepts zero and AB and ignores non-enrolled records", () => {
  expect(missingAssessmentMarks(["s1", "s2"], [{ studentId: "s1", marks: 0, isAbsent: false }, { studentId: "s2", marks: null, isAbsent: true }, { studentId: "hidden", marks: null, isAbsent: false }], 30)).toBe(0);
 });
 it("counts missing and invalid entries only for the selected assessment roster", () => {
  expect(missingAssessmentMarks(["s1", "s2", "s3", "s4", "s5"], [{ studentId: "s1", marks: null, isAbsent: false }, { studentId: "s2", marks: -1, isAbsent: false }, { studentId: "s3", marks: 31, isAbsent: false }, { studentId: "s4", marks: NaN, isAbsent: false }], 30)).toBe(5);
 });
});
