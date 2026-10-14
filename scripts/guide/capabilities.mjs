// Builds docs/EduPilot-Features-and-Capabilities.pdf: a short overview of what the product does,
// for readers who want the capabilities rather than a screen-by-screen walk-through
// (that is docs/EduPilot-Product-Guide.pdf, built by build.mjs).
// Usage: node scripts/guide/capabilities.mjs      (screenshots come from docs/product-guide/shots)
import { chromium } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(".");
const HTML = `${ROOT}/docs/product-guide/capabilities.html`;
const PDF = `${ROOT}/docs/EduPilot-Features-and-Capabilities.pdf`;
const DATE = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const data = (file, type) => `data:${type};base64,${readFileSync(file).toString("base64")}`;
const LOGO = data(`${ROOT}/public/brand/mark.png`, "image/png");
const COVER = data(`${ROOT}/public/images/hero-admin.jpg`, "image/jpeg");
const shot = (name) => { if (!existsSync(`${ROOT}/docs/product-guide/shots/${name}.jpg`)) throw new Error(`Missing screenshot ${name}`); return `shots/${name}.jpg`; };

// ── The menu, read from the app itself, so the access table can never drift from the product ──
const ROLES = ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE", "STUDENT", "PARENT"];
const ROLE_NAME = { ADMIN: "Principal / Admin", HOD: "HOD", FACULTY: "Faculty", ACCOUNTANT: "Accounts", OFFICE: "Office", STUDENT: "Student", PARENT: "Parent" };
const navSrc = readFileSync(`${ROOT}/src/components/nav.ts`, "utf8");
const NAV = [...navSrc.matchAll(/\{ group: "([^"]+)", href: "[^"]+", label: "([^"]+)", icon: \w+, roles: (.+?), hint: "([^"]+)" \}/g)].map(([, group, label, roles, hint]) => {
  const list = roles === "ALL" ? ROLES : roles === "STAFF" ? ["ADMIN", "HOD", "FACULTY"] : [...(roles.includes("...STAFF") ? ["ADMIN", "HOD", "FACULTY"] : []), ...[...roles.matchAll(/"([A-Z]+)"/g)].map((m) => m[1])];
  return { group, label, hint, roles: new Set(list) };
});
if (NAV.length < 30) throw new Error("Could not read the menu from src/components/nav.ts");
const screens = Number(process.env.SCREENS ?? 96);

// ── Content ──
const AREAS = [
  { title: "Academic set-up", line: "The structure everything else depends on.", items: [
    "Departments, programmes (Diploma, B.Tech, M.Tech), batches and sections",
    "Curriculum with L-T-P hours, credits and the internal / external marks split",
    "Course allocation with teacher workload; this term's courses generated from the curriculum",
    "Drag-and-drop timetable that refuses teacher clashes",
    "Academic calendar; holidays and Sundays block attendance",
    "Semester promotion with a review of who is held back; graduation creates alumni",
  ] },
  { title: "Daily teaching", line: "What teachers and students do every day.", items: [
    "Period-wise attendance in a few taps: present, absent, late, on-duty",
    "Works on a phone, by swipe, and without a connection",
    "Attendance rule with a condonation band, set by the college",
    "Shortage report with email alerts and WhatsApp reminders to parents",
    "Student leave and on-duty requests that correct attendance when approved",
    "Study material, online assignments, grading with feedback",
    "Lesson plans with syllabus coverage visible to the HOD",
    "Substitute teachers and class swaps between colleagues",
  ] },
  { title: "Examinations and results", line: "From internal marks to the grade card.", items: [
    "Assessment plans; spreadsheet-style marks grid with paste from Excel",
    "Mid-term and end-semester schedule with clash checks",
    "Exam halls, generated seating, invigilation duty shared evenly",
    "Hall tickets only when attendance and fees are in order; whole batch as one PDF",
    "Grades, SGPA, CGPA and backlogs computed on publishing",
    "The college's own pass marks and grade scale",
    "Revaluation requests and grace marks, both recorded",
    "Supplementary registration with automatic fee; seat-limited electives",
    "Outcome attainment (CO-PO) for NBA / NAAC; anonymous course feedback",
  ] },
  { title: "Fees and finance", line: "Every rupee accounted for.", items: [
    "Fee structures per programme and year; invoices for a whole batch in one click",
    "Instalment plans, per-day late fines with a cap, concessions",
    "Counter collection by cash, UPI, card, bank transfer or DD",
    "Online payment by students and parents (Razorpay, with a built-in test checkout)",
    "Numbered receipts with the amount in words, on the college letterhead",
    "Refunds against a receipt, with their own voucher",
    "Day book and end-of-day cash closing against the books",
    "Scholarship claims that credit the invoice when received",
    "Fee statement that becomes a no-dues certificate when nothing is owed",
  ] },
  { title: "Admissions and student records", line: "From first enquiry to alumni.", items: [
    "Admissions board: enquiry, applied, documents verified, admitted; follow-up dates",
    "Admission form and bulk import from a spreadsheet; lateral entry handled",
    "One profile per student: attendance, results, fees, placements",
    "ID cards with photo and QR code, one at a time or a whole batch",
    "Parent logins with a read-only view of their child",
    "Parent contact log: every reminder, call and meeting",
    "Contact corrections requested by students, approved by the office",
    "Alumni records created on graduation",
  ] },
  { title: "Student services", line: "Requests handled without a queue at the office.", items: [
    "Bonafide, study, conduct and transfer certificates with serial numbers",
    "One certificate issued to a whole batch for a scholarship round",
    "Helpdesk tickets with threaded replies",
    "Notices to everyone, students or staff; a personal notification inbox",
    "Gate passes: request, approve, out, returned, with late returns flagged",
    "Placement drives with automatic eligibility, rounds and offer letters",
  ] },
  { title: "Campus operations", line: "The facilities around the classroom.", items: [
    "Library catalogue, issue and return, overdue fines",
    "Hostels, rooms, beds and allotment",
    "Transport routes, stops with times, bus passes",
    "Inventory of lab equipment and assets, with issue and return",
    "Visitor sign-in and sign-out",
  ] },
  { title: "Staff and payroll", line: "The people who run the college.", items: [
    "Faculty profiles with teaching history",
    "Daily staff attendance; leave with yearly balances and approval",
    "Payroll: salaries, a monthly run from attendance, printable payslips",
    "Appraisal records: publications, FDPs, patents, projects, awards",
    "A front-office role with no access to marks, money or settings",
  ] },
  { title: "Reports and accreditation", line: "Getting information out.", items: [
    "Role-specific dashboards with charts that expand and download",
    "Report builder: seven reports, chosen columns, Excel (CSV) or PDF",
    "Accreditation data sheets for AICTE, NAAC and NBA files",
    "Weekly or monthly summaries by email",
    "Year-end archive of every record",
  ] },
  { title: "Administration", line: "Keeping the system in order.", items: [
    "Guided college setup with spreadsheet import and templates",
    "Branding: name, logo, colour, letterhead on every document",
    "Rules page: attendance, pass marks, grade scale, promotion, placements",
    "Users, roles, disabling accounts, password resets",
    "Audit log of every change and sign-in",
    "System health: backups, server errors, email, storage",
  ] },
];

const PLATFORM = [
  ["Security", ["Every page and action checks the person's role on the server", "HODs limited to their department, teachers to their courses, students and parents to one record", "Passwords stored hashed; lockout after five wrong attempts", "Optional two-step sign-in for staff, by emailed code", "Changing a password signs out other devices"]],
  ["Speed", ["Dashboards show the banner and tasks first; figures follow", "Totals and percentages are worked out by the database", "Tested with 200 students at once: 3,023 page loads, none failed", "About 95 page loads a second on a laptop; a server will do more"]],
  ["Reliability", ["Automatic nightly backup, newest 14 kept, optional second copy elsewhere", "One-command restore, also used to move servers", "Server errors logged, counted and emailed to the administrator", "The app and database restart by themselves after a reboot"]],
  ["On a phone", ["Runs in the phone's browser; can be added to the home screen", "Bottom tab bar for students, parents and teachers", "Tables become cards with the heading beside each value", "Attendance can be marked without a connection"]],
  ["Languages and access", ["Menu, page titles and common labels in English, Hindi and Telugu", "Adjustable text size; keyboard shortcuts; visible focus outlines", "Screens scanned for accessibility problems in all seven roles", "Translations should be reviewed by a native speaker before launch"]],
  ["Documents and data", ["Receipts, hall tickets, certificates, payslips and reports as PDF or print", "Every list page prints cleanly with the college name and date", "Spreadsheet import for setup and students; CSV export from lists and reports", "Saved filters on list pages; search across students and pages"]],
];

const NEEDS = [
  ["A server or cloud machine", "The app and its MySQL database run in Docker."],
  ["A web address with HTTPS", "For example erp.yourcollege.edu."],
  ["A mail account (optional)", "Any SMTP account. Without it, emails are stored and not delivered, and two-step sign-in cannot be switched on."],
  ["A Razorpay account (optional)", "For real online payments. This path follows Razorpay's documented flow and should be tried with the college's own account before going live."],
  ["The college's data", "Imported from spreadsheets through the setup checklist."],
];
const NOT_INCLUDED = [
  "SMS and automatic WhatsApp messages. WhatsApp reminders open the staff member's own WhatsApp with the message written.",
  "An app-store mobile app. It runs in the phone's browser.",
  "Official accreditation templates. The accreditation pages give the figures to copy into them.",
  "Income tax in payroll. Payslips are a salary statement.",
  "Relative grading. Grades follow a fixed scale the college sets.",
];

// ── Pages ──
let n = 0;
const page = (inner, { cls = "", bare = false, label = "" } = {}) => { n++; return `<section class="page ${cls}">${inner}${bare ? "" : `<footer><span><img src="${LOGO}" alt=""> EduPilot · Features and capabilities</span><span>${esc(label)}</span><span>${n}</span></footer>`}</section>`; };
const head = (eyebrow, title, lead) => `<header><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${lead ? `<p class="lead">${esc(lead)}</p>` : ""}</header>`;
const areaBlock = (a, i) => `<div class="area"><p class="num">${String(i + 1).padStart(2, "0")}</p><div><h3>${esc(a.title)}</h3><p class="line">${esc(a.line)}</p><ul>${a.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>`;
const areaPage = (from, to, image, caption) => page(`${head("What it does", from === 0 ? "Features, area by area" : "Features, continued")}
  ${AREAS.slice(from, to).map((a, k) => areaBlock(a, from + k)).join("")}
  ${image ? `<figure class="shotfig"><img src="${shot(image)}" alt=""><figcaption>${esc(caption)}</figcaption></figure>` : ""}`, { label: "Features" });

const groups = [...new Set(NAV.map((x) => x.group))];
const pages = [
  page(`<div class="cover-bg" style="background-image:url(${COVER})"></div><div class="cover-veil"></div>
    <div class="cover-inner">
      <div class="brand"><span class="logo"><img src="${LOGO}" alt=""></span><span>EduPilot</span></div>
      <div><p class="eyebrow light">Features and capabilities</p><h1>College management,<br>start to finish</h1><p class="cover-lead">What the system does, who can do what, and what it takes to run it. For Engineering and Diploma colleges.</p></div>
      <p class="cover-foot">${DATE}</p>
    </div>`, { cls: "cover", bare: true }),

  page(`${head("Overview", "EduPilot at a glance", "One web application for the academic, administrative and financial work of an Engineering or Diploma college, used by everyone from the principal to the parent.")}
    <div class="stats">
      <div><b>${ROLES.length}</b><span>roles, each with its own dashboard and menu</span></div>
      <div><b>${NAV.length}</b><span>modules on the menu</span></div>
      <div><b>${screens}</b><span>screens</span></div>
      <div><b>3</b><span>languages: English, Hindi, Telugu</span></div>
      <div><b>92</b><span>automated tests passing (70 rule checks, 22 full user journeys)</span></div>
      <div><b>200</b><span>students at once in the load test, with no failed page</span></div>
    </div>
    <figure class="shotfig tall"><img src="${shot("admin-dashboard")}" alt=""><figcaption>The principal's dashboard: tasks waiting, then the institution's figures.</figcaption></figure>
    <div class="two">
      <div><p class="label">Built for</p><ul class="plain"><li>B.Tech, M.Tech and Diploma (Polytechnic) programmes</li><li>Semesters, lateral entry, internal and end-semester marks</li><li>Attendance condonation, backlogs, supplementary exams</li><li>AICTE, NAAC and NBA reporting needs</li></ul></div>
      <div><p class="label">The idea</p><ul class="plain"><li>Each person sees only what their role allows</li><li>Every dashboard starts with what is waiting on you</li><li>The college sets its own rules without a programmer</li><li>Anything printed carries the college's letterhead</li></ul></div>
    </div>`, { label: "Overview" }),

  page(`${head("Overview", "Everything on the menu", `${NAV.length} modules in ${groups.length} groups. Each person's menu shows only the ones their role can use.`)}
    <div class="map">${groups.map((g) => `<div><h3>${esc(g)}</h3><ul>${NAV.filter((x) => x.group === g).map((x) => `<li><b>${esc(x.label)}</b><span>${esc(x.hint)}</span></li>`).join("")}</ul></div>`).join("")}</div>`, { label: "Overview" }),

  areaPage(0, 2, "attendance-sheet", "Taking attendance: everyone starts present; tap the absentees."),
  areaPage(2, 4, "fee-closing", "Day closing: the day's receipts by mode, against the cash counted."),
  areaPage(4, 7, "admissions", "The admissions board: drag a card to the next stage."),
  areaPage(7, 10, "admin-setup", "College setup: a checklist with spreadsheet import for each bulk step."),

  page(`${head("Access", "Who can use what", "A dot means the module is on that role's menu. Inside a module, access narrows further: an HOD to one department, a teacher to their own courses, a student or parent to one record.")}
    <table class="matrix">
      <thead><tr><th>Module</th>${ROLES.map((r) => `<th><span>${ROLE_NAME[r]}</span></th>`).join("")}</tr></thead>
      <tbody>${groups.map((g) => `<tr class="grp"><td colspan="${ROLES.length + 1}">${esc(g)}</td></tr>` + NAV.filter((x) => x.group === g).map((x) => `<tr><td>${esc(x.label)}</td>${ROLES.map((r) => `<td>${x.roles.has(r) ? "<i></i>" : ""}</td>`).join("")}</tr>`).join("")).join("")}</tbody>
    </table>
    <p class="fine">Parents see their child's records read-only and can pay fees. Office staff are refused fees, marks, results, reports and administration even if they type the address.</p>`, { label: "Access" }),

  page(`${head("Platform", "How it is built to be trusted", "Beyond features: how the system protects data, stays fast, and keeps running.")}
    <div class="cards">${PLATFORM.map(([t, items]) => `<div><h3>${esc(t)}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
    <div class="phones">${[["m-student-dashboard", "Student dashboard"], ["m-attendance-sheet", "Teacher's attendance"], ["m-student-fees", "Fees and Pay now"], ["m-menu", "Full menu"]].map(([s, c]) => `<figure><div class="phone"><img src="${shot(s)}" alt=""></div><figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>`, { label: "Platform" }),

  page(`${head("Adoption", "Going live, and what is not included", "What the college provides, how the product was checked, and where its edges are.")}
    <div class="two top">
      <div><p class="label">What is needed to go live</p><dl>${NEEDS.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl></div>
      <div><p class="label">Not included</p><ul class="plain tight">${NOT_INCLUDED.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    </div>
    <p class="label" style="margin-top:9mm">How it was checked</p>
    <div class="checks">
      <div><b>70</b><span>checks of the rules: grading, pass marks, fee status, payroll, eligibility, passwords</span></div>
      <div><b>22</b><span>full journeys run in a real browser, across every role, on every change</span></div>
      <div><b>7 roles</b><span>every screen opened as each role on desktop, and at phone size for four of them, looking for errors and layout breaks</span></div>
      <div><b>376</b><span>invoices used to confirm the faster fee calculation agrees with the original rules exactly</span></div>
    </div>
    <div class="note"><b>Honest limits of that testing.</b> It was done on a demonstration college of 424 students, 35 staff, 5 departments and 8 programmes, on a laptop. Email delivery and Razorpay payments have not been run against real accounts. The Hindi and Telugu text has not been reviewed by a native speaker. A pilot with one department's real data is the right next step.</div>
    <p class="fine" style="margin-top:8mm">A screen-by-screen walk-through of every feature and workflow is in the companion document, <b>EduPilot Product Guide</b>.</p>`, { label: "Adoption" }),
];

const css = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap");
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --ink: #0c1222; --muted: #505b74; --line: #e3e7f0; --soft: #f4f6fb; --b1: #1668f5; --b2: #4a28e6; }
body { font-family: Inter, system-ui, sans-serif; color: var(--ink); font-size: 9.2pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3 { font-family: "Plus Jakarta Sans", Inter, sans-serif; letter-spacing: -0.02em; }
.page { position: relative; width: 210mm; height: 297mm; padding: 16mm 16mm 18mm; overflow: hidden; break-after: page; background: #fff; }
.page > header { margin-bottom: 7mm; }
.eyebrow { font-size: 7.4pt; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--b1); margin-bottom: 1.6mm; }
.eyebrow.light { color: rgb(255 255 255 / 0.78); }
h2 { font-size: 22pt; font-weight: 800; line-height: 1.12; }
.lead { margin-top: 2mm; font-size: 10.4pt; color: var(--muted); }
.label { font-size: 7.2pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 2.4mm; }
footer { position: absolute; left: 16mm; right: 16mm; bottom: 8mm; display: flex; justify-content: space-between; align-items: center; font-size: 7.2pt; color: #7a849b; border-top: 0.25mm solid var(--line); padding-top: 2.2mm; }
footer img { height: 3.6mm; vertical-align: -0.8mm; margin-right: 1mm; } footer span:last-child { font-weight: 600; color: var(--ink); }
ul { list-style: none; }

.cover { color: #fff; padding: 0; }
.cover-bg { position: absolute; inset: 0; background-size: cover; background-position: 70% center; }
.cover-veil { position: absolute; inset: 0; background: linear-gradient(170deg, var(--b1) 0%, color-mix(in srgb, var(--b2) 94%, transparent) 46%, color-mix(in srgb, var(--b2) 55%, transparent) 78%, color-mix(in srgb, var(--b2) 25%, transparent) 100%); }
.cover-inner { position: relative; height: 100%; padding: 24mm 20mm; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 3.5mm; font-family: "Plus Jakarta Sans"; font-weight: 800; font-size: 17pt; }
.logo { display: grid; place-items: center; width: 13mm; height: 13mm; background: #fff; border-radius: 3.4mm; } .logo img { width: 10mm; }
.cover h1 { font-size: 40pt; font-weight: 800; line-height: 1.05; margin: 2mm 0 6mm; }
.cover-lead { font-size: 12.5pt; max-width: 135mm; color: rgb(255 255 255 / 0.92); }
.cover-foot { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(255 255 255 / 0.8); }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
.stats div { border: 0.25mm solid var(--line); border-radius: 3.2mm; padding: 4.4mm; background: linear-gradient(160deg, #fff 55%, #eef2ff); }
.stats b, .checks b { display: block; font-family: "Plus Jakarta Sans"; font-size: 24pt; font-weight: 800; line-height: 1; background: linear-gradient(135deg, var(--b1), var(--b2)); -webkit-background-clip: text; color: transparent; }
.stats span { display: block; margin-top: 1.6mm; color: var(--muted); font-size: 8.4pt; }
.shotfig { margin-top: 6mm; } .shotfig img { display: block; width: 100%; height: 62mm; object-fit: cover; object-position: top; border-radius: 3mm; border: 0.25mm solid var(--line); box-shadow: 0 1.5mm 5mm -1.5mm rgb(16 24 64 / 0.22); }
.shotfig.tall img { height: 92mm; }
.shotfig figcaption, .phones figcaption { margin-top: 1.8mm; font-size: 8pt; color: var(--muted); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 9mm; margin-top: 7mm; } .two.top { margin-top: 0; }
.plain li { position: relative; padding-left: 4.6mm; margin-bottom: 1.9mm; } .plain.tight li { margin-bottom: 2.6mm; }
.plain li::before, .area li::before, .cards li::before { content: ""; position: absolute; left: 0.4mm; top: 1.75mm; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: linear-gradient(135deg, var(--b1), var(--b2)); }

.map { columns: 2; column-gap: 8mm; }
.map > div { break-inside: avoid; margin-bottom: 4mm; background: var(--soft); border-radius: 3.2mm; padding: 3.4mm 4.2mm; }
.map h3 { font-size: 10.5pt; margin-bottom: 2mm; color: var(--b2); }
.map li { display: flex; gap: 2.4mm; padding: 0.8mm 0; border-top: 0.2mm solid #e6e9f2; font-size: 8.2pt; line-height: 1.35; } .map li:first-child { border-top: 0; }
.map li b { flex: none; width: 31mm; font-weight: 600; } .map li span { color: var(--muted); }

.area { display: grid; grid-template-columns: 11mm 1fr; gap: 2mm; padding: 4.6mm 0; border-top: 0.25mm solid var(--line); }
.area:first-of-type { border-top: 0; padding-top: 0; }
.area .num { font-family: "Plus Jakarta Sans"; font-weight: 800; font-size: 15pt; line-height: 1.1; background: linear-gradient(135deg, var(--b1), var(--b2)); -webkit-background-clip: text; color: transparent; }
.area h3 { font-size: 13pt; } .area .line { color: var(--muted); margin: 0.6mm 0 2.6mm; }
.area ul { columns: 2; column-gap: 8mm; } .area li { position: relative; break-inside: avoid; padding-left: 4.6mm; margin-bottom: 1.6mm; font-size: 8.9pt; }

.matrix { width: 100%; border-collapse: collapse; font-size: 7.7pt; line-height: 1.25; }
.matrix th { font-family: "Plus Jakarta Sans"; font-size: 7.4pt; font-weight: 700; padding: 1.6mm 1mm 2mm; border-bottom: 0.4mm solid var(--ink); text-align: center; vertical-align: bottom; }
.matrix th:first-child { text-align: left; width: 44mm; }
.matrix td { padding: 0.5mm 1mm; border-bottom: 0.2mm solid var(--line); text-align: center; }
.matrix td:first-child { text-align: left; font-weight: 500; }
.matrix .grp td { background: var(--soft); font-family: "Plus Jakarta Sans"; font-size: 7.2pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--b2); padding: 0.8mm 1.6mm; text-align: left; }
.matrix i { display: inline-block; width: 2mm; height: 2mm; border-radius: 50%; background: linear-gradient(135deg, var(--b1), var(--b2)); vertical-align: middle; }
.fine { margin-top: 4mm; font-size: 8.2pt; color: var(--muted); }

.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 3.6mm; }
.cards > div { border: 0.25mm solid var(--line); border-radius: 3.2mm; padding: 3.6mm 4.4mm; border-top: 1mm solid var(--b1); }
.cards h3 { font-size: 11pt; margin-bottom: 1.8mm; } .cards li { position: relative; padding-left: 4.6mm; margin-bottom: 1.2mm; font-size: 8.5pt; }
.phones { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10mm; margin: 6mm 14mm 0; text-align: center; }
.phone { border: 1.4mm solid #10162b; border-radius: 5mm; overflow: hidden; box-shadow: 0 3mm 8mm -3mm rgb(16 24 64 / 0.4); height: 50mm; } .phone img { display: block; width: 100%; }

dl dt { font-weight: 600; margin-top: 2.8mm; } dl dt:first-child { margin-top: 0; } dl dd { color: var(--muted); font-size: 8.7pt; }
.checks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
.checks div { background: var(--soft); border-radius: 3.2mm; padding: 4.2mm; } .checks b { font-size: 19pt; } .checks span { display: block; margin-top: 1.8mm; font-size: 8.2pt; color: var(--muted); }
.note { margin-top: 7mm; padding: 4mm 5mm; border-left: 1mm solid var(--b1); background: var(--soft); border-radius: 0 2.4mm 2.4mm 0; color: var(--muted); } .note b { color: var(--ink); }
`;

writeFileSync(HTML, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>EduPilot — Features and capabilities</title><style>${css}</style></head><body>${pages.join("")}</body></html>`);
const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(`file://${HTML}`, { waitUntil: "networkidle" });
await tab.evaluate(() => document.fonts.ready);
// Report any page whose content runs past the bottom margin, so nothing is silently cut off.
const over = await tab.evaluate(() => [...document.querySelectorAll(".page:not(.cover)")].map((p, i) => {
  const limit = p.querySelector("footer").getBoundingClientRect().top - p.getBoundingClientRect().top;
  const bottom = Math.max(...[...p.children].filter((c) => c.tagName !== "FOOTER").map((c) => c.getBoundingClientRect().bottom - p.getBoundingClientRect().top));
  return [i + 2, Math.round(bottom - limit), p.querySelector("h2")?.textContent];
}).filter((x) => x[1] > -4));
await tab.pdf({ path: PDF, width: "210mm", height: "297mm", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`pages: ${pages.length}  →  ${PDF}`);
if (over.length) console.log("PAGES TOO FULL (px past the footer):", JSON.stringify(over));
