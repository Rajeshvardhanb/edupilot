import { expect, test, type APIRequestContext } from "@playwright/test";
import { db, fixtures, reseed, session, fresh, signIn } from "./helpers";
test.skip(process.env.E2E_SMTP_TEST !== "1", "Requires isolated SMTP sink.");
test.beforeAll(async ({ request }) => { reseed(); await request.delete("http://127.0.0.1:2526/messages"); });
const decoded = (s: string) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
async function mail(request: APIRequestContext, subject: string, to: string) {
 const list = async () => (await (await request.get("http://127.0.0.1:2526/messages")).json() as { to: string[]; raw: string }[]).filter(m => m.to.includes(to) && m.raw.includes(`Subject: ${subject}`));
 await expect.poll(async () => (await list()).length).toBeGreaterThan(0);
 return decoded((await list()).at(-1)!.raw);
}
test("registration has a username and single-use password setup with email OTP", async ({ browser, request }) => {
 const f = await fixtures(), staff = await session(browser, "office@edupilot.edu"), email = "onboarding@example.invalid";
 await staff.goto("/students/new");await staff.locator("[name=name]").fill("Onboarding Test Student");await staff.locator("[name=email]").fill(email);await staff.locator("[name=rollNo]").fill("OTPSETUP2026");await staff.locator("[name=batchId]").selectOption(f.batchId);
 await staff.getByRole("button", { name: "Admit student", exact: true }).click();await expect(staff).toHaveURL(/created=1/);
 const welcome = await mail(request, "Your student management account is ready", email);
 expect(welcome).toContain(email);const url = /http:\/\/localhost:3100\/setup-password\?token=[a-f0-9]{64}/.exec(welcome)![0];expect(url).toBeTruthy();
 const student = await fresh(browser);await student.goto(url);await student.getByRole("button", { name: "Send email verification code", exact: true }).click();
 const otpMail = await mail(request, "Your password setup verification code", email), code = /Verification code: (\d{6})/.exec(otpMail)![1];
 await student.locator("[name=code]").fill(code === "000000" ? "111111" : "000000");await student.locator("[name=password]").fill("CobaltSunrise!2026");await student.locator("[name=confirm]").fill("CobaltSunrise!2026");await student.getByRole("button", { name: "Verify email and set password", exact: true }).click();
 await expect(student.getByText(/email code is incorrect/)).toBeVisible();
 const user = await db.user.findUniqueOrThrow({ where: { email } });expect(user.mustChangePassword).toBe(true);
 await student.locator("[name=code]").fill(code);await student.getByRole("button", { name: "Verify email and set password", exact: true }).click();await expect(student).toHaveURL(/login\?reset=1/);
 expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();
 await student.goto(url);await expect(student.getByText(/invitation is expired, invalid or already used/)).toBeVisible();
 await signIn(student, email, "CobaltSunrise!2026");await expect(student).toHaveURL(/dashboard/);
 const logs = await db.emailLog.findMany({ where: { to: email } });expect(logs.map(l => l.body).join(" ")).not.toContain(code);expect(logs.map(l => l.body).join(" ")).not.toContain("token=");
 await staff.context().close();await student.context().close();
});
test("HOD can release Sandhya's 67.6% ticket, revoke it, and notify her; another department is blocked", async ({ browser, request }) => {
 const f = await fixtures(), term = await db.term.findFirstOrThrow({ where: { isCurrent: true } });
 await db.attendanceRecord.deleteMany({ where: { studentId: f.studentId, session: { offering: { termId: term.id } } } });
 for (let i = 0; i < 34; i++) {
  const date = new Date(Date.UTC(2026, 9, i + 1));
  const row = await db.attendanceSession.upsert({ where: { offeringId_date_period: { offeringId: f.offeringId, date, period: 9 } }, create: { offeringId: f.offeringId, date, period: 9 }, update: {} });
  await db.attendanceRecord.create({ data: { sessionId: row.id, studentId: f.studentId, status: i < 23 ? "PRESENT" : "ABSENT" } });
 }
 const student = await session(browser, "sandhya.lanke@edupilot.edu");await student.goto(`/exams/hall-tickets/${f.studentId}`);await expect(student.getByRole("heading", { name: "Hall ticket withheld" })).toBeVisible();await expect(student.getByText(/Attendance 67.6%/)).toBeVisible();
 const blocked = await student.request.get(`/exams/hall-tickets/${f.studentId}/pdf`);expect(blocked.status()).toBe(409);
 const hod = await session(browser, "hod.cse@edupilot.edu");await hod.goto(`/exams/hall-tickets?batch=${f.batchId}`);
 const row = hod.getByRole("row").filter({ hasText: "24MQ5A0509" });await row.locator("summary").click();await row.locator("[name=reason]").fill("Demo: Administration reviewed the request and HOD approves attendance condonation.");await row.getByRole("button", { name: "Save decision", exact: true }).click();
 await expect.poll(async () => (await db.attendanceCondonation.findUnique({ where: { studentId_termId: { studentId: f.studentId, termId: term.id } } }))?.status).toBe("APPROVED");
 await mail(request, "Your hall ticket eligibility has been reviewed", "sandhya.lanke@edupilot.edu");
 await student.reload();await expect(student.getByRole("heading", { name: "Hall ticket withheld" })).toHaveCount(0);const pdf = await student.request.get(`/exams/hall-tickets/${f.studentId}/pdf`);expect(pdf.status()).toBe(200);expect(pdf.headers()["content-type"]).toContain("application/pdf");
 await student.goto("/notifications");await expect(student.getByRole("heading", { name: "Your hall ticket eligibility has been reviewed" }).first()).toBeVisible();
 const outside = await db.student.findFirstOrThrow({ where: { rollNo: "24MQ5A0511" } }); // visibility stays restricted by department, even for a forged batch query
 const cse = await db.student.findUniqueOrThrow({ where: { id: outside.id }, include: { batch: { include: { program: true } } } });
 const foreign = await db.batch.findFirstOrThrow({ where: { program: { departmentId: { not: cse.batch.program.departmentId } } } });await hod.goto(`/exams/hall-tickets?batch=${foreign.id}`);await expect(hod.getByRole("button", { name: "Save decision" })).toHaveCount(0);
 await hod.goto(`/exams/hall-tickets?batch=${f.batchId}`);const revoke = hod.getByRole("row").filter({ hasText: "24MQ5A0509" });await revoke.locator("summary").click();await revoke.locator("[name=decision]").selectOption("REVOKED");await revoke.locator("[name=reason]").fill("Demo approval revoked after presentation verification.");await revoke.getByRole("button", { name: "Save decision", exact: true }).click();
 await expect.poll(async () => (await db.attendanceCondonation.findUniqueOrThrow({ where: { studentId_termId: { studentId: f.studentId, termId: term.id } } })).status).toBe("REVOKED");
 expect((await student.request.get(`/exams/hall-tickets/${f.studentId}/pdf`)).status()).toBe(409);
 await student.context().close();await hod.context().close();
});
test("notifications belong to their recipient and marking read does not affect another user", async ({ browser }) => {
 const f = await fixtures(), s = await db.student.findUniqueOrThrow({ where: { id: f.studentId } });
 const mine = await db.notification.create({ data: { userId: s.userId, title: "Private student update", body: "Owner only" } });
 const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@edupilot.edu" } });const theirs = await db.notification.create({ data: { userId: admin.id, title: "Private admin update" } });
 const page = await session(browser, "sandhya.lanke@edupilot.edu");await page.goto("/notifications");await expect(page.getByRole("heading", { name: "Private student update" })).toBeVisible();await expect(page.getByText("Private admin update")).toHaveCount(0);
 const ownCard = page.locator("section, article, div").filter({ has: page.getByRole("heading", { name: "Private student update", exact: true }) }).filter({ has: page.getByRole("button", { name: "Mark as read", exact: true }) }).last();
 await ownCard.getByRole("button", { name: "Mark as read", exact: true }).click();
 await expect.poll(async () => (await db.notification.findUniqueOrThrow({ where: { id: mine.id } })).readAt).not.toBeNull();
 expect((await db.notification.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeNull();
 await page.reload();await page.getByRole("button", { name: "Mark all as read", exact: true }).click();await expect.poll(() => db.notification.count({ where: { userId: s.userId, readAt: null } })).toBe(0);
 expect((await db.notification.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeNull();await page.context().close();
});
test("major profile changes require exact, single-use OTP; demo email can be verified first", async ({ browser, request }) => {
 const student = await session(browser, "sandhya.lanke@edupilot.edu"), f = await fixtures(), email = "sandhya.verified@example.invalid";
 const before = await db.student.findUniqueOrThrow({ where: { id: f.studentId }, include: { user: true } });
 await student.goto("/profile");await student.getByLabel("Login email", { exact: true }).fill(email);await student.getByLabel("Current password (for email changes)", { exact: true }).fill("password123");await student.getByLabel("Address", { exact: true }).fill("Verified profile address");await student.getByRole("button", { name: "Send verification code", exact: true }).click();
 const code = /Verification code: (\d{6})/.exec(await mail(request, "Verify your account changes", email))![1];
 const challenge = await db.emailChallenge.findFirstOrThrow({ where: { userId: before.userId, purpose: "PROFILE" }, orderBy: { createdAt: "desc" } });
 expect((await db.user.findUniqueOrThrow({ where: { id: before.userId } })).email).toBe(before.user.email);
 await student.getByLabel("Email verification code", { exact: true }).fill(code);await student.getByLabel("Address", { exact: true }).fill("Tampered after code");await student.getByRole("button", { name: "Save profile", exact: true }).click();await expect(student.getByText(/Request and enter a valid email OTP/)).toBeVisible();
 expect((await db.student.findUniqueOrThrow({ where: { id: f.studentId } })).address).toBe(before.address);
 await student.getByLabel("Address", { exact: true }).fill("Verified profile address");await student.getByRole("button", { name: "Save profile", exact: true }).click();await expect(student.getByText(/Your profile has been updated/)).toBeVisible();
 const after = await db.user.findUniqueOrThrow({ where: { id: before.userId } });expect(after.email).toBe(email);expect(after.emailVerifiedAt).not.toBeNull();expect(after.passwordHash).toBe(before.user.passwordHash);
 expect((await db.emailChallenge.findUniqueOrThrow({ where: { id: challenge.id } })).usedAt).not.toBeNull();
 await student.getByLabel("Address", { exact: true }).fill("Replayed OTP address");await student.getByRole("button", { name: "Save profile", exact: true }).click();await expect(student.getByText(/Request and enter a valid email OTP/)).toBeVisible();
 await student.reload();expect(await student.locator('input[type=file]').count()).toBe(0);expect((await student.request.get(`/photo/${before.userId}`)).status()).toBe(404);
 await student.context().close();
});
