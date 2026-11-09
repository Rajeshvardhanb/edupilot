import { describe, expect, it } from "vitest";
import original from "../../college-data.json";
import { collegeDataSchema } from "../../src/lib/college-data-schema";
import { demoLoginEmails } from "../../src/lib/college-data";

describe("client editable college data", () => {
  it("contains the complete published CSE roster and the supplied students", () => {
    const data = collegeDataSchema.parse(original);
    expect(data.faculty.filter(f => f.departmentCode === "CSE")).toHaveLength(40);
    expect(data.students).toHaveLength(21);
    expect(data.faculty.find(f => f.employeeId === "EMP0001")?.name).toBe("Dr. G. Syam Prasad");
    expect(demoLoginEmails()).toMatchObject({ student: "sandhya.lanke@edupilot.edu", faculty: "faculty@edupilot.edu" });
  });
  it("rejects case-insensitive login and identifier collisions", () => {
    const data = structuredClone(original);
    data.faculty[2].email = data.students[0].email.toUpperCase();
    expect(() => collegeDataSchema.parse(data)).toThrow(/Duplicate login email/);
    data.faculty[2].email = original.faculty[2].email;
    data.faculty[2].employeeId = data.faculty[0].employeeId.toLowerCase();
    expect(() => collegeDataSchema.parse(data)).toThrow(/Duplicate faculty/);
  });
  it("rejects invalid HOD assignments and dangling demo references", () => {
    const data = structuredClone(original);
    data.departments[1].hodEmployeeId = "EMP0001";
    expect(() => collegeDataSchema.parse(data)).toThrow(/faculty member of that department/);
    data.departments[1].hodEmployeeId = null;
    data.demoLogins.studentRollNo = "MISSING";
    expect(() => collegeDataSchema.parse(data)).toThrow(/student reference/);
  });
  it("rejects unrecognized fields and unsafe privilege/password additions", () => {
    expect(() => collegeDataSchema.parse({ ...original, password: "secret" })).toThrow();
    const data = structuredClone(original);
    expect(() => collegeDataSchema.parse({ ...data, accounts: [{ ...data.accounts[0], role: "SUPERADMIN" }] })).toThrow();
    expect(() => collegeDataSchema.parse({ ...data, faculty: [{ ...data.faculty[0], role: "ADMIN" }] })).toThrow();
  });
});
