import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ users: vi.fn(), students: vi.fn(), links: vi.fn(), leave: vi.fn(), results: vi.fn(), material: vi.fn(), offering: vi.fn(), send: vi.fn(), after: vi.fn(), notices: vi.fn(), setup: vi.fn() }));
vi.mock("@/lib/account-setup", () => ({ sendAccountSetup: mock.setup }));
vi.mock("next/server", () => ({ after: mock.after }));
vi.mock("@/lib/mail", () => ({ sendMail: mock.send, appUrl: (p: string) => 'http://localhost:3100' + p }));
vi.mock("@/lib/db", () => ({ db: { notification: { createMany: mock.notices }, user: { findMany: mock.users }, student: { findMany: mock.students }, parentLink: { findMany: mock.links }, leaveRequest: { findUniqueOrThrow: mock.leave }, subjectResult: { findMany: mock.results }, material: { findUniqueOrThrow: mock.material }, courseOffering: { findUniqueOrThrow: mock.offering } } }));
import { dispatchAcademicEmail, emailStudents, emailUsers, notifyAcademic } from "@/lib/academic-email";
beforeEach(() => {
 vi.clearAllMocks(); mock.users.mockResolvedValue([{ id: 'u', email: ' Student@example.org ' }]); mock.students.mockResolvedValue([{ id: 's', userId: 'u' }]); mock.links.mockResolvedValue([]); mock.send.mockResolvedValue('SENT');
});
describe('academic notification boundaries', () => {
 it('only queries active intended users and keeps one address per envelope', async () => {
  mock.users.mockResolvedValue([{ email: 'STUDENT@example.org' }, { email: ' student@example.org ' }, { email: 'parent@example.org' }]);
  await emailUsers(['u','u','p'], { key: 'event', subject: 'Update', text: 'Body' });
  expect(mock.users.mock.calls[0][0].where).toEqual({ id: { in: ['u','p'] }, isActive: true });
  expect(mock.send).toHaveBeenCalledTimes(2); expect(mock.send.mock.calls[0][0].to).toBe('student@example.org'); expect(mock.send.mock.calls[1][0].to).toBe('parent@example.org');
 });
 it('notifies only explicitly linked parent accounts, never guardian contact fields', async () => {
  mock.links.mockResolvedValue([{ userId: 'p' }]);
  await emailStudents(['s'], { key: 'result', subject: 'Results', text: 'Review portal' }, true);
  expect(mock.links.mock.calls[0][0]).toEqual({ where: { studentId: { in: ['s'] } }, select: { userId: true } });
  expect(mock.users.mock.calls[0][0].where.id.in).toEqual(['u']); expect(mock.users.mock.calls[1][0].where.id.in).toEqual(['p']); expect(mock.send.mock.calls[1][0].link.url).toBe('http://localhost:3100/dashboard');
 });
 it('keeps teaching notices student-only', async () => {
  await emailStudents(['s'], { key: 'material', subject: 'Material', text: 'Body' }); expect(mock.links).not.toHaveBeenCalled();
 });
 it('does not disclose grade values in result messages', async () => {
  mock.results.mockResolvedValue([{ id: 'result-id', studentId: 's', offering: { subject: { name: 'Computer Networks' } } }]);
  await dispatchAcademicEmail({ type: 'results', id: 'offering' });
  expect(mock.results.mock.calls[0][0].where.offering.resultsPublished).toBe(true); expect(mock.send.mock.calls[0][0].text).toContain('View your grade card securely'); expect(mock.send.mock.calls[0][0].link.url).toBe('http://localhost:3100/results');
 });
 it('includes an assignment due date and only its enrolled course recipients', async () => {
  mock.material.mockResolvedValue({ id: 'm', offeringId: 'o', kind: 'ASSIGNMENT', title: 'Network report', dueDate: new Date('2026-12-01') });
  mock.offering.mockResolvedValue({ batchId: 'b', subject: { name: 'Networks', semester: 5 } });
  await dispatchAcademicEmail({ type: 'material', id: 'm' });
  expect(mock.students.mock.calls[0][0].where).toMatchObject({ batchId: 'b', status: 'ACTIVE', entrySemester: { lte: 5 } });
  expect(mock.send.mock.calls[0][0].details).toEqual([{ label: 'Due date', value: '2026-12-01' }]);
 });
 it('hides medical reasons and decision notes from leave messages', async () => {
  mock.leave.mockResolvedValue({ studentId: 's', status: 'APPROVED', fromDate: new Date('2026-11-10'), toDate: new Date('2026-11-11'), reason: 'private diagnosis', reviewNote: 'private review note' });
  await dispatchAcademicEmail({ type: 'leave-decision', id: 'request' });
  expect(mock.send.mock.calls[0][0].text).toContain('approved'); expect(JSON.stringify(mock.send.mock.calls[0])).not.toContain('private diagnosis'); expect(JSON.stringify(mock.send.mock.calls[0])).not.toContain('private review note');
 });
 it('never generates absence notifications for historical data entry', async () => {
  await dispatchAcademicEmail({ type: 'attendance', id: 'o', date: '2001-01-01' }); expect(mock.send).not.toHaveBeenCalled(); expect(mock.offering).not.toHaveBeenCalled();
 });
 it('keeps in-app notifications when academic email is disabled and deduplicates per user', async () => {
  process.env.ACADEMIC_EMAILS_ENABLED = '0';
  try {
   await emailUsers(['u'], { key: 'leave:request:APPROVED', category: 'request', subject: 'Leave decision', text: 'Approved', link: { label: 'Review', url: 'http://localhost:3100/leave' } });
   expect(mock.notices).toHaveBeenCalledWith({ data: [expect.objectContaining({ userId: 'u', category: 'REQUEST', href: '/leave', entityType: 'leave', entityId: 'request' })], skipDuplicates: true });
   expect(mock.send).not.toHaveBeenCalled();
  } finally { delete process.env.ACADEMIC_EMAILS_ENABLED; }
 });
 it('new accounts use a dedicated password setup invitation', async () => {
  await dispatchAcademicEmail({ type: 'account', id: 'new' });
  expect(mock.setup).toHaveBeenCalledWith('new');
 });
 it('schedules post-response work and contains preparation failures', async () => {
  mock.users.mockRejectedValue(new Error('database unavailable'));
  notifyAcademic({ type: 'security', id: 'u', action: 'Changed', version: '1' }); expect(mock.after).toHaveBeenCalledTimes(1);
  await expect(mock.after.mock.calls[0][0]()).resolves.toBeUndefined();
 });
});
