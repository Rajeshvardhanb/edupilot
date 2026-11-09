import { expect, test, type APIRequestContext } from '@playwright/test';
import { db, fixtures, reseed, session, fresh, confirm } from './helpers';

test.skip(process.env.E2E_SMTP_TEST !== '1', 'Requires the isolated local SMTP sink.');
test.beforeAll(async ({ request }) => { reseed(); await request.delete('http://127.0.0.1:2526/messages'); });
test.use({ actionTimeout: 15000 });
async function messages(request: APIRequestContext) {
 const res = await request.get('http://127.0.0.1:2526/messages');
 return await res.json() as { to: string[]; raw: string }[];
}
async function waitMail(request: APIRequestContext, subject: string, to?: string) {
 await expect.poll(async () => (await messages(request)).filter(m => m.raw.includes(`Subject: ${subject}`) && (!to || m.to.includes(to))).length, { timeout: 30000 }).toBeGreaterThan(0);
 return (await messages(request)).findLast(m => m.raw.includes(`Subject: ${subject}`) && (!to || m.to.includes(to)))!;
}
const decoded = (s: string) => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

test('SMTP test uses HTML/text and failures are visible without false success', async ({ browser, request }) => {
 const p = await session(browser, 'admin@edupilot.edu'); await p.goto('/admin/email');
 await p.locator('input[name=to]').fill('inbox@example.invalid'); await p.getByRole('button', { name: 'Send test', exact: true }).click();
 const mail = await waitMail(request, 'SVIET mail test', 'inbox@example.invalid');
 expect(mail.raw).toContain('multipart/alternative'); expect(mail.raw).toContain('text/html'); expect(decoded(mail.raw)).toContain('Student Management System');
 await p.locator('input[name=to]').fill('blocked@rejected.invalid'); await p.getByRole('button', { name: 'Send test', exact: true }).click();
 await expect.poll(() => db.emailLog.count({ where: { to: 'blocked@rejected.invalid', status: 'FAILED' } })).toBe(1);
 await p.reload(); await expect(p.getByText('Failed', { exact: true }).first()).toBeVisible();
 expect((await messages(request)).some(m => m.to.includes('blocked@rejected.invalid'))).toBe(false);
 await p.context().close();
});

test('student registration sends a welcome without a password', async ({ browser, request }) => {
 const f = await fixtures(); const p = await session(browser, 'office@edupilot.edu'); await p.goto('/students/new');
 await p.locator('[name=name]').fill('Email Test Student'); await p.locator('[name=email]').fill('new-student@example.invalid');
 await p.locator('[name=rollNo]').fill('EMAIL2026TEST'); const otherBatch = await db.batch.findFirstOrThrow({ where: { id: { not: f.batchId } } }); await p.locator('[name=batchId]').selectOption(otherBatch.id);
 await p.getByRole('button', { name: 'Admit student', exact: true }).click();
 await expect(p).toHaveURL(/\/students\/[a-z0-9]+\?created=1/);
 const mail = await waitMail(request, 'Your student management account is ready', 'new-student@example.invalid');
 expect(decoded(mail.raw)).toContain('credentials supplied separately'); expect(mail.raw).not.toContain('email2026test');
 expect(mail.to).toHaveLength(1); await p.context().close();
});

test('leave sends a receipt, scoped review notices, and a decision to student and linked parent', async ({ browser, request }) => {
 const f = await fixtures(); const p = await session(browser, 'sandhya.lanke@edupilot.edu'); await p.goto('/leave');
 await p.locator('[name=fromDate]').fill('2026-11-12'); await p.locator('[name=toDate]').fill('2026-11-12');
 await p.locator('[name=reason]').fill('Private medical information for notification privacy test'); await p.getByRole('button', { name: 'Submit request', exact: true }).click();
 await waitMail(request, 'Your leave request was received', 'sandhya.lanke@edupilot.edu');
 await waitMail(request, 'A student leave request needs review', 'hod.cse@edupilot.edu');
 const reviewMails = (await messages(request)).filter(m => m.raw.includes('Subject: A student leave request needs review'));
 expect(reviewMails.every(m => !m.raw.includes('Private medical information'))).toBe(true);
 await db.leaveRequest.findFirstOrThrow({ where: { studentId: f.studentId, reason: { startsWith: 'Private medical information' } } });
 const a = await session(browser, 'admin@edupilot.edu'); await a.goto('/leave');
 await a.getByRole('row').filter({ hasText: 'Private medical information for notification privacy test' }).getByRole('button', { name: 'Approve', exact: true }).click();
 await waitMail(request, 'Your leave request has been reviewed', 'sandhya.lanke@edupilot.edu');
 await waitMail(request, 'Your leave request has been reviewed', 'parent@edupilot.edu');
 const stored = await db.emailLog.findFirstOrThrow({ where: { to: 'parent@edupilot.edu', subject: 'Your leave request has been reviewed' } }); expect(stored.body).not.toContain('Private medical information');
 await p.context().close(); await a.context().close();
});

test('assignment publication, receipt and grading use the correct course and learner', async ({ browser, request }) => {
 const f = await fixtures(); const p = await session(browser, 'faculty@edupilot.edu'); await p.goto(`/materials/${f.offeringId}`);
 const publish = p.locator('form').filter({ has: p.locator('input[name=title]') });
 await publish.locator('[name=kind]').selectOption('ASSIGNMENT'); await publish.locator('[name=title]').fill('Email integration assignment');
 await publish.locator('[name=maxMarks]').fill('10'); await publish.locator('[name=dueDate]').fill('2026-12-01'); await publish.getByRole('button', { name: 'Publish', exact: true }).click();
 await waitMail(request, 'A new assignment is available', 'sandhya.lanke@edupilot.edu');
 const m = await db.material.findFirstOrThrow({ where: { title: 'Email integration assignment' } });
 const s = await session(browser, 'sandhya.lanke@edupilot.edu'); await s.goto('/materials');
 const submit = s.locator('form').filter({ has: s.locator(`input[name=materialId][value="${m.id}"]`) });
 await submit.locator('[name=note]').fill('My integration test answer'); await submit.getByRole('button', { name: /Submit/ }).click();
 await waitMail(request, 'Your assignment submission was received', 'sandhya.lanke@edupilot.edu');
 const sub = await db.submission.findUniqueOrThrow({ where: { materialId_studentId: { materialId: m.id, studentId: f.studentId } } });
 await p.reload(); const grade = p.locator('form').filter({ has: p.locator(`input[name=id][value="${sub.id}"]`) });
 await grade.locator('[name=marks]').fill('8'); await grade.locator('[name=feedback]').fill('Private grade feedback'); await grade.getByRole('button', { name: /Save|Grade/ }).click();
 const mail = await waitMail(request, 'Your assignment feedback is ready', 'sandhya.lanke@edupilot.edu'); expect(mail.raw).not.toContain('Private grade feedback');
 expect((await messages(request)).some(m => m.to.includes('parent@edupilot.edu') && m.raw.includes('Subject: A new assignment is available'))).toBe(false);
 await p.context().close(); await s.context().close();
});

test('publication notifies linked learners without emailing marks', async ({ browser, request }) => {
 const f = await fixtures();
 const offering = await db.courseOffering.findFirstOrThrow({ where: { batchId: f.batchId, resultsPublished: true, assessments: { some: { type: 'END_SEM' } } } });
 const p = await session(browser, 'admin@edupilot.edu'); await p.goto(`/exams/${offering.id}`);
 await p.getByRole('button', { name: 'Unpublish', exact: true }).click(); await confirm(p);
 await waitMail(request, 'Your academic record has been updated', 'sandhya.lanke@edupilot.edu');
 await p.getByRole('button', { name: 'Publish results', exact: true }).click(); await confirm(p);
 await waitMail(request, 'Your course results are available', 'sandhya.lanke@edupilot.edu'); await waitMail(request, 'Your course results are available', 'parent@edupilot.edu');
 const row = await db.emailLog.findFirstOrThrow({ where: { subject: 'Your course results are available', to: 'sandhya.lanke@edupilot.edu' } }); expect(row.body).toContain('Marks are not included');
 const count = await db.emailLog.count({ where: { subject: 'Your course results are available' } }); await p.reload(); await expect(p.getByRole('button', { name: 'Publish results', exact: true })).toHaveCount(0); expect(await db.emailLog.count({ where: { subject: 'Your course results are available' } })).toBe(count);
 await p.context().close();
});

test('password recovery renders a real link but redacts it from the admin outbox', async ({ browser, request }) => {
 const p = await fresh(browser); await p.goto('/forgot-password'); await p.locator('input[name=email]').fill('sandhya.lanke@edupilot.edu'); await p.getByRole('button', { name: /Send/ }).click();
 const mail = await waitMail(request, 'Reset your password', 'sandhya.lanke@edupilot.edu'); const raw = decoded(mail.raw);
 const link = /http:\/\/localhost:3100\/reset-password\?token=([a-f0-9]+)/.exec(raw); expect(link).not.toBeNull();
 const row = await db.emailLog.findFirstOrThrow({ where: { subject: 'Reset your password', to: 'sandhya.lanke@edupilot.edu' }, orderBy: { createdAt: 'desc' } });
 expect(row.body).not.toContain(link![1]); expect(row.body).not.toContain('token=');
 await p.goto(link![0]); const password = 'CobaltRiver!2026'; await p.locator('input[name=password]').fill(password); await p.locator('input[name=confirm]').fill(password); await p.getByRole('button', { name: 'Set new password', exact: true }).click();
 await waitMail(request, 'Your account security settings changed', 'sandhya.lanke@edupilot.edu');
 await p.context().close();
});

test('staff two-step email carries a valid code without persisting the plaintext in the outbox', async ({ browser, request }) => {
 const p = await session(browser, 'faculty@edupilot.edu'); await p.goto('/profile'); await p.getByRole('button', { name: 'Turn on: email me a code', exact: true }).click();
 const mail = await waitMail(request, 'Your sign-in verification code', 'faculty@edupilot.edu'); const code = /Verification code: (\d{6})/.exec(decoded(mail.raw))?.[1]; expect(code).toBeTruthy();
 const row = await db.emailLog.findFirstOrThrow({ where: { subject: 'Your sign-in verification code', to: 'faculty@edupilot.edu' }, orderBy: { createdAt: 'desc' } }); expect(row.body).not.toContain(code!);
 await p.locator('input[name=code]').fill(code!); await p.getByRole('button', { name: 'Confirm', exact: true }).click();
 await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { email: 'faculty@edupilot.edu' } })).twoStep).toBe(true);
 await p.context().close();
});


test('admin retries a previously unconfigured notice once and cannot retry hidden security content', async ({ browser, request }) => {
 const row = await db.emailLog.create({ data: { to: 'retry@example.invalid', subject: 'Academic retry integration', body: 'A recorded academic update is ready in your portal.', status: 'NOT_CONFIGURED' } });
 const secret = await db.emailLog.create({ data: { to: 'retry@example.invalid', subject: 'Your sign-in verification code', body: '[PRIVATE CONTENT OMITTED]\nCode hidden.', status: 'FAILED' } });
 const p = await session(browser, 'admin@edupilot.edu'); await p.goto('/admin/email');
 const form = p.locator('form').filter({ has: p.locator(`input[name=id][value="${row.id}"]`) });
 await form.getByRole('button', { name: 'Retry email', exact: true }).click(); await confirm(p);
 await waitMail(request, 'Academic retry integration', 'retry@example.invalid');
 await expect.poll(async () => (await db.emailLog.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('RETRIED');
 await p.reload(); await expect(p.locator(`form input[name=id][value="${row.id}"]`)).toHaveCount(0); await expect(p.locator(`form input[name=id][value="${secret.id}"]`)).toHaveCount(0);
 expect((await messages(request)).filter(m => m.raw.includes('Subject: Academic retry integration'))).toHaveLength(1);
 await p.context().close();
});
