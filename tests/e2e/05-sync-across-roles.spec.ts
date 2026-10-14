import { test, type Browser, type Page } from "@playwright/test";
import { confirm, db, fixtures, fresh, go, ok, reseed, seen, session, signIn } from "./helpers";

// One change, everyone who should see it: each step is made by one role and then checked from the screens of the
// others (student, parent, teacher, head of department, office, accounts, administrator). The steps build on each
// other, so the tests in this file run in order on one demo college.

const ROLL = "24BTCSE901";
const NAME = "Ishani Sync";
const STUDENT_EMAIL = "ishani.sync@example.com";
const PARENT_EMAIL = "ishani.parent@example.com";
const STUDENT_PW = "Ishani2026go";
const PARENT_PW = "Parent2026go";

let f: Awaited<ReturnType<typeof fixtures>>;
let ids: { newStudent: string; webTech: string; cloud: string; cloudFaculty: string; kavya: string; structure: string; cloudSubject: string };

// Each flow walks through several people's screens, so it gets more time than the default.
test.describe.configure({ timeout: 600_000 });

test.beforeAll(async () => {
  reseed();
  f = await fixtures();
  const offering = (subject: string) => db.courseOffering.findFirstOrThrow({ where: { batchId: f.batchId, term: { isCurrent: true }, subject: { name: subject } } });
  const [webTech, cloud, kavya, invoice] = await Promise.all([
    offering("Web Technologies"), offering("Cloud Computing"),
    db.faculty.findFirstOrThrow({ where: { user: { email: "faculty@edupilot.edu" } } }),
    db.feeInvoice.findUniqueOrThrow({ where: { id: f.invoiceId } }),
  ]);
  ids = { newStudent: "", webTech: webTech.id, cloud: cloud.id, cloudFaculty: cloud.facultyId!, kavya: kavya.id, structure: invoice.structureId!, cloudSubject: cloud.subjectId };
});

/** Signs in with a temporary password, sets a new one as the app insists, and lands on the dashboard. */
async function firstSignIn(browser: Browser, email: string, temporary: string, chosen: string) {
  const p = await fresh(browser);
  await signIn(p, email, temporary);
  await p.waitForURL("**/change-password", { timeout: 60_000 });
  await p.fill("#current", temporary);
  await p.fill("#password", chosen);
  await p.fill("#confirm", chosen);
  await p.getByRole("button", { name: "Save and continue" }).click();
  await p.waitForURL("**/dashboard", { timeout: 60_000 });
  const skip = p.getByRole("dialog", { name: "Guided tour" }).getByRole("button", { name: "Skip" });
  await skip.waitFor({ timeout: 5000 }).then(() => skip.click(), () => {});
  return p;
}

/** The row of a table (or list item) that mentions `text`. */
const row = (p: Page, text: string) => p.locator("tr, li").filter({ hasText: text }).first();
const rupees = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

test("admission: the office admits a student, who signs in to their own dashboard and appears for every role that works with them", async ({ browser }) => {
  const office = await session(browser, "office@edupilot.edu");
  await go(office, "/students/new");
  await office.fill("#name", NAME);
  await office.fill("#email", STUDENT_EMAIL);
  await office.fill("#phone", "9000000001");
  await office.selectOption("#gender", "FEMALE");
  await office.fill("#rollNo", ROLL);
  await office.selectOption("#batchId", f.batchId);
  await office.fill("#guardianName", "Ravi Sync");
  await office.fill("#guardianPhone", "9000000002");
  await office.getByRole("button", { name: "Admit student" }).click();
  ok("admission opens the new student's record", await office.waitForURL(/\/students\/[a-z0-9]+\?created=1/, { timeout: 30_000 }).then(() => true, () => false));
  const created = await db.student.findUnique({ where: { rollNo: ROLL }, include: { user: true } });
  ok("the student and their login are saved", created && created.user.role === "STUDENT" && created.user.mustChangePassword);
  ids.newStudent = created!.id;

  await office.fill("#pemail", PARENT_EMAIL);
  await office.getByRole("button", { name: /parent login/ }).click();
  ok("parent login created", await seen(office, "temporary password"));
  const parentTemp = /Parent@[a-z0-9]+/.exec((await office.getByText(/temporary password Parent@/).first().textContent()) ?? "")?.[0] ?? "";
  ok("the temporary password is shown to pass on", parentTemp.length > 7);
  await office.context().close();

  // The student's first password is the roll number in lower case, and must be changed straight away.
  const s = await firstSignIn(browser, STUDENT_EMAIL, ROLL.toLowerCase(), STUDENT_PW);
  ok("new student reaches their own dashboard", (await seen(s, "Ishani")) && (await seen(s, ROLL)));
  ok("dashboard shows today's classes for their batch", await seen(s, /Today/));
  await go(s, "/timetable");
  ok("timetable is their batch's timetable", await seen(s, "Web Technologies"));
  await go(s, "/attendance");
  ok("attendance lists this term's subjects, none taken yet", (await seen(s, "Cloud Computing")) && (await seen(s, "No classes yet")));
  await go(s, "/profile");
  ok("profile shows what the office entered", (await seen(s, NAME)) && (await seen(s, "9000000001")));
  await s.context().close();

  const parent = await firstSignIn(browser, PARENT_EMAIL, parentTemp, PARENT_PW);
  ok("parent sees the new child", (await seen(parent, "You are viewing")) && (await seen(parent, NAME)));
  await parent.context().close();

  const fac = await session(browser, "faculty@edupilot.edu");
  await go(fac, `/attendance/${ids.webTech}?date=2026-10-13&period=8`);
  ok("teacher's attendance sheet includes the new student", await seen(fac, ROLL));
  await go(fac, `/exams/${ids.webTech}`);
  ok("teacher's marks sheet includes the new student", await seen(fac, NAME));
  await fac.context().close();

  const hod = await session(browser, "hod.cse@edupilot.edu");
  await go(hod, `/students?q=${ROLL}`);
  ok("head of department finds the student in the department list", await seen(hod, NAME));
  await hod.context().close();

  const admin = await session(browser, "admin@edupilot.edu");
  const found = await (await admin.context().request.get(`/search?q=${ROLL}`)).json();
  ok("administrator's search finds the student", Array.isArray(found) && found.some((x: { rollNo: string }) => x.rollNo === ROLL));
  await admin.context().close();
});

test("teaching: attendance, on-duty approval, marks, published results and a new teacher reach the student and the parent", async ({ browser }) => {
  const demoBefore = await db.attendanceRecord.count({ where: { studentId: f.studentId, status: { not: "ABSENT" }, session: { offeringId: ids.webTech } } });

  const fac = await session(browser, "faculty@edupilot.edu");
  await go(fac, `/attendance/${ids.webTech}?date=2026-10-13&period=8`);
  await row(fac, ROLL).locator('button[title="ABSENT"]').click();
  await fac.getByRole("button", { name: "Save attendance" }).click();
  ok("teacher saves the class", await seen(fac, /Saved: \d+ present, 1 absent/));
  ok("classmates marked present are counted for them too", (await db.attendanceRecord.count({ where: { studentId: f.studentId, status: { not: "ABSENT" }, session: { offeringId: ids.webTech } } })) === demoBefore + 1);

  const s = await signedIn(browser, STUDENT_EMAIL, STUDENT_PW);
  await go(s, "/attendance");
  ok("student sees the absence: 0 of 1 in Web Technologies", await row(s, "Web Technologies").getByText("0/1").isVisible());
  ok("and it is listed under recent absences", await seen(s, "13 Oct 2026"));

  const parent = await signedIn(browser, PARENT_EMAIL, PARENT_PW);
  await go(parent, "/attendance");
  ok("parent sees the same 0 of 1", await row(parent, "Web Technologies").getByText("0/1").isVisible());

  // The absence was for a college event: an approved on-duty request turns it into attendance.
  await go(s, "/leave");
  await s.selectOption("#type", "ON_DUTY");
  await s.fill("#fromDate", "2026-10-13");
  await s.fill("#toDate", "2026-10-13");
  await s.fill("#reason", "Sync test: inter-college fest");
  await s.getByRole("button", { name: "Submit request" }).click();
  ok("student's on-duty request is sent", await seen(s, "Request submitted"));
  await go(fac, "/leave");
  await row(fac, "Sync test: inter-college fest").getByRole("button", { name: "Approve" }).click();
  ok("teacher approves it and the absence is converted", await seen(fac, /Approved\. 1 absences changed to On-duty/));
  await go(s, "/leave");
  ok("student sees the request approved", await row(s, "inter-college fest").getByText("Approved").isVisible());
  await go(s, "/attendance");
  ok("student's attendance now reads 1 of 1", await row(s, "Web Technologies").getByText("1/1").isVisible());
  await go(parent, "/attendance");
  ok("and so does the parent's", await row(parent, "Web Technologies").getByText("1/1").isVisible());

  // Marks: an end-semester exam, everyone's marks, then the head of department publishes.
  await go(fac, `/exams/${ids.webTech}`);
  await fac.fill("#name", "End Semester");
  await fac.selectOption("#type", "END_SEM");
  await fac.fill("#maxMarks", "70");
  await fac.getByRole("button", { name: "Add" }).click();
  ok("teacher adds the end-semester exam", await seen(fac, "Assessment added"));
  await fac.reload();
  const assessments = await db.assessment.findMany({ where: { offeringId: ids.webTech } });
  const end = assessments.find((a) => a.type === "END_SEM")!;
  const students = await db.student.findMany({ where: { batchId: f.batchId, status: { in: ["ACTIVE", "DETAINED"] } }, select: { id: true } });
  for (const st of students) await fac.fill(`input[name="m_${end.id}_${st.id}"]`, st.id === ids.newStudent ? "61" : "50");
  for (const a of assessments.filter((x) => x.type !== "END_SEM")) await fac.fill(`input[name="m_${a.id}_${ids.newStudent}"]`, String(Math.round(a.maxMarks * 0.8)));
  await fac.getByRole("button", { name: "Save marks" }).click();
  ok("teacher saves the marks", await seen(fac, "marks saved"));

  const hod = await session(browser, "hod.cse@edupilot.edu");
  await go(hod, `/exams/${ids.webTech}`);
  await hod.getByRole("button", { name: /Publish/ }).click();
  await confirm(hod);
  ok("head of department publishes the results", await seen(hod, `Results published for ${students.length} students`));
  const result = await db.subjectResult.findFirst({ where: { offeringId: ids.webTech, studentId: ids.newStudent } });
  ok("the new student's result is worked out", result?.passed === true);

  await go(s, "/results");
  ok("student sees the Web Technologies grade", (await seen(s, "Web Technologies")) && (await row(s, "Web Technologies").getByText(result!.grade, { exact: true }).isVisible()));
  await go(s, "/notifications");
  ok("student is told the result is out", await seen(s, "Result published: Web Technologies"));
  await go(parent, "/results");
  ok("parent sees the same grade", await row(parent, "Web Technologies").getByText(result!.grade, { exact: true }).isVisible());

  // The head of department gives Cloud Computing to another teacher.
  await go(hod, `/academics/allocation?batch=${f.batchId}`);
  const cloud = row(hod, "Cloud Computing");
  await cloud.locator('select[name="facultyId"]').selectOption(ids.kavya);
  await cloud.getByRole("button", { name: "Save" }).click();
  ok("head of department reallocates the subject", await seen(hod, "Faculty allocated"));
  await go(s, "/attendance");
  ok("student sees the new teacher", await row(s, "Cloud Computing").getByText("Kavya Patel").isVisible());
  await go(fac, "/attendance");
  ok("the new teacher finds the subject in their list", await seen(fac, "Cloud Computing"));
  await go(hod, `/academics/allocation?batch=${f.batchId}`);
  await row(hod, "Cloud Computing").locator('select[name="facultyId"]').selectOption(ids.cloudFaculty);
  await row(hod, "Cloud Computing").getByRole("button", { name: "Save" }).click();
  await seen(hod, "Faculty allocated");
  await go(fac, "/attendance");
  ok("and it leaves their list once given back", !(await seen(fac, "Cloud Computing", 3000)));

  for (const p of [fac, s, parent, hod]) await p.context().close();
});

test("records and requests: profile edits, corrections, fees, placements and notices reach the people concerned", async ({ browser }) => {
  const s = await signedIn(browser, STUDENT_EMAIL, STUDENT_PW);
  const parent = await signedIn(browser, PARENT_EMAIL, PARENT_PW);
  const office = await session(browser, "office@edupilot.edu");

  // The office corrects a detail directly …
  await go(office, `/students/${ids.newStudent}/edit`);
  await office.fill("#phone", "9000000099");
  await office.getByRole("button", { name: "Save changes" }).click();
  await office.waitForURL(new RegExp(`/students/${ids.newStudent}$`), { timeout: 30_000 });
  await go(s, "/profile");
  ok("office's edit shows on the student's profile", await seen(s, "9000000099"));

  // … and the student asks for one, which changes nothing until the office approves.
  await s.selectOption('select[name="field"]', "address");
  await s.fill('input[name="newValue"]', "12 Sync Street, Hyderabad");
  await s.getByRole("button", { name: "Send to the office" }).click();
  ok("student's correction is sent", await seen(s, "Sent to the office"));
  ok("nothing changes before approval", (await db.student.findUniqueOrThrow({ where: { id: ids.newStudent } })).address !== "12 Sync Street, Hyderabad");
  await go(office, "/students/changes");
  await row(office, "12 Sync Street").getByRole("button", { name: "Approve" }).click();
  await office.waitForTimeout(1500);
  await go(office, `/students/${ids.newStudent}`);
  ok("office sees the corrected address on the record", await seen(office, "12 Sync Street, Hyderabad"));
  await go(s, "/profile");
  ok("student sees the correction applied", await seen(s, "Applied"));
  await office.context().close();

  // Fees: accounts raise the batch's invoice, collect part of it, and both student and parent see the balance.
  const acc = await session(browser, "accounts@edupilot.edu");
  await go(acc, "/fees/structures");
  await acc.selectOption("#structureId", ids.structure);
  await acc.selectOption("#batchId", f.batchId);
  await acc.fill("#dueDate", "2026-11-30");
  await acc.getByRole("button", { name: "Generate" }).click();
  ok("only the newly admitted student gets a new invoice", await seen(acc, "1 invoices generated"));
  const invoice = await db.feeInvoice.findFirstOrThrow({ where: { studentId: ids.newStudent } });
  await go(s, "/dashboard");
  ok("student's dashboard shows the fee due", await seen(s, rupees(invoice.amount)));
  await go(parent, "/fees");
  ok("parent sees the invoice", await seen(parent, invoice.invoiceNo));
  await go(acc, `/fees/${invoice.id}`);
  await acc.fill("#amount", "5000");
  await acc.selectOption("#mode", "CASH");
  await acc.getByRole("button", { name: /Collect/ }).click();
  ok("accounts collect ₹5,000 and print a receipt", await acc.waitForURL(/\/fees\/receipt\//, { timeout: 30_000 }).then(() => true, () => false));
  await go(s, "/dashboard");
  ok("student's fee due drops by ₹5,000", await seen(s, rupees(invoice.amount - 5000)));
  await go(parent, `/fees/${invoice.id}`);
  ok("parent sees the payment and the new balance", (await seen(parent, rupees(5000))) && (await seen(parent, rupees(invoice.amount - 5000))));
  await acc.context().close();

  // Placements: a drive from the head of department, eligibility, applying, withdrawing and selection.
  const hod = await session(browser, "hod.cse@edupilot.edu");
  await go(hod, "/placements");
  await hod.fill("#company", "Sync Systems");
  await hod.fill("#role", "Graduate Engineer");
  await hod.fill("#ctcLpa", "9");
  await hod.fill("#driveDate", "2026-11-20");
  await hod.getByRole("button", { name: "Publish drive" }).click();
  ok("drive published", await seen(hod, "Drive published"));
  const drive = await db.placementDrive.findFirstOrThrow({ where: { company: { name: "Sync Systems" } } });

  await go(s, "/placements");
  ok("a new student without a CGPA yet is told why they cannot apply", (await seen(s, "Sync Systems")) && !(await row(s, "Sync Systems").getByRole("button", { name: "Apply" }).isVisible()));
  const demo = await session(browser, "student@edupilot.edu");
  await go(demo, "/placements");
  await row(demo, "Sync Systems").getByRole("button", { name: "Apply" }).click();
  ok("an eligible student applies", await seen(demo, "Applied successfully"));
  await go(hod, `/placements/${drive.id}`);
  ok("head of department sees the applicant", await seen(hod, "24BTCSE001"));
  await go(demo, "/placements");
  await row(demo, "Sync Systems").getByRole("button", { name: "Withdraw" }).click();
  await demo.waitForTimeout(1500);
  await go(hod, `/placements/${drive.id}`);
  ok("a withdrawn application leaves the head of department's list", !(await seen(hod, "24BTCSE001", 3000)));
  await go(demo, "/placements");
  await row(demo, "Sync Systems").getByRole("button", { name: "Apply" }).click();
  await seen(demo, "Applied successfully");
  await go(hod, `/placements/${drive.id}`);
  await row(hod, "24BTCSE001").getByRole("button", { name: "Selected" }).click();
  await hod.waitForTimeout(1500);
  await go(demo, "/placements");
  ok("student sees the selection and the offer letter", (await row(demo, "Sync Systems").getByText("Selected").isVisible()) && (await row(demo, "Sync Systems").getByText("Offer letter").isVisible()));
  await demo.context().close();

  // Notices: published to students, seen by student and parent, then withdrawn from both.
  await go(hod, "/notices");
  await hod.fill("#title", "Sync lab closed on Friday");
  await hod.fill("#body", "The networks lab is closed this Friday for maintenance.");
  await hod.selectOption("#audience", "STUDENTS");
  await hod.getByRole("button", { name: "Publish" }).click();
  ok("notice published", await seen(hod, "Notice published"));
  await go(s, "/notices");
  ok("student sees the notice", await seen(s, "Sync lab closed on Friday"));
  await go(parent, "/notifications");
  ok("parent is notified", await seen(parent, "Notice: Sync lab closed on Friday"));
  await go(hod, "/notices");
  await row(hod, "Sync lab closed on Friday").getByRole("button", { name: "Delete" }).click();
  await confirm(hod);
  await hod.waitForTimeout(1500);
  await go(s, "/notices");
  ok("a deleted notice disappears for the student", !(await seen(s, "Sync lab closed on Friday", 3000)));
  await go(parent, "/notifications");
  ok("and its notification is taken back", !(await seen(parent, "Notice: Sync lab closed on Friday", 3000)));

  for (const p of [s, parent, hod]) await p.context().close();
});

test("deleting and switching off: removals reach everyone, and a dropped or disabled account loses access", async ({ browser }) => {
  const s = await signedIn(browser, STUDENT_EMAIL, STUDENT_PW);
  const fac = await session(browser, "faculty@edupilot.edu");

  // A class record deleted by the teacher comes off the student's attendance.
  await go(fac, `/attendance/${ids.webTech}?date=2026-10-13&period=8`);
  await row(fac, "13 Oct 2026 · P8").getByRole("button", { name: "×" }).click();
  await confirm(fac);
  await fac.waitForTimeout(1500);
  await go(s, "/attendance");
  ok("a deleted class no longer counts for the student", await row(s, "Web Technologies").getByText("No classes yet").isVisible());

  // Study material: shared, seen, deleted (after the few seconds allowed for Undo), gone.
  await go(fac, `/materials/${f.offeringId}`);
  await fac.fill("#title", "Sync test notes");
  await fac.fill("#link", "https://example.com/sync-notes");
  await fac.getByRole("button", { name: "Publish" }).click();
  ok("teacher shares material", await seen(fac, "Material shared"));
  await go(s, "/materials");
  ok("student sees it", await seen(s, "Sync test notes"));
  await fac.locator("section").filter({ hasText: "Sync test notes" }).getByRole("button", { name: "Delete" }).first().click();
  await fac.waitForTimeout(8000);
  await go(s, "/materials");
  ok("once deleted it is gone for the student", !(await seen(s, "Sync test notes", 3000)));

  // Exam schedule: added and removed by the head of department.
  const hod = await session(browser, "hod.cse@edupilot.edu");
  await go(hod, "/exams/schedule");
  await hod.selectOption("#subjectId", ids.cloudSubject);
  await hod.selectOption("#kind", "MID_2");
  await hod.fill("#date", "2026-11-05");
  await hod.getByRole("button", { name: "Save", exact: true }).click();
  ok("exam scheduled", await seen(hod, "Exam scheduled"));
  await go(s, "/exams/schedule");
  ok("student sees the exam", (await seen(s, "Cloud Computing")) && (await seen(s, "05 Nov 2026")));
  await go(hod, "/exams/schedule");
  await hod.locator("tr").filter({ hasText: "Cloud Computing" }).filter({ hasText: "05 Nov 2026" }).getByRole("button", { name: "×" }).click();
  await confirm(hod);
  ok("exam removed", await seen(hod, "Exam removed"));
  await go(s, "/exams/schedule");
  ok("and it is gone from the student's schedule", !(await seen(s, "05 Nov 2026", 3000)));

  // Calendar: an event added and removed by the administrator.
  const admin = await session(browser, "admin@edupilot.edu");
  await go(admin, "/calendar");
  await admin.fill("#title", "Sync Sports Day");
  await admin.selectOption("#type", "EVENT").catch(() => admin.selectOption("#type", { index: 2 }));
  await admin.fill("#date", "2026-11-07");
  await admin.getByRole("button", { name: "Add" }).click();
  ok("event added", await seen(admin, "Added to the calendar"));
  await go(s, "/calendar");
  ok("student sees the event", await seen(s, "Sync Sports Day"));
  await row(admin, "Sync Sports Day").getByRole("button", { name: "×" }).click();
  await admin.waitForTimeout(8000);
  await go(s, "/calendar");
  ok("removed event is gone for the student", !(await seen(s, "Sync Sports Day", 3000)));

  // An assessment created by mistake and deleted takes its column with it.
  await go(fac, `/exams/${f.offeringId}`);
  await fac.fill("#name", "Sync Quiz");
  await fac.selectOption("#type", "QUIZ");
  await fac.fill("#maxMarks", "10");
  await fac.getByRole("button", { name: "Add" }).click();
  await seen(fac, "Assessment added");
  await fac.reload();
  await row(fac, "Sync Quiz").getByRole("button", { name: "Delete" }).click();
  await confirm(fac);
  await fac.waitForTimeout(1500);
  ok("deleted assessment is gone", (await db.assessment.count({ where: { offeringId: f.offeringId, name: "Sync Quiz" } })) === 0);

  // The office records the student as dropped out: they lose access and leave the class lists.
  const office = await session(browser, "office@edupilot.edu");
  await go(office, `/students/${ids.newStudent}/edit`);
  await office.selectOption("#status", "DROPPED");
  await office.getByRole("button", { name: "Save changes" }).click();
  await office.waitForURL(new RegExp(`/students/${ids.newStudent}$`), { timeout: 30_000 });
  await go(s, "/dashboard");
  ok("the dropped student's open session ends", s.url().includes("/login"));
  await signIn(s, STUDENT_EMAIL, STUDENT_PW);
  ok("and they cannot sign in again", await seen(s, "Your account is disabled"));
  await go(fac, `/attendance/${ids.webTech}?date=2026-10-12&period=8`);
  ok("they leave the teacher's attendance sheet", !(await seen(fac, ROLL, 3000)));
  await go(office, `/students/${ids.newStudent}/edit`);
  await office.selectOption("#status", "ACTIVE");
  await office.getByRole("button", { name: "Save changes" }).click();
  await office.waitForURL(new RegExp(`/students/${ids.newStudent}$`), { timeout: 30_000 });
  await signIn(s, STUDENT_EMAIL, STUDENT_PW);
  ok("readmitted, they can sign in again", await s.waitForURL("**/dashboard", { timeout: 60_000 }).then(() => true, () => false));

  // The administrator switches off the parent's login, and back on.
  const parent = await signedIn(browser, PARENT_EMAIL, PARENT_PW);
  await go(admin, `/admin?q=${PARENT_EMAIL}`);
  await row(admin, PARENT_EMAIL).getByRole("button", { name: "Disable" }).click();
  await confirm(admin);
  await admin.waitForTimeout(1500);
  await go(parent, "/attendance");
  ok("a disabled parent's session ends", parent.url().includes("/login"));
  await signIn(parent, PARENT_EMAIL, PARENT_PW);
  ok("and the parent cannot sign in", await seen(parent, "Your account is disabled"));
  await go(admin, `/admin?q=${PARENT_EMAIL}`);
  await row(admin, PARENT_EMAIL).getByRole("button", { name: "Enable" }).click();
  await admin.waitForTimeout(1500);
  await signIn(parent, PARENT_EMAIL, PARENT_PW);
  ok("re-enabled, the parent signs in again", await parent.waitForURL("**/dashboard", { timeout: 60_000 }).then(() => true, () => false));

  for (const p of [s, fac, hod, admin, office, parent]) await p.context().close();
});

const ROLES = ["admin", "hod.cse", "faculty", "accounts", "office", "student", "parent"].map((r) => `${r}@edupilot.edu`);
/** Links that download a file or deliberately fail are not pages to open. */
const NOT_A_PAGE = /export|\.csv|\/pdf|\/file|template|download|test-error|\/logout|^\/pay\//;

test("smoke: every page on every role's menu opens without an error, and so does the first record on each list", async ({ browser }) => {
  test.setTimeout(1_800_000);
  for (const email of ROLES) {
    const p = await session(browser, email);
    for (const g of await p.locator("aside nav button[aria-expanded=false]").all()) await g.click();
    const menu = await p.locator("aside nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    const visited = new Set<string>();
    const open = async (href: string) => {
      if (visited.has(href)) return;
      visited.add(href);
      const res = await p.goto(href);
      await p.waitForLoadState("networkidle").catch(() => {});
      const status = res?.status() ?? 0;
      const broken = await p.getByRole("heading", { name: /^(Something went wrong|Not found)$/ }).first().isVisible().catch(() => false);
      ok(`${email} ${href} opens (HTTP ${status})`, status < 400 && !broken && !p.url().includes("denied=1"));
    };
    for (const href of menu) {
      await open(href);
      const detail = await p.locator(`main a[href^="${href}/"]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")!)).catch(() => []);
      const first = detail.find((h) => !NOT_A_PAGE.test(h) && !h.includes("?"));
      if (first) await open(first);
    }
    ok(`${email}: visited ${visited.size} pages`, visited.size >= menu.length);
    await p.context().close();
  }
});

test("smoke on a phone: every menu page fits a phone screen without sideways scrolling", async ({ browser }) => {
  test.setTimeout(1_200_000);
  for (const email of ["admin@edupilot.edu", "student@edupilot.edu", "parent@edupilot.edu", "faculty@edupilot.edu"]) {
    const p = await session(browser, email, { viewport: { width: 360, height: 760 } });
    await p.click('button[aria-label="Open menu"]');
    for (const g of await p.locator("aside nav button[aria-expanded=false]").all()) await g.click();
    const menu = await p.locator("aside nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const href of menu) {
      await go(p, href);
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(`${email} ${href} fits 360px (overflow ${wide}px)`, wide <= 1);
    }
    await p.context().close();
  }
});

/** Signs in with a password already set, dismissing the tour if it shows. */
async function signedIn(browser: Browser, email: string, password: string) {
  const p = await fresh(browser);
  await signIn(p, email, password);
  await p.waitForURL("**/dashboard", { timeout: 90_000 });
  const skip = p.getByRole("dialog", { name: "Guided tour" }).getByRole("button", { name: "Skip" });
  await skip.waitFor({ timeout: 5000 }).then(() => skip.click(), () => {});
  return p;
}
