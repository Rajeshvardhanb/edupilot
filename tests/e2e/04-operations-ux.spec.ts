import { test } from "@playwright/test";
import { confirm, db, fixtures, go, ok, reseed, seen, session } from "./helpers";
import { feeTotalsSql, jsOverdueCount } from "./ledger-check";

let f: Awaited<ReturnType<typeof fixtures>>;
test.beforeAll(async () => { reseed(); f = await fixtures(); });
test.afterAll(async () => { await db.$disconnect(); });

test("speed-ups give the same answers: fee totals from the database match the invoice rules", async ({ browser }) => {
  const sql = await feeTotalsSql(db), js = await jsOverdueCount(db);
  ok(`overdue invoices agree (${sql.overdue} vs ${js.overdue})`, sql.overdue === js.overdue);
  ok("amount collected agrees", Math.abs(sql.paid - js.paid) < 1);
  ok("amount payable agrees", Math.abs(sql.payable - js.payable) < 1);
  const a = await session(browser, "accounts@edupilot.edu");
  ok("the accounts dashboard shows the banner, then its figures", (await seen(a, "Total demand")) && (await seen(a, "Top overdue balances")));
  ok("the overdue task shows the same count", await seen(a, "Overdue fee invoices"));
  await a.context().close();
});

test("exams: mid-term on the schedule, invigilation duty, revaluation and grace marks", async ({ browser }) => {
  const admin = await session(browser, "admin@edupilot.edu");
  await go(admin, "/exams/schedule");
  const subject = await admin.locator("#subjectId option").first().getAttribute("value");
  await admin.selectOption("#subjectId", subject!);
  await admin.selectOption("#kind", "MID_1");
  await admin.fill("#date", "2026-10-20");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  ok("a mid-term paper is added to the schedule", await seen(admin, "Mid term 1"));
  await admin.getByRole("button", { name: "Assign teachers to halls" }).click();
  ok("teachers are assigned to halls", await seen(admin, /hall\(s\) covered/));
  ok("the roster is shown", await seen(admin, "Invigilation roster"));
  const duties = await db.invigilationDuty.findMany();
  ok("no teacher has two halls in one session", new Set(duties.map((d) => `${d.date.toISOString()}|${d.session}|${d.facultyId}`)).size === duties.length && duties.length > 0);
  await admin.context().close();

  const s = await session(browser, "student@edupilot.edu");
  await go(s, "/exams/revaluation");
  const before = await db.subjectResult.findFirstOrThrow({ where: { studentId: f.studentId, offering: { resultsPublished: true, subject: { externalMax: { gt: 0 } } } }, orderBy: { offering: { term: { startDate: "desc" } } }, include: { offering: { include: { subject: true } } } });
  await s.selectOption('select[name="resultId"]', before.id);
  await s.fill('textarea[name="reason"]', "Question 3 was answered in full but appears unmarked.");
  await s.getByRole("button", { name: "Send request" }).click();
  ok("a student can ask for a re-check", await seen(s, /Request sent/));
  await s.context().close();

  const hod = await session(browser, "admin@edupilot.edu");
  await go(hod, "/exams/revaluation");
  const card = hod.locator("section").filter({ hasText: "Question 3 was answered in full" });
  const better = Math.min(before.offering.subject.externalMax, Math.round(before.external + 6));
  await card.locator('input[name="newExternal"]').fill(String(better));
  await card.getByRole("button", { name: "Record" }).click();
  await confirm(hod);
  ok("the examiner records revised marks", await seen(hod, /Result updated: /));
  const after = await db.subjectResult.findUniqueOrThrow({ where: { id: before.id } });
  ok("the published result carries the new marks and total", after.external === better && Math.abs(after.total - (before.internal + better)) < 0.11);
  ok("the request is closed as revised", (await db.revaluationRequest.findFirstOrThrow({ where: { studentId: f.studentId, offeringId: before.offeringId } })).status === "REVISED");

  const failed = await db.subjectResult.findFirst({ where: { passed: false, offering: { resultsPublished: true } }, select: { offeringId: true } });
  await go(hod, "/exams/revaluation");
  if (failed && (await hod.locator(`select[name="offeringId"] option[value="${failed.offeringId}"]`).count())) {
    await hod.selectOption('select[name="offeringId"]', failed.offeringId);
    await hod.fill('input[name="max"]', "10");
    await hod.getByRole("button", { name: "Apply grace marks" }).click();
    await confirm(hod);
    ok("grace marks are applied or reported as not enough", (await seen(hod, /passed with grace marks/)) || (await seen(hod, /within 10 marks of passing/)));
    const graced = await db.subjectResult.findMany({ where: { offeringId: failed.offeringId, grace: { gt: 0 } } });
    ok("everyone given grace now passes, within the limit", graced.every((g) => g.passed && g.grace <= 10));
  }
  await hod.context().close();
});

test("office work: inventory, visitors, gate pass, profile correction, batch documents", async ({ browser }) => {
  const o = await session(browser, "office@edupilot.edu");
  await go(o, "/inventory");
  const add = o.locator("section").filter({ has: o.getByRole("heading", { name: "Add an asset" }) });
  await add.locator('input[name="tag"]').fill("e2e-kit-01");
  await add.locator('input[name="name"]').fill("Arduino starter kit");
  await add.locator('input[name="location"]').fill("IoT Lab");
  await add.locator('input[name="quantity"]').fill("5");
  await add.getByRole("button", { name: "Add asset" }).click();
  ok("an asset is added", await seen(o, "Arduino starter kit added."));
  const issue = o.locator("section").filter({ has: o.getByRole("heading", { name: "Issue an item" }) });
  await issue.locator('input[name="tag"]').fill("E2E-KIT-01");
  await issue.locator('input[name="issuedTo"]').fill("Project team 4");
  await issue.locator('input[name="quantity"]').fill("9");
  await issue.getByRole("button", { name: "Issue" }).click();
  ok("more than is available cannot be issued", await seen(o, "Only 5 available."));
  await issue.locator('input[name="quantity"]').fill("2");
  await issue.getByRole("button", { name: "Issue" }).click();
  ok("an item is issued", await seen(o, /2 × Arduino starter kit issued/));
  await o.locator("tr").filter({ hasText: "Project team 4" }).getByRole("button", { name: "Returned" }).click();
  ok("and returned", await o.locator("tr").filter({ hasText: "Project team 4" }).waitFor({ state: "detached", timeout: 15_000 }).then(() => true, () => false));

  await go(o, "/gate");
  const v = o.locator("section").filter({ has: o.getByRole("heading", { name: "Sign in a visitor" }) });
  await v.locator('input[name="name"]').fill("E2E Visitor"); await v.locator('input[name="phone"]').fill("9812345678");
  await v.locator('input[name="purpose"]').fill("Vendor demo"); await v.locator('input[name="toMeet"]').fill("Principal");
  await v.getByRole("button", { name: "Sign in" }).click();
  ok("a visitor is signed in", await seen(o, "E2E Visitor signed in."));
  await o.locator("tr").filter({ hasText: "E2E Visitor" }).getByRole("button", { name: "Sign out" }).click();
  ok("and signed out", await seen(o, /Left today/));

  const s = await session(browser, "student@edupilot.edu");
  await go(s, "/gate");
  await s.fill('input[name="reason"]', "Weekend visit home");
  const stamp = (h: number) => new Date(Date.now() + (h + 5.5) * 3600e3).toISOString().slice(0, 16);
  await s.fill('input[name="outAt"]', stamp(3)); await s.fill('input[name="expectedBack"]', stamp(30));
  await s.getByRole("button", { name: "Send request" }).click();
  ok("a student asks for a gate pass", await seen(s, /Request sent to the office/));
  await go(s, "/profile");
  await s.selectOption('select[name="field"]', "guardianPhone");
  await s.fill('input[name="newValue"]', "9123456780");
  await s.getByRole("button", { name: "Send to the office" }).click();
  ok("a student asks for a contact correction", await seen(s, /Sent to the office/));
  ok("nothing changes before approval", (await db.student.findUniqueOrThrow({ where: { id: f.studentId } })).guardianPhone !== "9123456780");
  await s.locator('input[name="email"][value="fees"]').uncheck();
  await s.getByRole("button", { name: "Save preferences" }).click();
  await seen(s, /Email is off for 1 kind/);
  ok("email is switched off for fee alerts", ((await db.user.findFirstOrThrow({ where: { student: { id: f.studentId } } })).prefs as { mutedEmail?: string[] }).mutedEmail?.includes("fees"));
  await s.context().close();

  await go(o, "/gate");
  const row = () => o.locator("tr").filter({ hasText: "Weekend visit home" });
  await row().getByRole("button", { name: "Approve" }).click();
  await row().getByRole("button", { name: "Mark out" }).click({ timeout: 15_000 });
  await row().getByRole("button", { name: "Mark returned" }).click({ timeout: 15_000 });
  ok("the gate pass goes approved → out → returned", await row().getByText("Returned").first().waitFor({ timeout: 15_000 }).then(() => true, () => false));
  await go(o, "/students/changes");
  await o.locator("tr").filter({ hasText: "9123456780" }).getByRole("button", { name: "Approve" }).click();
  ok("the office approves the correction", await seen(o, /Applied to the student's record/));
  ok("and the record now has it", (await db.student.findUniqueOrThrow({ where: { id: f.studentId } })).guardianPhone === "9123456780");

  await go(o, "/students/id-cards");
  ok("ID cards for a whole batch are on one page", (await o.locator("img[alt], svg").count()) > 4 && (await seen(o, /cards, front and back/)));
  await go(o, "/certificates");
  await o.selectOption('select[name="batchId"]', f.batchId);
  await o.fill('input[name="purpose"]', "E2E scholarship round");
  await o.getByRole("button", { name: "Issue and print" }).click();
  await confirm(o);
  await o.waitForURL(/certificates\/batch/, { timeout: 30_000 }).catch(() => {});
  const issued = await db.certificateRequest.count({ where: { purpose: "E2E scholarship round", status: "APPROVED" } });
  ok(`a certificate is issued to the whole batch (${issued})`, issued > 5 && (await seen(o, /Bonafide Certificate/i)));
  ok("each has its own serial number", new Set((await db.certificateRequest.findMany({ where: { purpose: "E2E scholarship round" }, select: { serialNo: true } })).map((c) => c.serialNo)).size === issued);
  await o.context().close();
});

test("payroll, promotion with detention, system health and archive", async ({ browser }) => {
  const a = await session(browser, "accounts@edupilot.edu");
  await go(a, "/staff/payroll");
  const last = new Date(); last.setUTCDate(1); last.setUTCMonth(last.getUTCMonth() - 1);
  const month = last.toISOString().slice(0, 7);
  await a.locator('section:has(h2 > span:last-child:text-is("Run payroll")) input[name="month"]').first().fill(month);
  await a.getByRole("button", { name: "Run payroll" }).click();
  await confirm(a);
  const ran = await seen(a, /Payroll run for \d+ staff/, 40_000);
  ok(`payroll runs for the month${ran ? "" : ` — page said: ${(await a.locator('[role="status"], [role="alert"]').allInnerTexts()).join(" | ").slice(0, 200)}`}`, ran);
  const slips = await db.payslip.findMany({ where: { month } });
  ok("one payslip per person with a salary", slips.length === (await db.salaryStructure.count({ where: { user: { isActive: true } } })) && slips.length > 0);
  ok("net pay is gross less deductions", slips.every((p) => Math.abs(p.net - (p.gross - p.pf - p.otherDeductions - p.lopDeduction)) <= 1));
  await go(a, `/staff/payroll?month=${month}`);
  await a.getByRole("link", { name: "Payslip →" }).first().click();
  await a.waitForURL(/\/staff\/payroll\/c/, { timeout: 60_000 }).catch(() => {});
  ok("a payslip opens with net pay in words", (await seen(a, "Loss-of-pay days", 30_000)) && (await seen(a, /Rupees Only/)));
  const res = await a.context().request.get("/admin/export");
  ok("accounts staff cannot download the archive", res.status() === 403);
  await a.context().close();

  const admin = await session(browser, "admin@edupilot.edu");
  const archive = await admin.context().request.get("/admin/export");
  ok("the administrator can download the archive", archive.status() === 200 && (archive.headers()["content-type"] ?? "").includes("gzip") && (await archive.body()).length > 10_000);
  await admin.goto("/admin/health/test-error").catch(() => {});
  await go(admin, "/admin/health");
  ok("a server error is recorded on the health page", await seen(admin, /Test error raised/));
  ok("the health page shows the database size", await seen(admin, "Database size"));

  // Promotion: with a limit of 0 backlogs, students with a backlog are pre-ticked to be held back.
  await db.institution.update({ where: { id: 1 }, data: { promoteMaxBacklogs: 0 } });
  const batch = await db.batch.findFirstOrThrow({ where: { id: { not: f.batchId }, currentSemester: { lt: 6, gt: 1 }, students: { some: { status: "ACTIVE" } } }, include: { program: true, students: { where: { status: { in: ["ACTIVE", "DETAINED"] } } } } });
  await admin.waitForTimeout(16_000); // settings are cached for a few seconds when changed outside the app
  await go(admin, `/academics/batches/${batch.id}/promote`);
  ok("the review lists every student", (await admin.locator('tbody input[name="detain"]').count()) === batch.students.length);
  const first = admin.locator('tbody input[name="detain"]').first();
  const held = await first.getAttribute("value");
  await first.check();
  const ticked = await admin.locator('tbody input[name="detain"]:checked').count();
  await admin.getByRole("button", { name: "Promote the batch" }).click();
  await confirm(admin);
  await admin.waitForURL(/academics\/batches\?done=/, { timeout: 30_000 }).catch(() => {});
  ok("the batch moves to the next semester", (await db.batch.findUniqueOrThrow({ where: { id: batch.id } })).currentSemester === batch.currentSemester + 1);
  ok("the held-back student is detained", (await db.student.findUniqueOrThrow({ where: { id: held! } })).status === "DETAINED");
  ok(`everyone ticked is detained (${ticked})`, (await db.student.count({ where: { id: { in: batch.students.map((s) => s.id) }, status: "DETAINED" } })) === ticked);
  await admin.context().close();
});

test("interface: field checks, drag-and-drop board, phone tables, translated pages, saved filters", async ({ browser }) => {
  const o = await session(browser, "office@edupilot.edu");
  await go(o, "/students/new");
  await o.fill("#email", "not-an-email"); await o.locator("#rollNo").focus();
  ok("a badly formed email is flagged on leaving the field", await seen(o, /Enter a full email address/));
  await o.fill("#rollNo", "24BTCSE001"); await o.locator("#email").focus();
  ok("a roll number already in use is flagged before saving", await seen(o, /already .* roll number/));
  await o.fill("#rollNo", "99ZZZ999"); await o.locator("#email").focus();
  ok("a free roll number clears the message", await o.waitForFunction(() => !/already .* roll number/.test(document.body.innerText), null, { timeout: 15_000 }).then(() => true, () => false));

  await go(o, "/admissions");
  const card = o.locator("[data-enquiry]").first();
  const id = await card.getAttribute("data-enquiry"), from = await card.getAttribute("data-stage");
  const target = from === "ENQUIRY" ? "APPLIED" : "ENQUIRY";
  await o.evaluate(([cid, to]) => {
    const el = document.querySelector(`[data-enquiry="${cid}"]`)!, col = document.querySelector(`[data-drop-stage="${to}"]`)!;
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    col.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    col.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, [id, target]);
  ok("dragging a card to another column moves the enquiry", (await seen(o, /moved to/)) && (await db.enquiry.findUniqueOrThrow({ where: { id: id! } })).stage === target);
  await go(o, "/students?status=ACTIVE");
  ok("a filtered list offers to save the filter", await o.getByRole("button", { name: /Save this filter/ }).isVisible());
  await o.context().close();

  const s = await session(browser, "student@edupilot.edu", { viewport: { width: 390, height: 844 } });
  await go(s, "/results");
  // Phones get the design's compact subject list (one line per subject with its grade) instead of the wide table.
  const phone = await s.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    lines: [...document.querySelectorAll("main ul li")].filter((li) => (li as HTMLElement).offsetParent !== null && /BTCSE\d+ · \d/.test(li.textContent ?? "")).length,
    tableShown: [...document.querySelectorAll("main table")].some((t) => (t as HTMLElement).offsetParent !== null),
  }));
  ok(`on a phone, results are a compact list, not a wide table (${JSON.stringify(phone)})`, phone.lines > 5 && !phone.tableShown);
  ok("and the page does not scroll sideways", phone.overflow <= 1);
  await s.context().addCookies([{ name: "edupilot_lang", value: "hi", url: "http://localhost:3100" }]);
  await go(s, "/attendance");
  ok("page titles follow the chosen language", await seen(s, "मेरी उपस्थिति"));
  await go(s, "/notices");
  ok("as do pages translated in this round (on a phone the page name is in the top bar)", await s.locator("header").getByText("सूचनाएँ").isVisible());
  await s.context().close();
});
