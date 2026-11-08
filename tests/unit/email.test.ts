import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderEmail } from "@/lib/email-template";

const mock = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), send: vi.fn(), transport: vi.fn(), inst: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { emailLog: { create: mock.create, update: mock.update } } }));
vi.mock("@/lib/institution", () => ({ getInstitution: mock.inst }));
vi.mock("nodemailer", () => ({ default: { createTransport: mock.transport } }));
import { sendMail } from "@/lib/mail";

const college = { name: "SVIET <College>", shortName: "SVIET", brandColor: "#7135d8" };
beforeEach(() => {
 vi.clearAllMocks();
 vi.stubEnv("SMTP_HOST", "localhost"); vi.stubEnv("SMTP_PORT", "2525"); vi.stubEnv("SMTP_USER", "sender@example.org"); vi.stubEnv("SMTP_PASS", "test-secret"); vi.stubEnv("SMTP_FROM", "");
 mock.create.mockResolvedValue({ id: "mail-1" }); mock.update.mockResolvedValue({}); mock.inst.mockResolvedValue(college);
 mock.transport.mockReturnValue({ sendMail: mock.send }); mock.send.mockResolvedValue({ accepted: ["student@example.org"], rejected: [] });
});

describe("email rendering", () => {
 it("escapes all user content and provides a button and plain-text fallback", () => {
  const r = renderEmail({ subject: '<script>alert(1)</script>', text: 'Hello <img src=x>\n\nNext paragraph', category: "academic", details: [{ label: '<b>Label</b>', value: '"value"' }], link: { label: '<b>Open</b>', url: "https://college.example.org/results?a=1&b=2" } }, college);
  expect(r.html).not.toContain('<script>'); expect(r.html).not.toContain('<img src=x>'); expect(r.html).toContain('&lt;script&gt;'); expect(r.html).toContain('a=1&amp;b=2'); expect(r.text).toContain('https://college.example.org/results?a=1&b=2'); expect(r.html).toContain('role="presentation"');
 });
 it.each(["javascript:alert(1)", "data:text/html,bad", "not a url"])("removes unsafe button target %s", url => {
  const r = renderEmail({ subject: "Test", text: "Body", link: { label: "Click", url } }, college);
  expect(r.html).not.toContain('href='); expect(r.text).not.toContain(url);
 });
 it("uses a safe color when the configured color contains markup", () => {
  const r = renderEmail({ subject: "Test", text: "Body" }, { ...college, brandColor: 'red"><script>' });
  expect(r.html).not.toContain('red"><script>'); expect(r.html).toContain('#7135d8');
 });
 it("renders a separate OTP block and expiry content", () => {
  const r = renderEmail({ subject: "Sign-in code", text: "Expires in 10 minutes", category: "security", code: "123456" }, college);
  expect(r.html).toContain('123456'); expect(r.text).toContain('Verification code: 123456'); expect(r.html).toContain('Expires in 10 minutes');
 });
 it.each(["account", "security", "academic", "request", "learning", "placement", "system"] as const)("renders the %s category without external image dependencies", category => {
  const r = renderEmail({ subject: "An update", text: "Hello", category }, college);
  expect(r.html).toContain('<!doctype html>'); expect(r.html).not.toContain('<img'); expect(r.text).toContain('SVIET <College>');
 });
});

describe("SMTP delivery and outbox", () => {
 it("normalizes the recipient, records before sending and falls back to a valid sender", async () => {
  expect(await sendMail({ to: ' STUDENT@example.org ', subject: 'Update', text: 'Record saved', key: 'event-1' })).toBe('SENT');
  expect(mock.create.mock.calls[0][0].data).toMatchObject({ to: 'student@example.org', status: 'SENDING' });
  expect(mock.create.mock.invocationCallOrder[0]).toBeLessThan(mock.send.mock.invocationCallOrder[0]);
  expect(mock.send.mock.calls[0][0].from).toBe('"SVIET" <sender@example.org>');
  expect(mock.send.mock.calls[0][0]).toHaveProperty('html'); expect(mock.send.mock.calls[0][0]).toHaveProperty('text');
  expect(mock.update).toHaveBeenCalledWith({ where: { id: 'mail-1' }, data: { status: 'SENT', error: null } });
 });
 it("does not send a duplicate event when another process reserved it", async () => {
  mock.create.mockRejectedValue({ code: 'P2002' });
  expect(await sendMail({ to: 'student@example.org', subject: 'Update', text: 'Body', key: 'same-event' })).toBe('SKIPPED'); expect(mock.send).not.toHaveBeenCalled();
 });
 it("does not send when the outbox cannot be recorded", async () => {
  mock.create.mockRejectedValue(new Error('database unavailable'));
  expect(await sendMail({ to: 'student@example.org', subject: 'Update', text: 'Body' })).toBe('FAILED'); expect(mock.send).not.toHaveBeenCalled();
 });
 it("records disabled SMTP as not configured", async () => {
  vi.stubEnv('SMTP_HOST', '');
  expect(await sendMail({ to: 'student@example.org', subject: 'Update', text: 'Body' })).toBe('NOT_CONFIGURED'); expect(mock.send).not.toHaveBeenCalled();
 });
 it.each([{ to: 'bad-address', subject: 'Test' }, { to: 'student@example.org', subject: 'Hello\r\nBcc: victim@example.org' }])("rejects invalid envelope data", async mail => {
  expect(await sendMail({ ...mail, text: 'Body' })).toBe('FAILED'); expect(mock.send).not.toHaveBeenCalled();
 });
 it("records SMTP rejection without exposing the SMTP password", async () => {
  mock.send.mockRejectedValue(new Error('server rejected test-secret'));
  expect(await sendMail({ to: 'student@example.org', subject: 'Test', text: 'Body' })).toBe('FAILED');
  expect(mock.update.mock.calls[0][0].data.error).toBe('server rejected [redacted]');
 });
 it("does not report success when SMTP accepts no recipient", async () => {
  mock.send.mockResolvedValue({ accepted: [], rejected: ['student@example.org'] });
  expect(await sendMail({ to: 'student@example.org', subject: 'Test', text: 'Body' })).toBe('FAILED');
 });
 it("redacts codes and reset links from stored outbox content", async () => {
  await sendMail({ to: 'student@example.org', subject: 'Sign-in verification', text: 'Code details', code: '987654', link: { label: 'Reset', url: 'https://college.example.org/reset?token=secret-token' }, logText: 'Sensitive content hidden.' });
  expect(mock.create.mock.calls[0][0].data.body).toContain('Sensitive content hidden.'); expect(mock.create.mock.calls[0][0].data.body).not.toContain('987654'); expect(mock.create.mock.calls[0][0].data.body).not.toContain('secret-token'); expect(mock.send.mock.calls[0][0].text).toContain('987654');
 });
});
