import { DEFAULT_RULES,graceNeeded,regrade } from "@/lib/grading";
import { ineligibility } from "@/lib/placements";
import { describe,expect,it } from "vitest";

describe("revised and moderated results", () => {
  const subject = { internalMax: 40, externalMax: 60 };
  it("regrades from scaled marks", () => {
    expect(regrade(subject, 30, 45)).toMatchObject({ total: 75, grade: "A", gradePoint: 8, passed: true });
    expect(regrade(subject, 30, 20)).toMatchObject({ passed: false, grade: "F" }); // 50% overall but under 35% in the paper
  });
  it("grace is the fewest marks that turn a fail into a pass", () => {
    expect(graceNeeded(subject, 30, 20, 3)).toBe(1); // 21/60 = 35%
    expect(graceNeeded(subject, 10, 27, 5)).toBe(3); // needs a total of 40
    expect(graceNeeded(subject, 10, 20, 5)).toBeNull(); // 10 short
    expect(graceNeeded(subject, 30, 45, 5)).toBe(0); // already passing
  });
  it("follows the college's own pass rule", () => {
    expect(graceNeeded(subject, 30, 20, 3, { ...DEFAULT_RULES, minExternalPercent: 40 })).toBeNull(); // would need 24
    expect(graceNeeded(subject, 30, 22, 3, { ...DEFAULT_RULES, minExternalPercent: 40 })).toBe(2);
  });
});

describe("placement eligibility by year", () => {
  const drive = { eligibleLevels: "UG", minCgpa: 6, maxBacklogs: 0 };
  const at = (sem: number) => ({ status: "ACTIVE", batch: { currentSemester: sem, program: { level: "UG" as const, totalSemesters: 8 } } });
  const ok = { cgpa: 7.5, backlogs: 0 };
  it("default: pre-final and final year", () => {
    expect(ineligibility(drive, at(4), ok)).toMatch(/pre-final/);
    expect(ineligibility(drive, at(5), ok)).toBeNull();
  });
  it("can be narrowed to the final year or opened to everyone", () => {
    expect(ineligibility(drive, at(6), ok, 1)).toMatch(/final year only/);
    expect(ineligibility(drive, at(7), ok, 1)).toBeNull();
    expect(ineligibility(drive, at(1), ok, 99)).toBeNull();
  });
});

