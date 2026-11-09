import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reserve: vi.fn(), row: vi.fn(), count: vi.fn(), last: vi.fn(), create: vi.fn(), send: vi.fn(), configured: vi.fn() }));
vi.mock("@/lib/db", () => {
 const tx = { emailChallenge: { updateMany: m.reserve, findUniqueOrThrow: m.row, count: m.count, findFirst: m.last, create: m.create } };
 return { db: { ...tx, emailChallenge: { ...tx.emailChallenge, update: vi.fn() }, $transaction: async (f: (t: unknown) => unknown) => f(tx) } };
});
vi.mock("@/lib/mail", () => ({ mailConfigured: m.configured, sendMail: m.send }));
import { db } from "@/lib/db";
import { checkEmailChallenge, consumeEmailChallenge, issueEmailChallenge, verificationHash } from "@/lib/email-verification";
const input = { id: "challenge", userId: "owner", purpose: "PROFILE", payloadHash: "exact-changes", targetEmail: "person@example.org", code: "123456" };
beforeEach(() => { vi.clearAllMocks(); m.reserve.mockResolvedValue({ count: 1 }); m.row.mockResolvedValue({ codeHash: verificationHash(input.purpose, input.userId, input.payloadHash, input.targetEmail, input.code) }); m.count.mockResolvedValue(0); m.last.mockResolvedValue(null); m.create.mockResolvedValue({ id: "challenge" }); m.send.mockResolvedValue("SENT"); m.configured.mockReturnValue(true); });
describe("email OTP protections", () => {
 it("binds codes to owner, purpose, recipient, exact payload, expiry and attempt budget", async () => {
  expect(await checkEmailChallenge(db, input)).toBe(true);
  expect(m.reserve.mock.calls[0][0]).toMatchObject({ where: { id: "challenge", userId: "owner", purpose: "PROFILE", payloadHash: "exact-changes", targetEmail: "person@example.org", usedAt: null, attempts: { lt: 5 }, expiresAt: { gt: expect.any(Date) } }, data: { attempts: { increment: 1 } } });
  for (const patch of [{ code: "654321" }, { userId: "other" }, { purpose: "SETUP" }, { payloadHash: "edited-after-send" }, { targetEmail: "different@example.org" }]) expect(await checkEmailChallenge(db, { ...input, ...patch })).toBe(false);
 });
 it("rejects expired, exhausted, missing and consumed challenges before reading their hashes", async () => {
  m.reserve.mockResolvedValue({ count: 0 });
  expect(await checkEmailChallenge(db, input)).toBe(false);expect(m.row).not.toHaveBeenCalled();
  await expect(consumeEmailChallenge(db, input.id)).rejects.toThrow("already been used");
 });
 it("malformed codes still reserve an attempt", async () => {
  expect(await checkEmailChallenge(db, { ...input, code: "abc" })).toBe(false);expect(m.reserve).toHaveBeenCalled();expect(m.row).not.toHaveBeenCalled();
 });
 it("stores hashes and returns only an opaque ID; redacts OTP from delivery log", async () => {
  expect(await issueEmailChallenge(input.userId, input.purpose, input.payloadHash, input.targetEmail)).toBe("challenge");
  const email = m.send.mock.calls[0][0], data = m.create.mock.calls[0][0].data;
  expect(email.code).toMatch(/^\d{6}$/);expect(data).not.toHaveProperty("code");expect(data.codeHash).not.toBe(email.code);expect(email.logText).not.toContain(email.code);
 });
 it("rate limits floods and resends and refuses to bypass missing SMTP", async () => {
  m.count.mockResolvedValue(8);await expect(issueEmailChallenge("u", "PROFILE", "p", "a@example.org")).rejects.toThrow("Too many");expect(m.send).not.toHaveBeenCalled();
  m.count.mockResolvedValue(0);m.last.mockResolvedValue({ createdAt: new Date() });await expect(issueEmailChallenge("u", "PROFILE", "p", "a@example.org")).rejects.toThrow("one minute");
  m.configured.mockReturnValue(false);await expect(issueEmailChallenge("u", "PROFILE", "p", "a@example.org")).rejects.toThrow("not configured");
 });
});
