import { inWords,pct,titleCase,yearOfSemester } from "@/lib/format";
import { pdfText } from "@/lib/pdf";
import { ineligibility } from "@/lib/placements";
import { passwordProblem } from "@/lib/security";
import { describe,expect,it } from "vitest";

describe("password policy", () => {
  it("accepts a reasonable password", () => expect(passwordProblem("Monsoon2026x")).toBeNull());
  it.each([["short1", "at least 8"], ["abcdefghij", "letters and numbers"], ["1234567890", "letters and numbers"], ["Password123", "too common"], ["welcome2026", "too common"]])(
    "rejects %s", (pw, reason) => expect(passwordProblem(pw)).toContain(reason));
  it("rejects a password containing the user's name or ID", () => {
    expect(passwordProblem("ravi2026desai", ["ravi"])).toContain("name, email or ID");
    expect(passwordProblem("xy2026abcdef", ["xy"])).toBeNull(); // very short fragments are ignored
  });
});

describe("placement eligibility", () => {
  const drive = { eligibleLevels: "UG,PG", minCgpa: 6.5, maxBacklogs: 0 };
  const student = (over = {}) => ({ status: "ACTIVE", batch: { currentSemester: 7, program: { level: "UG" as const, totalSemesters: 8 } }, ...over });
  it("allows a final-year student who meets the cut-offs", () => expect(ineligibility(drive, student(), { cgpa: 7, backlogs: 0 })).toBeNull());
  it("explains each reason for refusal", () => {
    expect(ineligibility(drive, student(), { cgpa: 6.4, backlogs: 0 })).toContain("CGPA");
    expect(ineligibility(drive, student(), { cgpa: 8, backlogs: 1 })).toContain("backlog");
    expect(ineligibility(drive, student({ status: "DETAINED" }), { cgpa: 8, backlogs: 0 })).toContain("active");
    expect(ineligibility(drive, student({ batch: { currentSemester: 3, program: { level: "UG", totalSemesters: 8 } } }), { cgpa: 8, backlogs: 0 })).toContain("final year");
    expect(ineligibility(drive, student({ batch: { currentSemester: 5, program: { level: "DIPLOMA", totalSemesters: 6 } } }), { cgpa: 8, backlogs: 0 })).toContain("only");
  });
});

describe("helpers", () => {
  it("makes text safe for the PDF fonts", () => {
    expect(pdfText("₹1,000 → paid ≥ ‘ok’")).toBe("Rs. 1,000 -> paid >= 'ok'");
    expect(pdfText("తెలుగు")).toBe("??????");
  });

  it("formats amounts in Indian words and common values", () => {
    expect(inWords(1000)).toBe("One Thousand Rupees Only");
    expect(inWords(98500)).toBe("Ninety Eight Thousand Five Hundred Rupees Only");
    expect(inWords(12345678)).toBe("One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only");
    expect(inWords(0)).toBe("Zero Rupees Only");
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(5, 0)).toBe(0);
    expect(titleCase("BANK_TRANSFER")).toBe("Bank Transfer");
    expect([1, 2, 3, 8].map(yearOfSemester)).toEqual([1, 1, 2, 4]);
  });
});
