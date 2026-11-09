import { describe, expect, it } from "vitest";
import collegeData from "../../college-data.json";
const identities = collegeData.students;
import { identityPlan } from "../../scripts/sync-student-identities.mjs";

const legacy = () => identities.map((_, index) => {
  const rollNo = `24BTCSE${String(index + 1).padStart(3, "0")}`;
  return { id: `student-${index}`, userId: `user-${index}`, rollNo,
    user: { name: "Generated sample name", role: "STUDENT", email: index === 0 ? "student@edupilot.edu" : `${rollNo.toLowerCase()}@student.edupilot.edu` },
    batch: { program: { code: "BTCSE" }, admissionYear: 2024, section: "A" } };
});

describe("client-supplied student identity migration", () => {
  it("maps the exact legacy slots while preserving record IDs and assigns the named logins", () => {
    const rows = legacy();
    const plan = identityPlan(identities, rows);
    expect(plan).toHaveLength(21);
    expect(plan[0]).toMatchObject({ id: "student-0", userId: "user-0", email: "bhargav.p@edupilot.edu", name: identities[0].name });
    expect(plan[5]).toMatchObject({ id: "student-5", rollNo: "24MQ5A0509", name: "LANKE SANDHYA", email: "sandhya.lanke@edupilot.edu" });
    expect(rows[5].rollNo).toBe("24BTCSE006");
  });
  it("is idempotent after applying the identities", () => {
    const rows = legacy();
    const plan = identityPlan(identities, rows);
    plan.forEach((p, i) => { rows[i].rollNo = p.rollNo; rows[i].user.name = p.name; rows[i].user.email = p.email; });
    expect(identityPlan(identities, rows).every(p => !p.changed)).toBe(true);
  });
  it("refuses to guess when a legacy record is missing", () => {
    expect(() => identityPlan(identities, legacy().slice(1))).toThrow(/Missing or conflicting/);
  });
  it("rejects collisions between an existing real roll number and a legacy record", () => {
    const rows = legacy();
    rows.push({ ...rows[0], id: "different-student", rollNo: identities[0].rollNo });
    expect(() => identityPlan(identities, rows)).toThrow(/Missing or conflicting/);
  });
  it.each(["batch", "role", "email"])("rejects an unrelated %s", field => {
    const rows = legacy();
    if (field === "batch") rows[0].batch.section = "B";
    if (field === "role") rows[0].user.role = "ADMIN";
    if (field === "email") rows[0].user.email = "real-person@example.org";
    expect(() => identityPlan(identities, rows)).toThrow(/does not match/);
  });
  it("rejects incomplete or duplicated supplied identities", () => {
    expect(() => identityPlan(identities.slice(1), legacy())).toThrow(/21 unique/);
    expect(() => identityPlan(identities.map((s, i) => i === 0 ? identities[1] : s), legacy())).toThrow(/21 unique/);
  });
});
