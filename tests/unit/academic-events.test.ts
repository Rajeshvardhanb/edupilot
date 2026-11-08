import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), many: vi.fn(), users: vi.fn(), students: vi.fn(), parents: vi.fn(), send: vi.fn(), standings: vi.fn(), rules: vi.fn(), summary: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/lib/mail', () => ({ sendMail: m.send, appUrl: (p: string) => 'http://localhost:3100' + p }));
vi.mock('@/lib/results', () => ({ studentStandings: m.standings }));
vi.mock('@/lib/rules', () => ({ getRules: m.rules }));
vi.mock('@/lib/attendance', () => ({ attendanceSummary: m.summary }));
vi.mock('@/lib/db', () => ({ db: new Proxy({}, { get: (_, table) => table === 'user' ? { findMany: m.users } : table === 'student' ? { findMany: m.students, findUniqueOrThrow: m.find } : table === 'parentLink' ? { findMany: m.parents } : { findUniqueOrThrow: m.find, findMany: m.many } }) }));
import { dispatchAcademicEmail, notifyAcademic, type AcademicEvent } from '@/lib/academic-email';
const fixture = {
 id: 'record', userId: 'user', studentId: 'student', facultyId: 'teacher', batchId: 'batch', termId: 'term', optionId: 'option', driveId: 'drive', subjectId: 'subject',
 status: 'OPEN', roundNo: 1, marks: 8, feedback: 'private feedback', submittedAt: new Date('2026-11-01'), date: new Date('2026-11-10'), session: 'FN', period: 2,
 offering: { subject: { name: 'Networks', semester: 5 } }, subject: { name: 'Networks', semester: 5 }, faculty: { userId: 'teacher-user' }, room: { name: 'Hall A' }, roomId: 'room',
 option: { subject: { name: 'AI elective' } }, from: { userId: 'requestor' }, to: { userId: 'colleague' },
 material: { title: 'Report', offeringId: 'course', offering: { facultyId: 'teacher' } },
 drive: { company: { name: 'Example company' }, role: 'Engineer' }, company: { name: 'Example company' }, role: 'Engineer',
 eligibleLevels: 'UG', minCgpa: 6, maxBacklogs: 0, driveDate: new Date('2026-12-01'),
 batch: { program: { departmentId: 'cse' } },
};
beforeEach(() => {
 vi.clearAllMocks(); vi.stubEnv('ACADEMIC_EMAILS_ENABLED', '1');
 m.find.mockResolvedValue(fixture); m.many.mockResolvedValue([{ id: 'course', batchId: 'batch', dayOfWeek: 1, period: 2, offeringId: 'course', room: 'Room A' }]);
 m.users.mockResolvedValue([{ id: 'user', email: 'person@example.org' }]); m.students.mockResolvedValue([{ id: 'student', userId: 'user' }]); m.parents.mockResolvedValue([]); m.send.mockResolvedValue('SENT'); m.rules.mockResolvedValue({ placementSemestersLeft: 3, attendanceRequired: 75 });
});
describe('retained academic email events', () => {
 it.each([
  ['account', 'Your student management account is ready'], ['parent-link', 'A student has been linked to your parent account'], ['security', 'Your account security settings changed'],
  ['student-update', 'Your academic record has been updated'], ['submission', 'Your assignment submission was received'], ['graded', 'Your assignment feedback is ready'],
  ['exam', 'Your examination schedule has been updated'], ['supplementary', 'Supplementary examination registration confirmed'], ['elective', 'Your elective selection is confirmed'],
  ['placement-application', 'Your placement application was received'], ['placement-status', 'Your placement application has an update'],
  ['substitution', 'You have been assigned a substitute class'], ['swap-request', 'A colleague requested a class swap'], ['swap-decision', 'Your class swap request was reviewed'],
  ['course-allocation', 'A course has been assigned to you'], ['timetable', 'Your class timetable has been updated'], ['invigilation', 'Your examination duty is available'],
 ] as const)('%s sends a contextual portal message to its selected users', async (type, subject) => {
  const event = { type, id: 'record', studentIds: ['student'], message: 'Academic record updated', action: 'Password changed', version: 'v1', studentId: 'student' } as AcademicEvent;
  await dispatchAcademicEmail(event);
  expect(m.send).toHaveBeenCalled(); const mail = m.send.mock.calls[0][0]; expect(mail.subject).toBe(subject); expect(mail.to).toBe('person@example.org'); expect(mail.key).toBeTruthy(); expect(mail.link.url).toMatch(/^http:\/\/localhost:3100\//); expect(mail.text).not.toContain('private feedback');
 });
 it('limits placement announcements to students meeting the same application eligibility rules', async () => {
  const students = [
   { id: 'eligible', userId: 'user', status: 'ACTIVE', batch: { currentSemester: 5, program: { level: 'UG', totalSemesters: 8 } } },
   { id: 'too-young', userId: 'young-user', status: 'ACTIVE', batch: { currentSemester: 1, program: { level: 'UG', totalSemesters: 8 } } },
   { id: 'backlog', userId: 'backlog-user', status: 'ACTIVE', batch: { currentSemester: 5, program: { level: 'UG', totalSemesters: 8 } } },
  ];
  m.students.mockResolvedValueOnce(students).mockResolvedValueOnce([{ userId: 'user' }]);
  m.standings.mockResolvedValue(new Map([['eligible', { cgpa: 8, backlogs: 0 }], ['too-young', { cgpa: 8, backlogs: 0 }], ['backlog', { cgpa: 8, backlogs: 2 }]]));
  await dispatchAcademicEmail({ type: 'placement-open', id: 'drive' });
  expect(m.students.mock.calls[1][0].where.id.in).toEqual(['eligible']); expect(m.send).toHaveBeenCalledTimes(1);
 });
 it('does not announce a closed placement drive', async () => {
  m.find.mockResolvedValue({ ...fixture, status: 'CLOSED' }); await dispatchAcademicEmail({ type: 'placement-open', id: 'drive' }); expect(m.send).not.toHaveBeenCalled();
 });
 it.each(['leave-request','revaluation-request'] as const)('%s notifies department reviewers and acknowledges the student', async type => {
  await dispatchAcademicEmail({ type, id: 'request' });
  expect(m.users.mock.calls[0][0].where.OR).toEqual([{ role: 'ADMIN' }, { role: 'HOD', faculty: { departmentId: 'cse' } }]); expect(m.send).toHaveBeenCalledTimes(2);
 });
 it('notifies the learner about revaluation without marks in the message', async () => {
  m.find.mockResolvedValue({ ...fixture, status: 'REVISED', offering: { subject: { name: 'Networks' } } }); await dispatchAcademicEmail({ type: 'revaluation-decision', id: 'request' }); expect(m.send.mock.calls[0][0].text).toContain('latest result'); expect(m.send.mock.calls[0][0]).not.toHaveProperty('marks');
 });
 it('sends absence and shortage messages with stable daily/weekly keys', async () => {
  m.many.mockResolvedValue([{ studentId: 'student', id: 'course' }]); m.summary.mockResolvedValue(new Map([['student:course', { attended: 5, total: 20 }]]));
  const day = new Date().toISOString().slice(0, 10); await dispatchAcademicEmail({ type: 'attendance', id: 'course', date: day });
  expect(m.send).toHaveBeenCalledTimes(2); expect(m.send.mock.calls[0][0].key).toContain(day); expect(m.send.mock.calls[1][0].key).toMatch(/^shortage:student:term:/);
 });
 it('suppresses shortage warnings for students with fewer than ten recorded periods', async () => {
  m.many.mockResolvedValue([{ studentId: 'student', id: 'course' }]); m.summary.mockResolvedValue(new Map([['student:course', { attended: 0, total: 1 }]]));
  await dispatchAcademicEmail({ type: 'attendance', id: 'course', date: new Date().toISOString().slice(0, 10) }); expect(m.send).toHaveBeenCalledTimes(1);
 });
 it('can pause academic emails without affecting separately handled security mail', () => {
  vi.stubEnv('ACADEMIC_EMAILS_ENABLED', '0'); expect(() => notifyAcademic({ type: 'account', id: 'user' })).not.toThrow(); expect(m.send).not.toHaveBeenCalled();
 });
});
