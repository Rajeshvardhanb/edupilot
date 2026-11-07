import { expect, test } from "@playwright/test";
import { confirm, db, fixtures, go, ok, reseed, seen, session, signIn, fresh } from "./helpers";

let f: Awaited<ReturnType<typeof fixtures>>;
test.beforeAll(async () => { reseed(); f = await fixtures(); });
test.afterAll(async () => { await db.$disconnect(); });

test("office staff: own dashboard, admissions, certificates; kept out of money, marks and settings", async ({ browser }) => {
  const o = await session(browser, "office@edupilot.edu");
  ok("office staff land on the front-office dashboard", await seen(o, "Front office"));
  ok("their menu has admissions", await o.locator('aside nav a[href="/admissions"]:visible').first().isVisible());
  ok("their menu has no fees, marks or administration", (await o.locator('aside nav a[href="/fees"], aside nav a[href="/exams"], aside nav a[href="/admin"]').count()) === 0);
  for (const path of ["/fees", "/exams", "/admin", "/admin/rules", "/reports", "/results", "/academics", "/fees/closing", "/scholarships"]) {
    await o.goto(path);
    ok(`office is turned away from ${path}`, await o.waitForURL(/denied=1/, { timeout: 15_000 }).then(() => true, () => false));
  }
  await go(o, "/admissions");
  await o.fill("#name", "Office Test Applicant"); await o.fill("#phone", "9876500011");
  await o.getByRole("button", { name: "Add enquiry" }).click();
  ok("office can add an enquiry", await seen(o, "Office Test Applicant"));
  await go(o, `/students/${f.studentId}`);
  ok("office can open a student profile", await seen(o, "Parent contact log"));
  ok("office does not see the student's fees", !(await o.getByRole("heading", { name: "Fees", exact: true }).count()));
  await o.locator('select[name="channel"]').selectOption("PHONE");
  await o.fill('textarea[name="message"]', "Spoke to the father about the documents still to be submitted.");
  await o.getByRole("button", { name: "Add to log" }).click();
  ok("a phone call is added to the parent contact log", await seen(o, "Spoke to the father about the documents"));
  await go(o, "/students/contacts");
  ok("the college-wide contact log lists it", await seen(o, "Spoke to the father about the documents"));
  await o.context().close();
});

test("two-step sign-in: turn on with a code, sign in with a code, wrong code refused, admin can turn it off", async ({ browser }) => {
  const a = await session(browser, "accounts@edupilot.edu");
  await go(a, "/profile");
  await a.getByRole("button", { name: /Turn on: email me a code/ }).click();
  const toastText = await a.getByText(/here is the code for testing: \d{6}/).first().innerText({ timeout: 15_000 });
  const code = /testing: (\d{6})/.exec(toastText)![1];
  await a.locator('input[name="code"]').fill("000000" === code ? "111111" : "000000");
  await a.getByRole("button", { name: "Confirm" }).click();
  ok("a wrong code does not turn it on", await seen(a, /not correct or has expired/));
  await a.locator('input[name="code"]').fill(code);
  await a.getByRole("button", { name: "Confirm" }).click();
  ok("the right code turns two-step sign-in on", await seen(a, /A code is emailed to .* at every sign-in/));
  await a.context().close();

  const b = await fresh(browser);
  await signIn(b, "accounts@edupilot.edu");
  await b.waitForURL("**/login/verify", { timeout: 60_000 });
  ok("after the password, a code is asked for", await seen(b, "Enter your sign-in code"));
  await b.goto("/dashboard");
  ok("the dashboard is not reachable before the code is entered", /\/login/.test(b.url()));
  await b.goto("/login/verify");
  const shown = /testing: (\d{6})/.exec(await b.getByText(/code for testing/).innerText())![1];
  await b.fill("#code", shown === "123456" ? "654321" : "123456");
  await b.getByRole("button", { name: "Verify and sign in" }).click();
  ok("a wrong sign-in code is refused", await seen(b, /not correct or has expired/));
  await b.fill("#code", shown);
  await b.getByRole("button", { name: "Verify and sign in" }).click();
  ok("the right code completes sign-in", await b.waitForURL("**/dashboard", { timeout: 60_000 }).then(() => true, () => false));
  await b.context().close();

  const admin = await session(browser, "admin@edupilot.edu");
  await go(admin, "/admin?role=ACCOUNTANT");
  await admin.getByRole("button", { name: "2-step off" }).click();
  await confirm(admin);
  ok("the administrator can turn it off for someone", await seen(admin, /Two-step sign-in turned off/));
  ok("the account no longer needs a code", (await db.user.findUniqueOrThrow({ where: { email: "accounts@edupilot.edu" } })).twoStep === false);
  await admin.context().close();
});

test("fees: refund reverses a receipt, no-dues certificate, and closing the day", async ({ browser }) => {
  const a = await session(browser, "accounts@edupilot.edu");
  const inv = await db.feeInvoice.findFirstOrThrow({ where: { studentId: f.studentId }, include: { payments: true } });
  const paidBefore = inv.payments.reduce((t, p) => t + p.amount, 0);
  await go(a, `/fees/${inv.id}`);
  await a.locator("summary", { hasText: "Refund" }).first().click();
  await a.locator('input[name="amount"][aria-label="Refund amount"]').fill("1000");
  await a.locator('select[aria-label="Refund mode"]').selectOption("CASH");
  await a.locator('input[aria-label="Reason"]').fill("Excess amount collected");
  await a.getByRole("button", { name: "Issue refund" }).click();
  await confirm(a);
  await a.waitForURL(/\/fees\/receipt\//, { timeout: 30_000 }).catch(() => {});
  ok("a refund produces a refund voucher", await seen(a, /Refund voucher/i));
  ok("the voucher states the reason", await seen(a, "Excess amount collected"));
  const after = await db.payment.findMany({ where: { invoiceId: inv.id } });
  ok("the amount paid on the invoice drops by the refund", Math.round(after.reduce((t, p) => t + p.amount, 0)) === Math.round(paidBefore - 1000));
  ok("the voucher has its own RFND number", after.some((p) => p.receiptNo.startsWith("RFND-") && p.amount === -1000));

  await go(a, "/fees/closing");
  ok("the day closing shows the refund", await seen(a, "Refunded"));
  await a.fill('input[name="countedCash"]', "0");
  await a.getByRole("button", { name: "Close the day" }).click();
  ok("a count that differs from the books needs a note", await seen(a, /Add a note explaining the difference/));
  await a.fill('textarea[name="note"]', "Refund paid from petty cash; float not yet replaced.");
  await a.getByRole("button", { name: "Close the day" }).click();
  ok("the day is closed with the variance recorded", await seen(a, /Short|Excess/));
  const todayRow = await db.cashClosing.findFirst({ orderBy: { closedAt: "desc" } });
  ok("the closing is stored", todayRow?.countedCash === 0 && !!todayRow.note);

  await go(a, `/fees/statement/${f.studentId}`);
  ok("a student with a balance gets a statement of dues", await seen(a, /Statement of fee dues/i));
  const clear = await db.student.findFirstOrThrow({ where: { invoices: { some: {}, every: { payments: { some: {} } } }, id: { not: f.studentId } }, include: { invoices: { include: { payments: true } } } });
  const settled = (await db.student.findMany({ where: { invoices: { some: {} } }, include: { invoices: { include: { payments: true } } }, take: 200 }))
    .find((s) => s.invoices.every((i) => Math.abs(i.amount - i.concession + (i.fineWaived ? 0 : i.fine) - i.payments.reduce((t, p) => t + p.amount, 0)) < 1)) ?? clear;
  await go(a, `/fees/statement/${settled.id}`);
  ok("a student who has paid everything gets a no-dues certificate", await seen(a, /has paid all fees/));
  await a.context().close();

  const s = await session(browser, "24btcse002@student.edupilot.edu");
  await s.goto(`/fees/statement/${f.studentId}`);
  ok("a student cannot open another student's fee statement", await seen(s, "Not found"));
  await s.context().close();
});

test("college rules: changing the attendance rule changes eligibility; a bad grade scale is refused", async ({ browser }) => {
  const admin = await session(browser, "admin@edupilot.edu");
  await go(admin, "/admin/rules");
  await admin.fill('input[name="attendanceRequired"]', "90");
  await admin.fill('input[name="attendanceCondonable"]', "80");
  await admin.getByRole("button", { name: "Save rules" }).click();
  await confirm(admin);
  ok("rules are saved", await seen(admin, /Rules saved/));
  await go(admin, "/attendance/report");
  ok("the shortage report now uses 90%", await seen(admin, /below 90%/));
  await go(admin, "/exams/hall-tickets");
  ok("hall tickets state the new rule", await seen(admin, /attendance is 90% or more/));

  await go(admin, "/admin/rules");
  await admin.locator('input[name="min"]').first().fill("95");
  await admin.locator('input[name="point"]').nth(1).fill("10");
  await admin.locator('input[name="point"]').first().fill("9"); // top grade now carries fewer points than the next
  await admin.getByRole("button", { name: "Save rules" }).click();
  await confirm(admin);
  ok("a grade scale whose points rise as marks fall is refused", await seen(admin, /grade scale isn't usable/));

  await go(admin, "/admin/rules");
  await admin.fill('input[name="attendanceRequired"]', "75");
  await admin.fill('input[name="attendanceCondonable"]', "65");
  await admin.getByRole("button", { name: "Save rules" }).click();
  await confirm(admin);
  await seen(admin, /Rules saved/);
  expect((await db.institution.findUniqueOrThrow({ where: { id: 1 } })).attendanceRequired).toBe(75);
  await admin.context().close();
});

test("college setup: checklist, template and spreadsheet import", async ({ browser }) => {
  const admin = await session(browser, "admin@edupilot.edu");
  await go(admin, "/admin/setup");
  ok("the checklist shows every step", await seen(admin, "Fee structures"));
  const before = await db.department.count();
  await admin.locator("#step-2 summary").click();
  await admin.locator("#text-departments").fill("code,name\nAIDS,Artificial Intelligence & Data Science\nX,Too short\n,Missing code");
  await admin.locator("#step-2").getByRole("button", { name: "Import departments" }).click();
  const step = (n: number, text: RegExp) => admin.locator(`#step-${n}`).getByText(text).first().waitFor({ timeout: 20_000 }).then(() => true, () => false);
  ok("good rows are imported and bad rows are listed", (await step(2, /1 row\(s\) saved/)) && (await step(2, /2 skipped/)));
  ok("one department was added", (await db.department.count()) === before + 1);
  await admin.locator("#step-3 summary").click();
  await admin.locator("#text-programs").fill("code,name,level,durationYears,intake,department\nBTAIDS,B.Tech — AI & Data Science,UG,4,60,AIDS\nBTXX,Bad level,MASTERS,4,60,AIDS\nBTYY,No department,UG,4,60,NOPE");
  await admin.locator("#step-3").getByRole("button", { name: "Import programmes" }).click();
  ok("a programme is imported against its department", (await step(3, /1 row\(s\) saved/)) && !!(await db.program.findUnique({ where: { code: "BTAIDS" } })));
  await admin.locator("#step-8 summary").click();
  await admin.locator("#text-fees").fill("program,yearOfStudy,academicYear,head,amount\nBTAIDS,1,2026-27,Tuition Fee,90000\nBTAIDS,1,2026-27,Examination Fee,3500");
  await admin.locator("#step-8").getByRole("button", { name: "Import fee structures" }).click();
  ok("fee heads are grouped into one structure", await step(8, /1 fee structure\(s\) saved/));
  const fs = await db.feeStructure.findFirst({ where: { program: { code: "BTAIDS" } }, include: { items: true } });
  ok("the structure has both heads", fs?.items.length === 2 && fs.items.reduce((t, i) => t + i.amount, 0) === 93500);
  await admin.context().close();
});
