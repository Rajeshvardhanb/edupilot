import { test } from "@playwright/test";
import { confirm, fixtures, fresh, go, ok, reseed, seen, session, signIn } from "./helpers";

let f: Awaited<ReturnType<typeof fixtures>>;

test.beforeAll(async () => {
  reseed();
  f = await fixtures();
});

test("sign-in security: lockout, password reset, forced change, session invalidation", async ({ browser }) => {
  const victim = "cse.fac4@edupilot.edu";
  const p = await fresh(browser);
  for (let i = 1; i <= 5; i++) {
    await signIn(p, victim, `wrong-${i}`);
    if (i === 3) ok("warns how many attempts are left", await seen(p, "2 attempts left"));
    if (i === 5) ok("account locks after 5 wrong passwords", await seen(p, "locked for 15 minutes"));
    await p.waitForTimeout(400);
  }
  await signIn(p, victim);
  ok("the correct password is refused while locked", await seen(p, "This account is locked"));

  await go(p, "/forgot-password");
  await p.fill("#email", "nobody-here@example.com");
  await p.getByRole("button", { name: "Send reset link" }).click();
  ok("an unknown email gets the same answer", await seen(p, "If an account exists"));
  ok("no link is revealed for an unknown email", !(await p.getByText("reset-password?token=").isVisible().catch(() => false)));

  await go(p, "/forgot-password");
  await p.fill("#email", victim);
  await p.getByRole("button", { name: "Send reset link" }).click();
  await seen(p, "reset-password?token=");
  const link = ((await p.locator("[role=status]").first().textContent()) ?? "").match(/http\S+token=[a-f0-9]+/)![0];
  await p.goto(link);
  await p.fill("#password", "abcdefgh");
  await p.fill("#confirm", "abcdefgh");
  await p.getByRole("button", { name: "Set new password" }).click();
  ok("a weak password is rejected", await seen(p, "letters and numbers"));
  await p.fill("#password", "Faculty2026x");
  await p.fill("#confirm", "Faculty2026x");
  await p.getByRole("button", { name: "Set new password" }).click();
  await p.waitForURL(/login\?reset=1/, { timeout: 20_000 }).catch(() => {});
  ok("reset returns to sign-in with a confirmation", await seen(p, "Password changed"));
  await p.goto(link);
  await p.fill("#password", "Another2026x");
  await p.fill("#confirm", "Another2026x");
  await p.getByRole("button", { name: "Set new password" }).click();
  ok("a reset link works only once", await seen(p, "invalid or has expired"));
  await signIn(p, victim, "Faculty2026x");
  ok("the new password signs in and the lock is cleared", await p.waitForURL("**/dashboard", { timeout: 30_000 }).then(() => true, () => false));
  await p.context().close();

  const admin = await session(browser, "admin@edupilot.edu");
  await go(admin, "/admin");
  await admin.fill("#name", "E2E Clerk");
  await admin.fill("#email", "e2e.clerk@edupilot.edu");
  await admin.fill("#password", "Temp12345");
  await admin.getByRole("button", { name: "Create user" }).click();
  ok("staff user created", await seen(admin, "User created"));

  const clerk = await fresh(browser);
  await signIn(clerk, "e2e.clerk@edupilot.edu", "Temp12345");
  ok("a temporary password forces a change", await clerk.waitForURL("**/change-password", { timeout: 30_000 }).then(() => true, () => false));
  await clerk.goto("/fees");
  ok("nothing else is reachable until it is changed", await clerk.waitForURL("**/change-password", { timeout: 15_000 }).then(() => true, () => false));
  await clerk.fill("#current", "Temp12345");
  await clerk.fill("#password", "Clerk2026go");
  await clerk.fill("#confirm", "Clerk2026go");
  await clerk.getByRole("button", { name: "Save and continue" }).click();
  ok("after the change the dashboard opens", await clerk.waitForURL("**/dashboard", { timeout: 30_000 }).then(() => true, () => false));

  await go(admin, "/admin?q=e2e.clerk");
  await admin.getByRole("button", { name: "Reset password" }).first().click();
  await confirm(admin);
  await admin.waitForTimeout(2500);
  await clerk.goto("/fees");
  ok("an admin reset signs the user out everywhere", await clerk.waitForURL(/login/, { timeout: 20_000 }).then(() => true, () => false));
  await go(admin, "/admin/email");
  ok("the reset email is recorded in the outbox", await seen(admin, "Reset your password"));
  await clerk.context().close();
  await admin.context().close();
});

test("a session for a deleted account ends at the sign-in page instead of looping", async ({ browser }) => {
  const p = await session(browser, "accounts@edupilot.edu");
  reseed(); // recreates every user with new IDs, so this browser's session now points at nothing
  f = await fixtures();
  await p.goto("/dashboard");
  ok("lands on sign-in with an explanation", (await p.waitForURL(/login\?expired=1/, { timeout: 30_000 }).then(() => true, () => false)) && (await seen(p, "Your session has ended")));
  await p.context().close();
});

test("student and parent: notifications, online payment, PDF, language, child switcher", async ({ browser }) => {
  const p = await session(browser, "student@edupilot.edu");
  ok("dashboard lists My tasks", await seen(p, "My tasks"));
  const bell = p.locator("[data-tour=bell] button").first();
  ok("bell shows the unread count", /\d+ unread/.test((await bell.getAttribute("aria-label")) ?? ""));
  await bell.click();
  await p.getByText("New assignment in Computer Networks").click();
  ok("a notification opens the page it is about", await p.waitForURL("**/materials", { timeout: 20_000 }).then(() => true, () => false));

  await go(p, "/fees");
  await p.locator('input[name="amount"]:visible').first().fill("1000");
  await p.getByRole("button", { name: "Pay now" }).first().click();
  await p.waitForURL(/\/pay\//, { timeout: 30_000 }).catch(() => {});
  ok("test checkout opens and says it is a test", (await seen(p, "Test mode")) && (await seen(p, "₹1,000")));
  await p.getByRole("button", { name: "Simulate failure" }).click();
  ok("a failed payment records nothing", await seen(p, "No money was taken"));
  await p.getByRole("radio", { name: "Card" }).click();
  await p.getByRole("button", { name: "Simulate success" }).click();
  await p.waitForURL(/fees\/receipt/, { timeout: 30_000 }).catch(() => {});
  ok("a successful payment produces a receipt", (await seen(p, "One Thousand Rupees Only")) && (await seen(p, "TEST-CARD")));
  const pdf = await p.context().request.get(`${p.url()}/pdf`);
  ok("the receipt downloads as a PDF", pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === "%PDF");

  await p.click("[data-tour=user] > button");
  await p.selectOption('select[name="lang"]', "hi");
  await p.waitForTimeout(1500);
  await go(p, "/dashboard");
  ok("student dashboard reads in Hindi", (await seen(p, "कुल उपस्थिति")) && (await seen(p, "मेरे कार्य")));
  await p.context().close();

  const parent = await session(browser, "parent@edupilot.edu");
  ok("a parent with two children gets a switcher", await parent.locator('select[name="child"]').isVisible());
  const first = await parent.locator("section").first().textContent();
  await parent.selectOption('select[name="child"]', { index: 1 });
  await parent.waitForTimeout(2500);
  const second = (await parent.locator("section").first().textContent()) ?? "";
  ok("switching child changes whose record is shown", first !== second && /DCSE/.test(second));
  await parent.context().close();
});

test("staff: leave with balance rules, appraisal record, class swap, HOD approval, staff attendance", async ({ browser }) => {
  const t = await session(browser, "faculty@edupilot.edu");
  await go(t, "/staff/leave");
  await t.selectOption("#type", "CASUAL");
  await t.fill("#fromDate", "2026-11-12");
  await t.fill("#toDate", "2026-11-13");
  await t.fill("#reason", "E2E personal work");
  await t.getByRole("button", { name: "Submit" }).click();
  ok("leave applied", await seen(t, "working day(s) submitted"));
  await t.fill("#fromDate", "2026-11-13");
  await t.fill("#toDate", "2026-11-13");
  await t.fill("#reason", "E2E overlap attempt");
  await t.getByRole("button", { name: "Submit" }).click();
  ok("overlapping leave is refused", await seen(t, "overlapping"));

  await go(t, "/staff/achievements");
  await t.fill("#title", "E2E paper on testing");
  await t.fill("#date", "2026-09-01");
  await t.getByRole("button", { name: "Add", exact: true }).click();
  ok("appraisal record added", await seen(t, "Added to your appraisal record"));
  await go(t, "/staff/swaps");
  await t.getByRole("button", { name: "Accept" }).first().click();
  ok("class swap accepted", await seen(t, "The class is on your Attendance page"));
  await t.context().close();

  const hod = await session(browser, "hod.cse@edupilot.edu");
  ok("HOD's tasks include staff leave to approve", await seen(hod, "Staff leave requests to approve"));
  await go(hod, "/staff/leave");
  await hod.locator("tr").filter({ hasText: "E2E personal work" }).getByRole("button", { name: "Approve" }).click();
  ok("HOD approves the leave", await seen(hod, "Approved."));
  await go(hod, "/staff");
  await hod.locator('select[name^="u_"]').first().selectOption("HALF_DAY");
  await hod.getByRole("button", { name: "Save attendance" }).click();
  ok("staff attendance saved", await seen(hod, "Saved for"));
  await hod.context().close();
});

test("reports, alumni, alerts and the interface helpers", async ({ browser }) => {
  const a = await session(browser, "admin@edupilot.edu");
  await go(a, "/reports?dataset=students&run=1");
  ok("report builder returns rows", await seen(a, /Students · \d+ rows/));
  const csv = await (await a.context().request.get("/reports/export?dataset=students&format=csv&cols=rollNo&cols=name&cols=cgpa")).text();
  ok("the download has only the chosen columns", csv.split("\r\n")[0].replace("﻿", "") === "Roll no,Name,CGPA");
  await go(a, "/reports/accreditation");
  ok("accreditation tables render", (await seen(a, "Student strength")) && (await seen(a, "Faculty contributions")));

  await go(a, "/reports/schedules");
  await a.selectOption("#report", "fees");
  await a.getByRole("button", { name: "Schedule", exact: true }).click();
  ok("report scheduled", await seen(a, "You'll receive this"));
  await a.locator("tr").filter({ hasText: "Fee collection summary" }).getByRole("button", { name: "Send now" }).click();
  ok("send now works without a mail server", await seen(a, "Generated and saved"));
  await go(a, "/admin/email");
  ok("the scheduled report is in the outbox", await seen(a, "Weekly report: Fee collection summary"));

  await go(a, "/alumni");
  await a.getByRole("link", { name: "Update" }).first().click();
  await a.waitForURL(/edit=/);
  await a.fill('input[name="company"]', "E2E Industries");
  await a.getByRole("button", { name: "Save", exact: true }).click();
  ok("alumni record updated", (await seen(a, "Alumni record updated")) && (await seen(a, "E2E Industries")));

  await go(a, "/attendance/report");
  ok("WhatsApp reminder link is prepared", ((await a.locator('a[href^="https://wa.me/91"]').first().getAttribute("href")) ?? "").includes("text=Dear%20Parent"));
  await a.getByRole("button", { name: "Email alerts" }).click();
  await confirm(a);
  ok("shortage alerts sent", await seen(a, "Alerts sent for"));

  await go(a, `/students/${f.studentId}`);
  await a.locator('button[title="Edit phone"]').click();
  await a.getByLabel("Phone", { exact: true }).fill("9000012345");
  await a.keyboard.press("Enter");
  ok("edit in place saves", await seen(a, "Phone updated"));

  await go(a, "/dashboard");
  await a.keyboard.press("?");
  ok("? opens the shortcut list", await a.getByRole("dialog", { name: "Keyboard shortcuts" }).isVisible());
  await a.keyboard.press("Escape");
  await a.keyboard.press("g");
  await a.keyboard.press("s");
  ok("g then s goes to Students", await a.waitForURL("**/students", { timeout: 15_000 }).then(() => true, () => false));

  await go(a, "/dashboard");
  await a.click("[data-tour=user] > button");
  await a.getByRole("radio", { name: "Extra large text" }).click();
  ok("text size applies", (await a.evaluate(() => document.documentElement.dataset.text)) === "xl");
  await a.getByRole("radio", { name: "Normal text" }).click();
  ok("skip link is present", (await a.locator("a.skip-link").getAttribute("href")) === "#main");
  await a.locator("#main").click({ position: { x: 4, y: 4 } });
  await a.getByRole("button", { name: "Expand chart" }).first().click({ force: true });
  ok("a chart expands to full screen", await a.getByRole("button", { name: "Exit full screen" }).isVisible());
  await a.getByRole("button", { name: "Exit full screen" }).click();
  const download = a.waitForEvent("download", { timeout: 15_000 }).then((d) => d.suggestedFilename(), () => null);
  await a.getByRole("button", { name: "Download chart as image" }).first().click({ force: true });
  ok("a chart downloads as an image", /\.png$/.test((await download) ?? ""));
  await a.context().close();
});

test("access control: each role is kept out of what it must not see", async ({ browser }) => {
  const blocked: [string, string[]][] = [
    ["student@edupilot.edu", ["/students", "/admissions", "/admin/settings", "/scholarships", "/reports", "/staff", "/alumni", "/exams/outcomes"]],
    ["parent@edupilot.edu", ["/leave", "/placements", "/students", "/materials", "/library"]],
    ["faculty@edupilot.edu", ["/admin", "/fees", "/admissions", "/reports", "/alumni"]],
    ["accounts@edupilot.edu", ["/faculty", "/exams", "/admin", "/alumni"]],
  ];
  for (const [email, paths] of blocked) {
    const p = await session(browser, email);
    for (const path of paths) {
      await p.goto(path);
      ok(`${email.split("@")[0]} is turned away from ${path}`, await p.waitForURL(/denied=1/, { timeout: 15_000 }).then(() => true, () => false));
    }
    const res = await p.context().request.get(`/students/${f.studentId}/summary`);
    if (email.startsWith("student") || email.startsWith("parent")) ok(`${email.split("@")[0]} cannot read the student summary data`, res.status() === 403);
    await p.context().close();
  }
  // One student must not be able to open another student's documents.
  const s = await session(browser, "24btcse002@student.edupilot.edu");
  const other = await s.context().request.get(`/exams/hall-tickets/${f.studentId}/pdf`);
  ok("a student cannot download another student's hall ticket", other.status() === 404);
  await s.goto(`/students/${f.studentId}`);
  ok("a student cannot open another student's profile", await seen(s, "Not found"));
  await s.context().close();
});
