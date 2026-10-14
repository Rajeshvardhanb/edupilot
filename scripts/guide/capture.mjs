// Captures the screenshots used in the product guide from a running copy of the app.
// Usage: node scripts/guide/capture.mjs [baseUrl]   (default http://localhost:3001, demo data, password123)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const B = process.argv[2] ?? "http://localhost:3001";
const OUT = "docs/product-guide/shots";
const only = process.argv[3]?.split(",");
mkdirSync(OUT, { recursive: true });

const EMAIL = { admin: "admin@edupilot.edu", hod: "hod.cse@edupilot.edu", faculty: "faculty@edupilot.edu", accounts: "accounts@edupilot.edu", student: "student@edupilot.edu", parent: "parent@edupilot.edu", office: "office@edupilot.edu" };

// name, path — or { from, link } to open the first matching link on a list page. `y` scrolls, `act` runs a named step.
const SHOTS = {
  public: [["login", "/login"], ["forgot-password", "/forgot-password"]],
  admin: [
    ["admin-dashboard", "/dashboard"],
    ["admin-dashboard-kpis", "/dashboard", { to: "text=Daily attendance" , up: 250 }],
    ["admin-dashboard-departments", "/dashboard", { to: "h2:has-text('Departments')", up: 110 }],
    ["search", "/dashboard", { act: "palette" }],
    ["notifications-bell", "/dashboard", { act: "bell" }],
    ["students", "/students"],
    ["student-profile", { from: "/students?q=24BTCSE001", link: 'tbody a[href^="/students/"]' }],
    ["student-new", "/students/new"],
    ["student-import", "/students/import"],
    ["student-id-card", { from: "/students?status=ACTIVE", link: 'tbody a[href^="/students/"]', suffix: "/id-card" }],
    ["faculty", "/faculty"],
    ["faculty-profile", { from: "/faculty", link: 'a[href^="/faculty/c"]' }],
    ["admissions", "/admissions", { y: 545 }],
    ["staff", "/staff"],
    ["staff-leave", "/staff/leave"],
    ["staff-achievements", "/staff/achievements"],
    ["alumni", "/alumni", { y: 260 }],
    ["academics-departments", "/academics"],
    ["academics-programs", "/academics/programs"],
    ["academics-batches", "/academics/batches"],
    ["academics-subjects", "/academics/subjects"],
    ["academics-allocation", "/academics/allocation"],
    ["academics-terms", "/academics/terms"],
    ["timetable", "/timetable"],
    ["timetable-edit", { from: "/timetable", link: 'a[href^="/timetable/edit"]' }],
    ["attendance-report", "/attendance/report"],
    ["substitutions", "/attendance/substitutions"],
    ["leave", "/leave"],
    ["syllabus", "/syllabus"],
    ["exam-schedule", "/exams/schedule"],
    ["hall-tickets", "/exams/hall-tickets"],
    ["hall-ticket", { from: "/exams/hall-tickets", pick: "BTCSE 2024-A", link: 'a[href^="/exams/hall-tickets/c"]' }],
    ["results-sheet", "/results", { act: "results" }],
    ["supplementary", "/exams/supplementary"],
    ["electives", "/exams/electives"],
    ["outcomes", "/exams/outcomes"],
    ["outcome-attainment", { from: "/exams/outcomes", row: /Computer Networks.*BTCSE 2024-A|BTCSE 2024-A.*Computer Networks/s, link: 'a[href^="/exams/outcomes/"]' }],
    ["feedback", "/feedback"],
    ["fees", "/fees"],
    ["fee-invoice", { from: "/fees", link: 'tbody a[href^="/fees/c"]' }],
    ["fee-ledger", "/fees/payments"],
    ["fee-receipt", { from: "/fees/payments", link: 'a[href^="/fees/receipt/"]' }],
    ["fee-structures", "/fees/structures"],
    ["scholarships", "/scholarships"],
    ["placements", "/placements"],
    ["placement-drive", { from: "/placements", row: /Completed|Closed/i, link: 'a[href^="/placements/c"]' }],
    ["library", "/library", { y: 250 }],
    ["hostel", "/hostel", { y: 250 }],
    ["transport", "/transport", { y: 250 }],
    ["certificates", "/certificates"],
    ["certificate", { from: "/certificates", link: 'a[href^="/certificates/c"]' }],
    ["helpdesk", "/helpdesk"],
    ["helpdesk-ticket", { from: "/helpdesk", link: 'a[href^="/helpdesk/c"]' }],
    ["calendar", "/calendar", { y: 250 }],
    ["notices", "/notices", { y: 250 }],
    ["reports", "/reports", { act: "report" }],
    ["accreditation", "/reports/accreditation"],
    ["report-schedules", "/reports/schedules"],
    ["admin-users", "/admin"],
    ["admin-health", "/admin/health"],
    ["promote", { from: "/academics/batches", link: 'a[href$="/promote"]' }],
    ["revaluation", "/exams/revaluation"],
    ["payroll", "/staff/payroll"],
    ["payslip", { from: "/staff/payroll", link: 'a[href^="/staff/payroll/c"]' }],
    ["inventory", "/inventory"],
    ["gate", "/gate"],
    ["admin-setup", "/admin/setup", { act: "setup" }],
    ["admin-rules", "/admin/rules"],
    ["fee-closing", "/fees/closing", { act: "closing" }],
    ["fee-refund", { from: "/fees/payments", row: /Refund/, link: 'a[href^="/fees/c"]' }, { y: 330 }],
    ["fee-statement", { from: "/students?q=24BTCSE001", link: 'tbody a[href^="/students/"]', prefix: "/fees/statement" }],
    ["parent-contacts", "/students/contacts"],
    ["parent-contact-log", { from: "/students?q=24BTCSE004", link: 'tbody a[href^="/students/"]' }, { to: "h2:has-text('Parent contact log')", up: 140 }],
    ["admin-settings", "/admin/settings"],
    ["admin-email", "/admin/email"],
    ["admin-audit", "/admin/audit"],
  ],
  hod: [["hod-dashboard", "/dashboard"]],
  office: [["office-dashboard", "/dashboard"], ["office-dashboard-more", "/dashboard", { y: 500 }]],
  faculty: [
    ["faculty-dashboard", "/dashboard"],
    ["attendance-courses", "/attendance"],
    ["attendance-sheet", { from: "/attendance", row: /Computer Networks/, link: 'a[href^="/attendance/c"]' }],
    ["marks-courses", "/exams"],
    ["marks-grid", { from: "/exams", row: /Computer Networks/, link: 'a[href^="/exams/c"]', y: 380 }],
    ["materials-faculty", { from: "/materials", row: /Computer Networks/, link: 'a[href^="/materials/c"]' }],
    ["syllabus-coverage", { from: "/syllabus", row: /Computer Networks/, link: 'a[href^="/syllabus/c"]' }],
    ["staff-swaps", "/staff/swaps"],
  ],
  accounts: [["accounts-dashboard", "/dashboard"], ["accounts-dashboard-charts", "/dashboard", { y: 520 }]],
  student: [
    ["student-dashboard", "/dashboard"],
    ["student-dashboard-more", "/dashboard", { y: 560 }],
    ["student-attendance", "/attendance"],
    ["student-timetable", "/timetable"],
    ["student-results", "/results"],
    ["student-fees", "/fees"],
    ["student-pay", "/fees", { act: "pay" }],
    ["student-materials", "/materials"],
    ["student-placements", "/placements"],
    ["student-leave", "/leave"],
    ["student-certificates", "/certificates"],
    ["student-helpdesk", "/helpdesk"],
    ["student-id-card", "/id-card"],
    ["student-feedback", "/feedback"],
    ["profile", "/profile"],
    ["notifications", "/notifications"],
  ],
  parent: [["parent-dashboard", "/dashboard"]],
  "student:m": [["m-student-dashboard", "/dashboard"], ["m-student-attendance", "/attendance", { y: 430 }], ["m-student-fees", "/fees"], ["m-student-timetable", "/timetable"], ["m-menu", "/dashboard", { act: "menu" }]],
  "faculty:m": [["m-attendance-sheet", { from: "/attendance", row: /Computer Networks/, link: 'a[href^="/attendance/c"]' }]],
};

const browser = await chromium.launch();
for (const [key, shots] of Object.entries(SHOTS)) {
  const [role, m] = key.split(":");
  const viewport = m ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: m ? 1.5 : 1 });
  const page = await ctx.newPage();
  const idle = () => page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  const go = async (path) => { await page.goto(B + path, { timeout: 120000 }); await idle(); };
  if (role !== "public") {
    await go("/login");
    await page.fill('input[name="email"]', EMAIL[role]);
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 120000 });
    await page.getByRole("dialog", { name: "Guided tour" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
  }
  for (const [name, target, opt = {}] of shots) {
    if (only && !only.includes(name)) continue;
    try {
      if (typeof target === "string") await go(target);
      else {
        await go(target.from);
        if (target.pick) { await page.locator("select").first().selectOption({ label: (await page.locator("select").first().locator("option").allInnerTexts()).find((o) => o.includes(target.pick)) }); await page.waitForTimeout(1500); await idle(); }
        // `row` narrows to the first table row / list item / card whose text matches, falling back to the first link.
        let scope = page.locator("main");
        if (target.row) { const hit = page.locator("main tr, main li, main article, main section").filter({ hasText: target.row }).filter({ has: page.locator(target.link) }).last(); if (await hit.count()) scope = hit; }
        const href = await scope.locator(target.link).first().getAttribute("href", { timeout: 15000 });
        // `prefix` swaps the list's base path for another page about the same record (e.g. a student's fee statement).
        const base = target.prefix ? `${target.prefix}/${href.split("?")[0].split("/").pop()}` : href.split("?")[0];
        await go(base + (target.suffix ?? "") + (href.includes("?") && !target.suffix && !target.prefix ? "?" + href.split("?")[1] : ""));
      }
      if (opt.to) { await page.locator(opt.to).first().scrollIntoViewIfNeeded({ timeout: 8000 }); await page.evaluate((up) => window.scrollBy(0, -up + 80), opt.up ?? 0); }
      if (opt.y ?? target.y) await page.evaluate((y) => window.scrollTo(0, y), opt.y ?? target.y);
      if (opt.act === "palette") { await page.keyboard.press("Control+k"); await page.getByRole("dialog", { name: "Search" }).locator("input").fill("Priya"); await page.getByRole("dialog", { name: "Search" }).getByText(/Priya/).first().waitFor({ timeout: 15000 }); }
      if (opt.act === "bell") await page.locator('[data-tour="bell"] button').first().click();
      if (opt.act === "menu") await page.getByRole("button", { name: "Open menu" }).click();
      if (opt.act === "setup") { await page.locator("#step-6 summary").click(); await page.locator("#step-5").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -90)); }
      if (opt.act === "closing") { const d = await page.locator('main ul a[href^="/fees/closing?date="]').nth(1).getAttribute("href"); await go(d); }
      if (opt.act === "report") { await page.getByRole("button", { name: /Run report/ }).click(); await page.locator("tbody tr").first().waitFor({ timeout: 30000 }); }
      if (opt.act === "results") {
        const values = await page.locator('select[name="batch"] option').evaluateAll((o) => o.map((x) => x.value));
        for (const v of values) { await go(`/results?batch=${v}`); if (await page.locator("tbody tr").count()) break; }
      }
      if (opt.act === "pay") { await page.getByRole("button", { name: /Pay now/ }).first().click(); await page.waitForURL(/\/pay\//, { timeout: 30000 }); await idle(); }
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 86 });
      console.log("ok  ", name);
    } catch (e) { console.log("FAIL", name, e.message.split("\n")[0].slice(0, 140)); }
  }
  await ctx.close();
}
await browser.close();
