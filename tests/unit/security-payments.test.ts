import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/security";
import { razorpaySignatureValid } from "@/lib/payments";
import { ineligibility } from "@/lib/placements";
import { workingDays } from "@/lib/staff";
import { waLink } from "@/lib/whatsapp";
import { toCsv } from "@/lib/reports";
import { pdfText } from "@/lib/pdf";
import { translator } from "@/lib/i18n";
import { inWords, pct, titleCase, yearOfSemester } from "@/lib/format";

describe("password policy", () => {
  it("accepts a reasonable password", () => expect(passwordProblem("Monsoon2026x")).toBeNull());
  it.each([["short1", "at least 8"], ["abcdefghij", "letters and numbers"], ["1234567890", "letters and numbers"], ["Password123", "too common"], ["welcome2026", "too common"]])(
    "rejects %s", (pw, reason) => expect(passwordProblem(pw)).toContain(reason));
  it("rejects a password containing the user's name or ID", () => {
    expect(passwordProblem("ravi2026desai", ["ravi"])).toContain("name, email or ID");
    expect(passwordProblem("xy2026abcdef", ["xy"])).toBeNull(); // very short fragments are ignored
  });
});

describe("Razorpay signature", () => {
  it("accepts only the HMAC of order|payment under the key secret", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    const good = createHmac("sha256", "test_secret").update("order_1|pay_1").digest("hex");
    expect(razorpaySignatureValid("order_1", "pay_1", good)).toBe(true);
    expect(razorpaySignatureValid("order_1", "pay_2", good)).toBe(false);   // a different payment
    expect(razorpaySignatureValid("order_2", "pay_1", good)).toBe(false);   // a different order
    expect(razorpaySignatureValid("order_1", "pay_1", "0".repeat(64))).toBe(false);
    expect(razorpaySignatureValid("order_1", "pay_1", "")).toBe(false);
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
  it("counts working days without Sundays", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    expect(workingDays(d("2026-10-12"), d("2026-10-18"))).toBe(6); // Mon–Sun
    expect(workingDays(d("2026-10-11"), d("2026-10-11"))).toBe(0); // a Sunday
  });

  it("builds WhatsApp links, assuming India for 10-digit numbers", () => {
    expect(waLink("98765 43210", "Hello & welcome")).toBe("https://wa.me/919876543210?text=Hello%20%26%20welcome");
    expect(waLink("+91 98765-43210", "x")).toBe("https://wa.me/919876543210?text=x");
    expect(waLink("12345", "x")).toBeNull();
    expect(waLink(null, "x")).toBeNull();
  });

  it("writes CSV that Excel reads correctly and that cannot run formulas", () => {
    const csv = toCsv(["Name", "Note", "Amount"], [["Rao, A", 'said "hi"', 1200], ["=HYPERLINK(1)", "@cmd", -5]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe('"Rao, A","said ""hi""",1200');
    expect(lines[2]).toBe("'=HYPERLINK(1),'@cmd,-5"); // text is neutralised; a real negative number is left alone
  });

  it("makes text safe for the PDF fonts", () => {
    expect(pdfText("₹1,000 → paid ≥ ‘ok’")).toBe("Rs. 1,000 -> paid >= 'ok'");
    expect(pdfText("తెలుగు")).toBe("??????");
  });

  it("falls back to English for untranslated labels", () => {
    expect(translator("hi")("Dashboard")).toBe("डैशबोर्ड");
    expect(translator("te")("Fees")).toBe("ఫీజులు");
    expect(translator("hi")("Something not in the dictionary")).toBe("Something not in the dictionary");
    expect(translator("en")("Dashboard")).toBe("Dashboard");
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
