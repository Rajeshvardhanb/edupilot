import { describe, expect, it } from "vitest";
import sampleRolls from "../../src/lib/sample-student-rolls.json";
import collegeData from "../../college-data.json";
const identities = collegeData.students;
import { presentationRead, visibleStudentWhere } from "../../src/lib/student-visibility";

describe("presentation student visibility", () => {
  it("hides precisely the original 403 generated identities and excludes the supplied roster", () => {
    expect(sampleRolls).toHaveLength(403);
    expect(new Set(sampleRolls).size).toBe(403);
    expect(identities.every(s => !sampleRolls.includes(s.rollNo))).toBe(true);
    expect(sampleRolls).not.toContain("NEW-STUDENT-001");
  });
  it("preserves unique IDs and role filters while adding visibility", () => {
    const args = { where: { id: "s", AND: [{ batchId: "allowed" }] }, take: 25 };
    expect(presentationRead("Student", "findUnique", args)).toEqual({
      ...args, where: { id: "s", AND: [{ batchId: "allowed" }, visibleStudentWhere] },
    });
    expect(args.where.AND).toEqual([{ batchId: "allowed" }]);
  });
  it.each(["findMany", "findFirst", "count", "aggregate", "groupBy"])("scopes %s", op => {
    expect(presentationRead("Student", op, {})).toEqual({ where: { AND: [visibleStudentWhere] } });
  });
  it("filters nested batch rosters and their counts", () => {
    const result = presentationRead("CourseOffering", "findMany", {
      include: { batch: { include: { students: { where: { status: "ACTIVE" }, include: { user: true } }, _count: { select: { students: true } } } } },
    });
    const batch = (result.include as { batch: { include: Record<string, unknown> } }).batch.include;
    expect(batch.students).toEqual({ where: { status: "ACTIVE", AND: [visibleStudentWhere] }, include: { user: true } });
    expect(batch._count).toEqual({ select: { students: { where: { AND: [visibleStudentWhere] } } } });
  });
  it("filters submissions and applications with required student relations", () => {
    const result = presentationRead("Material", "findMany", { include: { submissions: { include: { student: { include: { user: true } } } } } });
    const submissions = (result.include as { submissions: { where: unknown } }).submissions;
    expect(submissions.where).toEqual({ AND: [{ AND: [{ student: visibleStudentWhere }] }] });
    expect(presentationRead("PlacementApplication", "count", {}).where).toEqual(submissions.where);
  });
  it("hides sample student accounts while retaining staff and parent accounts", () => {
    expect(presentationRead("User", "findMany", {}).where).toEqual({
      AND: [{ AND: [{ OR: [{ student: null }, { student: visibleStudentWhere }] }] }],
    });
  });
  it("scopes unfiltered relation counts and true nested relation selections", () => {
    const result = presentationRead("Batch", "findMany", { include: { students: true, _count: true } });
    const include = result.include as { students: unknown; _count: { select: { students: unknown } } };
    expect(include.students).toEqual({ where: { AND: [visibleStudentWhere] } });
    expect(include._count.select.students).toEqual({ where: { AND: [visibleStudentWhere] } });
  });
  it.each(["create", "update", "updateMany", "deleteMany"])("leaves %s unchanged", op => {
    const args = { where: { id: "sample" }, data: { name: "updated" } };
    expect(presentationRead("Student", op, args)).toBe(args);
  });
});
