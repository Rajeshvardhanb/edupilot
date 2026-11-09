import { expect,test } from "@playwright/test";
import collegeData from "../../college-data.json";
const identities = collegeData.students;
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
  const student = await session(browser, "sandhya.lanke@edupilot.edu");
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


test("presentation shows the supplied roster and hides preserved sample records", async ({ browser }) => {
  const hidden = await db.student.findFirstOrThrow({ where: { rollNo: "24BTCSE022" }, include: { user: true } });
  const before = await db.student.count();
  const page = await session(browser, "admin@edupilot.edu");
  await page.goto("/students?status=ALL");
  await expect(page.getByText("21 students match", { exact: true })).toBeVisible();
  const exported = await page.request.get("/students/export?status=ALL");
  const csv = await exported.text();
  expect(exported.status()).toBe(200);
  expect(csv).toContain("LANKE SANDHYA");
  expect(csv).not.toContain(hidden.rollNo);
  await page.goto(`/students/${hidden.id}`);
  await expect(page.getByRole("heading", { name: "Not found", exact: true })).toBeVisible();
  await page.goto(`/students?q=${hidden.rollNo}&status=ALL`);
  await expect(page.getByText("0 students match", { exact: true })).toBeVisible();
  expect(await db.student.count()).toBe(before);
  expect(await db.student.findUnique({ where: { id: hidden.id } })).not.toBeNull();
  await page.context().close();
});

test("default student owns the profile editor; admins have student CRUD controls", async ({ browser }) => {
  const owner=await db.student.findFirstOrThrow({where:{user:{email:"sandhya.lanke@edupilot.edu"}},include:{user:true}});
  expect(owner.rollNo).toBe("24MQ5A0509");expect(owner.user.name).toBe("LANKE SANDHYA");
  const student=await session(browser,"sandhya.lanke@edupilot.edu");await student.goto("/profile");
  await student.getByLabel("Phone number",{exact:true}).fill("9876543210");
  await student.getByLabel("Address",{exact:true}).fill("SVIET profile edit test");
  await student.getByRole("button",{name:"Save profile",exact:true}).click();
  await expect(student.getByText("Your profile has been updated.",{exact:true})).toBeVisible();
  await student.reload();await expect(student.getByLabel("Address",{exact:true})).toHaveValue("SVIET profile edit test");
  await student.goto(`/students/${owner.id}/edit`);await expect(student).toHaveURL(/dashboard\?denied=1/);
  const admin=await session(browser,"admin@edupilot.edu");await admin.goto(`/students?q=${owner.rollNo}`);
  await admin.getByRole("link",{name:`Edit ${owner.user.name}`,exact:true}).filter({visible:true}).first().click();
  await admin.locator('[name=address]').fill("Administrator updated address");await admin.getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(admin).toHaveURL(new RegExp(`/students/${owner.id}$`));
  expect((await db.student.findUniqueOrThrow({where:{id:owner.id}})).address).toBe("Administrator updated address");
  await admin.setViewportSize({width:390,height:844});await admin.goto(`/students?q=${owner.rollNo}`);
  await expect(admin.getByRole("link",{name:`Edit ${owner.user.name}`,exact:true}).filter({visible:true}).first()).toBeVisible();
  expect(await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await admin.setViewportSize({width:1400,height:900});
  const registered=await db.user.create({data:{name:"CRUD Test Student",email:"crud-test@example.invalid",role:"STUDENT",passwordHash:owner.user.passwordHash,student:{create:{rollNo:"CRUD2026",batchId:owner.batchId,admissionDate:new Date("2026-08-01")}}},include:{student:true}});
  await admin.goto("/students?q=CRUD2026");await expect(admin.getByText("CRUD Test Student",{exact:true}).first()).toBeVisible();
  const before=await db.student.count();
  await admin.getByRole("button",{name:"Delete",exact:true}).filter({visible:true}).first().click();
  await admin.getByRole("alertdialog").getByRole("button").last().click();await expect(admin).toHaveURL(/students\?deleted=1/);
  await admin.goto("/students?q=CRUD2026&status=ALL");await expect(admin.getByText("0 students match",{exact:true})).toBeVisible();
  const archived=await db.student.findUniqueOrThrow({where:{id:registered.student!.id},include:{user:true}});
  expect(archived.archivedAt).not.toBeNull();expect(archived.user.isActive).toBe(false);expect(await db.student.count()).toBe(before);
  await admin.context().close();await student.context().close();
});


test("all 21 supplied students can use their firstname.lastname usernames", async ({ browser }) => {
  test.setTimeout(180_000);
  for(const identity of identities){
    const student=await session(browser,identity.email);
    await expect(student.getByRole("heading",{name:`Welcome, ${identity.name}`,exact:true})).toBeVisible();
    await student.goto("/profile");
    await expect(student.getByLabel("Login email",{exact:true})).toHaveValue(identity.email);
    await student.context().close();
  }
});
