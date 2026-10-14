import { describe, expect, it } from "vitest";
import { computePay, workingDaysIn } from "@/lib/payroll";
import { DEFAULT_RULES, graceNeeded, regrade } from "@/lib/grading";
import { ineligibility } from "@/lib/placements";
import { alertKind } from "@/lib/notify";
import { translator } from "@/lib/i18n";

describe("working days in a month", () => {
  it("leaves out Sundays", () => {
    expect(workingDaysIn("2026-09")).toBe(26); // September 2026 has 30 days and 4 Sundays
    expect(workingDaysIn("2026-02")).toBe(24); // 28 days, 4 Sundays
  });
  it("leaves out holidays, but a holiday on a Sunday is not counted twice", () => {
    expect(workingDaysIn("2026-09", [14, 15])).toBe(24);
    expect(workingDaysIn("2026-09", [6])).toBe(26); // 6 Sept 2026 is a Sunday
  });
});

describe("monthly pay", () => {
  const s = { basic: 50000, hra: 8000, da: 21000, allowances: 3600, pfPercent: 12, otherDeductions: 200 };
  it("full month: gross less provident fund and fixed deductions", () => {
    expect(computePay(s, 26, 0)).toMatchObject({ gross: 82600, pf: 6000, lopDeduction: 0, paidDays: 26, net: 76400 });
  });
  it("loss-of-pay days reduce pay in proportion to working days; half days count half", () => {
    const p = computePay(s, 26, 1.5);
    expect(p.lopDeduction).toBe(Math.round((82600 / 26) * 1.5));
    expect(p.paidDays).toBe(24.5);
    expect(p.net).toBe(82600 - p.lopDeduction - 6000 - 200);
  });
  it("never pays less than nothing and never docks more days than the month has", () => {
    expect(computePay({ ...s, otherDeductions: 500000 }, 26, 0).net).toBe(0);
    expect(computePay(s, 26, 40).lopDays).toBe(26);
  });
});

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

describe("alert kinds and translations", () => {
  it("sorts an alert by the page it links to", () => {
    expect(alertKind("/fees/receipt/abc")).toBe("fees");
    expect(alertKind("/exams/revaluation")).toBe("results");
    expect(alertKind("/staff/leave")).toBe("leave");
    expect(alertKind("/gate")).toBe("other");
    expect(alertKind(undefined)).toBe("other");
  });
  it("page titles and empty states are translated; unknown text stays in English", () => {
    expect(translator("hi")("My attendance")).toBe("मेरी उपस्थिति");
    expect(translator("te")("No notices yet")).toBe("ఇంకా నోటీసులు లేవు");
    expect(translator("hi")("Some new heading")).toBe("Some new heading");
    expect(translator("en")("My attendance")).toBe("My attendance");
  });
});
