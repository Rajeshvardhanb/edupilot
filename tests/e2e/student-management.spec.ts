import { expect,test } from "@playwright/test";
import { db,fixtures,reseed,session } from "./helpers";

test.beforeAll(() => reseed());

const removed = ["/faculty", "/staff", "/staff/leave", "/staff/payroll", "/staff/achievements", "/fees", "/pay/unused", "/scholarships", "/library", "/hostel", "/transport", "/inventory", "/gate", "/admissions", "/certificates", "/helpdesk", "/id-card", "/students/contacts", "/students/changes", "/students/id-cards", "/notices", "/notifications", "/reports", "/reports/cron", "/reports/export", "/attendance/sync", "/offline", "/manifest.webmanifest"];

test("removed modules have no routes or navigation", async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await session(browser, "admin@edupilot.edu");
  for (const path of removed) {
    const response = await page.request.get(path);
    if (response.status() === 200) {
      // A removed static URL may match an existing dynamic student/course route.
      // Next.js can stream its notFound boundary after sending HTTP 200.
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Not found", exact: true }), path).toBeVisible();
    } else expect(response.status(), path).toBe(404);
  }
  await page.goto("/dashboard");
  await expect(page.locator('aside a[href="/fees"]')).toHaveCount(0);
  await expect(page.locator('button[aria-label^="Notifications"]')).toHaveCount(0);
  await page.context().close();
});

test("student names, search, profile, results, and timetable remain", async ({ browser }) => {
  const page = await session(browser, "admin@edupilot.edu");
  await page.goto("/students?q=23MQ1A05B5&status=ALL");
  await expect(page.getByText("P. BHARGAV NAGA SAI SAMPATH").first()).toBeVisible();
  const { studentId } = await fixtures();
  await page.goto(`/students/${studentId}`);
  await expect(page.getByRole("heading", { name: "Academic record" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fees", exact: true })).toHaveCount(0);
  const student = await session(browser, "student@edupilot.edu");
  for (const path of ["/results", "/attendance", "/timetable", "/leave", "/materials", "/exams/supplementary", "/exams/revaluation", "/placements", "/calendar"]) {
    const response = await student.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(student.getByRole("heading", { name: "This page couldn't be loaded" })).toHaveCount(0);
  }
  await page.context().close();
  await student.context().close();
});

test("parent view and teacher course access remain scoped", async ({ browser }) => {
  const { studentId, offeringId } = await fixtures();
  const parent = await session(browser, "parent@edupilot.edu");
  await parent.goto("/results");
  expect(parent.url()).toContain("/results");
  await parent.goto("/admin");
  await expect(parent).toHaveURL(/dashboard\?denied=1/);
  const teacher = await session(browser, "faculty@edupilot.edu");
  await teacher.goto(`/exams/${offeringId}`);
  await expect(teacher).toHaveURL(new RegExp(`/exams/${offeringId}$`));
  const other = await db.courseOffering.findFirstOrThrow({ where: { id: { not: offeringId }, faculty: { user: { email: { not: "faculty@edupilot.edu" } } }, substitutions: { none: {} } } });
  const response = await teacher.goto(`/exams/${other.id}`);
  expect(response?.status()).toBeLessThan(500);
  await expect(teacher.getByRole("heading", { name: "Not found", exact: true })).toBeVisible();
  expect(studentId).toBeTruthy();
  await parent.context().close();
  await teacher.context().close();
});


test("marks and attendance can still be saved", async ({ browser }) => {
  const { studentId, offeringId } = await fixtures();
  const assessment = await db.assessment.findFirstOrThrow({ where: { offeringId, type: "MID_TERM" } });
  const mark = Math.max(0, assessment.maxMarks - 1);
  const teacher = await session(browser, "faculty@edupilot.edu");
  await teacher.goto(`/exams/${offeringId}`);
  await teacher.locator(`input[name="m_${assessment.id}_${studentId}"]`).fill(String(mark));
  await teacher.getByRole("button", { name: "Save marks", exact: true }).click();
  await expect.poll(async () => (await db.mark.findUnique({ where: { assessmentId_studentId: { assessmentId: assessment.id, studentId } } }))?.marks).toBe(mark);

  const date = "2026-10-09";
  await teacher.goto(`/attendance/${offeringId}?date=${date}&period=1`);
  const identity = await db.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: true } });
  await teacher.getByRole("button", { name: `${identity.user.name}: absent`, exact: true }).click();
  await teacher.getByRole("button", { name: "Save attendance", exact: true }).click();
  await expect.poll(async () => (await db.attendanceRecord.findFirst({ where: { studentId, session: { offeringId, date: new Date(`${date}T00:00:00Z`), period: 1 } } }))?.status).toBe("ABSENT");
  await teacher.context().close();
});
