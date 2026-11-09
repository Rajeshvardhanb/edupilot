import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decisions: vi.fn(), students: vi.fn(), offerings: vi.fn(), attendance: vi.fn(), backlogs: vi.fn(),
  registrations: vi.fn(), register: vi.fn(), audit: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: {
  attendanceCondonation: { findMany: mocks.decisions }, student: { findMany: mocks.students }, courseOffering: { findMany: mocks.offerings },
  supplementaryRegistration: { findMany: mocks.registrations, createMany: mocks.register },
} }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(async () => ({ id: "user", studentId: "student", role: "STUDENT" })) }));
vi.mock("@/lib/scope", () => ({ currentTerm: vi.fn(async () => ({ id: "term" })), assertOffering: vi.fn() }));
vi.mock("@/lib/attendance", () => ({ attendanceSummary: mocks.attendance }));
vi.mock("@/lib/rules", () => ({ getRules: vi.fn(async () => ({ attendanceRequired: 75, attendanceCondonable: 65 })) }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/eligibility", async (original) => ({ ...await original<object>(), backlogSubjects: mocks.backlogs }));

import { hallTicketStatus } from "@/lib/eligibility";
import { registerSupplementary } from "@/actions/exams";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.decisions.mockResolvedValue([]);
  mocks.offerings.mockResolvedValue([{ id: "course" }]);
  mocks.registrations.mockResolvedValue([]);
  mocks.register.mockResolvedValue({ count: 1 });
});

describe("hall-ticket eligibility without finance", () => {
  it("issues a ticket using attendance without needing any invoice data", async () => {
    mocks.students.mockResolvedValue([{ id: "student", batchId: "batch", leaves: [] }]);
    mocks.attendance.mockResolvedValue(new Map([["student:course", { attended: 8, total: 10 }]]));
    const status = (await hallTicketStatus(["student"], "term")).get("student");
    expect(status).toMatchObject({ eligible: true, attendance: 80, reasons: [] });
  });
  it("still withholds low-attendance tickets and requires a term-specific explicit approval", async () => {
    mocks.students.mockResolvedValue([{ id: "student", batchId: "batch", leaves: [] }]);
    mocks.attendance.mockResolvedValue(new Map([["student:course", { attended: 7, total: 10 }]]));
    expect((await hallTicketStatus(["student"], "term")).get("student")?.eligible).toBe(false);
    mocks.decisions.mockResolvedValue([{ studentId: "student", status: "APPROVED" }]);
    expect((await hallTicketStatus(["student"], "term")).get("student")).toMatchObject({ eligible: true, condoned: true });
  });
});

describe("condonation boundaries", () => {
 it("does not override the absolute minimum attendance and ignores rejected decisions", async () => {
  mocks.students.mockResolvedValue([{ id: "student", batchId: "batch" }]);
  mocks.decisions.mockResolvedValue([{ studentId: "student", status: "APPROVED" }]);
  mocks.attendance.mockResolvedValue(new Map([["student:course", { attended: 6, total: 10 }]]));
  expect((await hallTicketStatus(["student"], "term")).get("student")?.eligible).toBe(false);
  mocks.attendance.mockResolvedValue(new Map([["student:course", { attended: 7, total: 10 }]]));
  mocks.decisions.mockResolvedValue([{ studentId: "student", status: "REVOKED" }]);
  expect((await hallTicketStatus(["student"], "term")).get("student")?.eligible).toBe(false);
  expect(mocks.decisions.mock.calls.at(-1)![0].where.termId).toBe("term");
 });
 it("withholds hall tickets when no term is configured", async () => {
  mocks.students.mockResolvedValue([{ id: "student", batchId: "batch" }]);
  expect((await hallTicketStatus(["student"], undefined)).get("student")?.eligible).toBe(false);
 });
});

describe("supplementary registration without fees", () => {
  it("registers valid backlogs once without raising an invoice", async () => {
    mocks.backlogs.mockResolvedValue([{ offering: { subjectId: "subject", subject: { code: "CS101" } } }]);
    const fd = new FormData();
    fd.append("subjectId", "subject");
    fd.append("subjectId", "subject");
    const result = await registerSupplementary({}, fd);
    expect(result.ok).toBe(true);
    expect(mocks.register).toHaveBeenCalledWith({ data: [{ studentId: "student", subjectId: "subject", termId: "term" }], skipDuplicates: true });
  });
  it("rejects subjects that are not the student's backlog", async () => {
    mocks.backlogs.mockResolvedValue([]);
    const fd = new FormData(); fd.set("subjectId", "other-student-subject");
    expect((await registerSupplementary({}, fd)).error).toContain("backlog");
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
