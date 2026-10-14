import { test } from "@playwright/test";
import { confirm, fixtures, go, ok, reseed, seen, session } from "./helpers";

let f: Awaited<ReturnType<typeof fixtures>>;

test.beforeAll(async () => {
  reseed();
  f = await fixtures();
});

test("first-login tour and language switch", async ({ browser }) => {
  const p = await session(browser, "accounts@edupilot.edu", { keepTour: true });
  const tour = p.getByRole("dialog", { name: "Guided tour" });
  ok("guided tour appears on first login", await seen(p, "Welcome", 8000));
  await tour.getByRole("button", { name: "Next" }).click();
  ok("tour highlights search", await seen(p, "Search anything"));
  await tour.getByRole("button", { name: "Skip" }).click();
  await p.reload();
  await p.waitForTimeout(1500);
  ok("tour is not repeated", !(await tour.isVisible().catch(() => false)));
  await p.click("[data-tour=user] > button");
  await p.selectOption('select[name="lang"]', "hi");
  ok("menu switches to Hindi", await seen(p, "डैशबोर्ड"));
  await p.context().close();
});

test("student: leave, feedback, certificate, helpdesk, elective, assignment, documents", async ({ browser }) => {
  const p = await session(browser, "student@edupilot.edu");
  await go(p, "/leave");
  await p.selectOption("#type", "ON_DUTY");
  await p.fill("#fromDate", "2026-10-06");
  await p.fill("#toDate", "2026-10-06");
  await p.fill("#reason", "E2E hackathon duty");
  await p.getByRole("button", { name: "Submit request" }).click();
  ok("leave request submitted", await seen(p, "Request submitted"));

  await go(p, "/feedback");
  const form = p.locator("form").filter({ hasText: "Submit feedback" }).first();
  for (let i = 0; i < 5; i++) await form.locator("[role=radiogroup]").nth(i).getByRole("radio").nth(3).click();
  await form.getByRole("button", { name: "Submit feedback" }).click();
  ok("anonymous feedback is acknowledged", await seen(p, "recorded anonymously"));

  await go(p, "/certificates");
  await p.selectOption("#type", "STUDY");
  await p.fill("#purpose", "E2E scholarship");
  await p.getByRole("button", { name: "Request" }).click();
  ok("certificate requested", await seen(p, "Request sent"));

  await go(p, "/helpdesk");
  await p.fill("#subject", "E2E ticket");
  await p.fill("#body", "Testing the helpdesk flow end to end.");
  await p.getByRole("button", { name: "Submit" }).click();
  ok("ticket raised", await seen(p, "Ticket raised"));

  await go(p, "/exams/electives");
  await p.getByRole("button", { name: "Select this elective" }).first().click();
  ok("elective chosen", await seen(p, "Your choice"));

  await go(p, "/materials");
  const submit = p.locator("form").filter({ hasText: /Submit|Resubmit/ }).first();
  await submit.locator('textarea[name="note"]').fill("E2E answer text");
  await submit.getByRole("button").last().click();
  ok("assignment submitted", await seen(p, "Submitted."));

  await go(p, "/id-card");
  ok("ID card renders with a QR code", (await p.locator("svg path").count()) > 0 && (await seen(p, "STUDENT IDENTITY CARD")));
  await go(p, `/exams/hall-tickets/${f.studentId}`);
  ok("hall ticket issued to an eligible student", await seen(p, "Hall ticket no."));
  const pdf = await p.context().request.get(`/exams/hall-tickets/${f.studentId}/pdf`);
  ok("hall ticket downloads as a PDF", pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === "%PDF");

  await go(p, "/placements");
  await p.fill("#skills", "Java, SQL, E2E");
  await p.getByRole("button", { name: "Save profile" }).click();
  ok("placement profile saved", await seen(p, "Profile saved"));
  await p.context().close();
});

test("faculty: approve on-duty, share material, grade, syllabus, paste marks, offline attendance", async ({ browser }) => {
  const p = await session(browser, "faculty@edupilot.edu");
  await go(p, "/leave");
  await p.locator("tr").filter({ hasText: "E2E hackathon duty" }).getByRole("button", { name: "Approve" }).click();
  ok("on-duty request approved", await seen(p, "Approved"));

  await go(p, `/materials/${f.offeringId}`);
  await p.fill("#title", "E2E notes");
  await p.fill("#link", "https://example.com/notes");
  await p.getByRole("button", { name: "Publish" }).click();
  ok("material shared", await seen(p, "Material shared"));
  const grade = p.locator("form").filter({ has: p.locator('input[name="marks"]') }).last();
  await grade.locator('input[name="marks"]').fill("9");
  await grade.getByRole("button").click();
  ok("submission graded", await seen(p, "Graded"));

  await go(p, `/syllabus/${f.offeringId}`);
  const before = await p.getByText(/\d+\/\d+ topics/).first().textContent();
  await p.locator("li button").filter({ hasNot: p.locator("svg") }).first().click();
  await p.waitForTimeout(1500);
  ok("syllabus topic ticked", before !== (await p.getByText(/\d+\/\d+ topics/).first().textContent()));

  await go(p, `/exams/${f.offeringId}`);
  await p.locator('input[data-cell="0-0"]').evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("text", "21\n22\n23");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  ok("pasting a column from a spreadsheet fills the cells", (await p.locator('input[data-cell="1-0"]').inputValue()) === "22" && (await p.locator('input[data-cell="2-0"]').inputValue()) === "23");
  ok("unsaved changes are flagged", await seen(p, "Unsaved changes", 4000));
  await p.getByRole("button", { name: "Save marks" }).click();
  ok("pasted marks saved", await seen(p, "marks saved"));

  await go(p, `/attendance/${f.offeringId}?date=2026-10-09&period=6`);
  await p.context().setOffline(true);
  await p.locator('button[title="ABSENT"]').nth(2).click();
  await p.getByRole("button", { name: "Save attendance" }).click();
  ok("offline: attendance is kept on the device", (await seen(p, "saved on this device")) && (await seen(p, "waiting to upload")));
  await p.context().setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event("online")));
  ok("back online: the saved sheet uploads", await seen(p, "Synced offline attendance", 20_000));
  await p.context().close();
});

test("admin: calendar, holiday rule, undo, seating, certificates, helpdesk, substitutes, timetable", async ({ browser }) => {
  const p = await session(browser, "admin@edupilot.edu");
  await go(p, "/calendar");
  await p.fill("#title", "E2E holiday");
  await p.fill("#date", "2026-10-07");
  await p.getByRole("button", { name: "Add" }).click();
  ok("holiday added", await seen(p, "Added to the calendar"));
  await go(p, `/attendance/${f.offeringId}?date=2026-10-07&period=1`);
  ok("attendance page warns about the holiday", await seen(p, "is a holiday"));
  await p.getByRole("button", { name: "Save attendance" }).click();
  ok("attendance is blocked on a holiday", await seen(p, "is a holiday (E2E holiday)"));

  await go(p, "/calendar");
  await p.locator("li").filter({ hasText: "Dussehra vacation" }).getByRole("button", { name: "×" }).click();
  await p.getByRole("button", { name: "Undo" }).click();
  await p.waitForTimeout(6000);
  await p.reload();
  ok("Undo keeps the record", await seen(p, "Dussehra vacation"));

  await go(p, "/exams/schedule");
  await p.getByRole("button", { name: "Generate seating" }).click();
  ok("seating plan generated", await seen(p, "students seated"));
  await go(p, `/exams/hall-tickets/${f.studentId}`);
  ok("hall ticket now shows a seat", await seen(p, "Block A"));

  await go(p, "/certificates");
  await p.locator("tr").filter({ hasText: "E2E scholarship" }).getByRole("button", { name: "Issue" }).click();
  ok("certificate issued", await seen(p, "Certificate issued"));
  await p.locator("tr").filter({ hasText: "E2E scholarship" }).getByText("View / print").click();
  ok("certificate page renders", await seen(p, /Study Certificate/i));

  await go(p, "/helpdesk");
  await p.getByText("E2E ticket").click();
  await p.waitForURL(/helpdesk\/.+/);
  await p.fill('textarea[name="body"]', "We are on it.");
  await p.selectOption('select[name="status"]', "RESOLVED");
  await p.getByRole("button", { name: "Send" }).click();
  ok("ticket answered and resolved", (await seen(p, "We are on it.")) && (await seen(p, "Resolved")));

  await go(p, "/attendance/substitutions?date=2026-10-12");
  const options = await p.locator("#facultyId option").count();
  let assigned = false;
  for (let i = 1; i < Math.min(options, 8) && !assigned; i++) {
    await p.selectOption("#facultyId", { index: i });
    await p.getByRole("button", { name: "Assign" }).click();
    assigned = await seen(p, "Substitute assigned", 4000);
  }
  ok("substitute assigned (skipping teachers who are busy)", assigned);

  await go(p, `/timetable/edit?batch=${f.batchId}`);
  await p.locator("button[draggable]").first().click();
  await p.locator("td.border-dashed").first().click();
  ok("timetable editor flags unsaved changes", await seen(p, "Unsaved changes", 4000));
  await p.getByRole("button", { name: "Save timetable" }).click();
  ok("timetable saves, or the clash guard stops it", (await seen(p, "Timetable saved", 8000)) || (await seen(p, "Faculty clash", 2000)));
  await p.context().close();
});

test("office: admissions, scholarships, instalments, fines, library, hostel, transport, bulk edit, branding, dashboard", async ({ browser }) => {
  const p = await session(browser, "admin@edupilot.edu");
  await go(p, "/admissions");
  await p.fill("#name", "E2E Applicant");
  await p.fill("#phone", "9876543210");
  await p.getByRole("button", { name: "Add enquiry" }).click();
  ok("enquiry added", await seen(p, "Enquiry added"));
  await p.locator("li").filter({ hasText: "E2E Applicant" }).getByRole("button").first().click();
  await p.waitForTimeout(1500);
  ok("enquiry moves to Applied", await p.locator("section").filter({ has: p.getByRole("heading", { name: /Applied/ }) }).getByText("E2E Applicant").isVisible().catch(() => false));

  await go(p, "/scholarships");
  await p.getByRole("button", { name: "Received" }).first().click();
  await confirm(p);
  ok("scholarship marked received", await seen(p, "Marked received"));

  await go(p, `/fees/${f.invoiceId}`);
  await p.selectOption("#count", "3");
  await p.fill("#firstDue", "2026-11-01");
  await p.getByRole("button", { name: "Save plan" }).click();
  ok("instalment plan saved", await seen(p, "Split into 3 instalments"));
  await go(p, "/fees");
  await p.getByRole("button", { name: "Apply late fines" }).click();
  await confirm(p);
  ok("late fines applied", await seen(p, "Late fines updated"));

  await go(p, "/library");
  const issue = p.locator("form").filter({ has: p.locator('input[name="member"]') }).nth(6);
  await issue.locator('input[name="member"]').fill("24BTCSE002");
  await issue.getByRole("button", { name: "Issue" }).click();
  ok("book issued", await seen(p, "Due in 14 days"));
  await p.getByRole("button", { name: "Return" }).first().click();
  ok("book returned", await seen(p, "Returned"));

  await go(p, "/hostel");
  const rooms = await p.locator("#roomId option").count();
  let allotted = false;
  for (let i = 0; i < rooms && !allotted; i++) {
    await p.fill("#rollNo", "24BTCSE002");
    await p.selectOption("#roomId", { index: i });
    await p.getByRole("button", { name: "Allot", exact: true }).click();
    allotted = await seen(p, "Allotted", 2500);
  }
  ok("hostel room allotted in a hostel matching the student's gender", allotted);
  await go(p, "/transport");
  await p.fill("#rollNo", "24BTCSE002");
  await p.getByRole("button", { name: "Issue pass" }).click();
  ok("bus pass issued", await seen(p, "Bus pass issued"));

  await go(p, "/students");
  const boxes = p.locator("tbody input[type=checkbox]");
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  ok("bulk bar appears", await seen(p, "2 selected"));
  await p.selectOption('select[name="value"]', "DETAINED");
  await p.getByRole("button", { name: "Apply" }).click();
  await confirm(p);
  ok("bulk status change applied", await seen(p, "2 students updated"));
  // A second confirmation in a row must still ask (this once silently skipped the dialog).
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await p.selectOption('select[name="value"]', "ACTIVE");
  await p.getByRole("button", { name: "Apply" }).click();
  await confirm(p);
  ok("the confirm dialog asks every time", await seen(p, "2 students updated"));
  await p.getByRole("button", { name: /Quick view/ }).first().click();
  ok("quick view shows a summary", (await seen(p, "Open full profile")) && (await seen(p, "CGPA")));
  await p.keyboard.press("Escape");
  await p.getByRole("link", { name: /^Name/ }).click();
  ok("columns sort", await p.waitForURL(/sort=name/, { timeout: 15_000 }).then(() => true, () => false));

  await go(p, `/students/${f.studentId}`);
  await p.fill("#pemail", "e2e.parent@example.com");
  await p.getByRole("button", { name: /parent login/ }).click();
  ok("parent login created with a temporary password", await seen(p, "temporary password"));

  await go(p, "/admin/settings");
  await p.fill("#shortName", "E2E College");
  await p.fill("#brandColor", "#0f766e");
  await p.getByRole("button", { name: "Save settings" }).click();
  ok("branding saved", await seen(p, "Settings saved"));
  await p.reload();
  ok("sidebar shows the new name", await seen(p, "E2E College"));
  ok("brand colour is applied", (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand-start").trim())) === "#0f766e");

  await go(p, "/dashboard?days=60");
  ok("dashboard range filter", await p.getByRole("heading", { name: /last 60 days/ }).waitFor({ timeout: 15_000 }).then(() => true, () => false));
  await p.locator("summary").filter({ hasText: "Customise" }).click();
  await p.locator('input[value="demographics"]').uncheck();
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await seen(p, "Dashboard updated");
  await p.reload();
  await p.waitForTimeout(1500);
  ok("a hidden dashboard section stays hidden", !(await p.getByText("Student demographics").isVisible().catch(() => false)));
  await p.context().close();
});

test("accounts and parent: payment at the counter, receipt, child's record on a phone", async ({ browser }) => {
  const a = await session(browser, "accounts@edupilot.edu");
  await go(a, "/fees?status=OVERDUE");
  await a.locator("table tbody a").first().click();
  await a.waitForURL(/\/fees\/[a-z0-9]+$/);
  await a.fill("#amount", "1000");
  await a.selectOption("#mode", "UPI");
  await a.getByRole("button", { name: /Collect/ }).click();
  ok("a failed validation keeps what was typed", (await seen(a, "reference is required")) && (await a.inputValue("#amount")) === "1000");
  await a.fill("#reference", "UTR-E2E-1");
  await a.getByRole("button", { name: /Collect/ }).click();
  await a.waitForURL(/\/fees\/receipt\//, { timeout: 30_000 }).catch(() => {});
  ok("payment produces a receipt with the amount in words", await seen(a, "One Thousand Rupees Only"));
  await a.context().close();

  const p = await session(browser, "parent@edupilot.edu", { viewport: { width: 390, height: 844 } });
  ok("parent sees the child's dashboard", await seen(p, "You are viewing"));
  ok("phones get a bottom tab bar", await p.locator("nav.fixed.bottom-3").isVisible());
  await go(p, "/results");
  ok("parent can read results", await seen(p, "CGPA"));
  await go(p, "/leave");
  ok("parent cannot apply for leave", await p.waitForURL(/denied=1/, { timeout: 15_000 }).then(() => true, () => false));
  await p.context().close();
});
