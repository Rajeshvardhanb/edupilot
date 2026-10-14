# EduPilot — College Management System

A complete student & academic management system for **Engineering (B.Tech / M.Tech) and Diploma (Polytechnic) colleges**, built with **Next.js 16 (App Router) + React 19 + MySQL 8** (Prisma ORM).

## Quick start

Requirements: Node 20+, Docker (for MySQL).

```bash
cp .env.example .env        # then set AUTH_SECRET (openssl rand -base64 32)
npm install
npm run setup               # starts MySQL on :3307, applies migrations, seeds demo data
npm run dev                 # http://localhost:3000
```

Using an existing MySQL server instead? Point `DATABASE_URL` at it and run `npm run db:deploy && npm run db:seed`.

### Demo accounts (password `password123`)

| Role | Email | Sees |
|---|---|---|
| Administrator / Principal | `admin@edupilot.edu` | Everything |
| HOD (CSE) | `hod.cse@edupilot.edu` | Own department: students, faculty, curriculum, allocation, results |
| Faculty | `faculty@edupilot.edu` | Own courses: attendance, marks, timetable |
| Accounts officer | `accounts@edupilot.edu` | Fees, collections, receipts |
| Student | `student@edupilot.edu` | Own attendance, results, fees, timetable, placements |
| Parent | `parent@edupilot.edu` | Read-only view of their child's attendance, results, fees and timetable |
| Office staff | `office@edupilot.edu` | Front desk: admissions, student records, certificates, helpdesk, library, hostel, transport. No marks, money or settings |

The seed creates 5 departments, 8 programmes (4 B.Tech, 3 Diploma, 1 M.Tech), 15 batches with ~375 students (including lateral entries), 32 faculty, 5 semesters of history with published results, a live current term with timetable and ~90k attendance records, fee invoices and payments, notices and placement drives.

## Modules

| Module | Highlights |
|---|---|
| **Dashboards** | Role-specific: institution KPIs and charts (admin/HOD), today's classes and shortage alerts (faculty), attendance, CGPA, backlogs and dues (student), collections (accounts) |
| **Students** | Search and filters, admission form, **lateral entry** (Diploma → B.Tech 2nd year, starts from semester 3), 360° profile, CSV bulk import, CSV export, status (active / detained / suspended / dropped / graduated) |
| **Faculty** | Profiles, designations, department, teaching history, workload |
| **Academics** | Departments and HOD appointment, programmes (Diploma / UG / PG), batches and sections with **semester promotion and graduation**, academic terms, curriculum with **L-T-P hours, credits, CIE/SEE split**, course allocation and auto-generation of offerings |
| **Timetable** | Weekly grid per batch or per faculty, editor with **faculty-clash detection** and weekly-hours check |
| **Attendance** | Period-wise marking (Present / Absent / Late / On-duty), mobile-friendly one-tap sheet, edit history, **75% rule with 65–75% condonation band**, "classes you can miss / must attend" for students, printable shortage report |
| **Examinations** | Assessment plans (mid-terms, assignments, quizzes, lab internals, end-semester), spreadsheet-style marks grid (AB for absent, keyboard navigation), live result preview, **publish/lock** workflow |
| **Results** | 10-point grading (O, A+, A, B+, B, C, P, F/AB), pass rule ≥40% total and ≥35% in SEE, **SGPA / CGPA**, backlog tracking (a later pass clears it), batch result sheets with toppers, printable grade card |
| **Fees** | Fee structures per programme and year, bulk invoice generation, concessions and scholarships, collection (cash / UPI / card / bank / DD), sequential receipts with amount in words, day-book ledger, overdue tracking |
| **Placements** | Drives with **automatic eligibility** (programme level, CGPA, active backlogs, pre-final / final year), student applications, shortlist / select workflow, placement statistics |
| **Notices** | Audience-targeted circulars (everyone / students / staff), pinning |
| **Administration** | User management, enable / disable, password reset, **audit log** of every write and login |

### Added modules

| Area | What it does |
|---|---|
| **Academic calendar** | Holidays, exams and events in a month view. Holidays and Sundays block attendance marking. |
| **Leave & on-duty** | Students apply; staff approve. Approving on-duty converts that student's absences on those dates and pre-fills OD on the attendance sheet. |
| **Study material & assignments** | Faculty share notes (file up to 5 MB or link) and set assignments; students submit online; faculty grade with feedback. |
| **Syllabus coverage** | Unit-wise lesson plan per subject; faculty tick topics as taught; HODs see coverage against how much of the term has elapsed. |
| **Substitute classes** | HOD assigns another teacher for a period (blocked if they already have a class); the substitute can take that attendance. |
| **Exam schedule & seating** | End-semester time-table with clash checks, exam halls, and a generated seating plan that alternates papers in roll-number order. |
| **Hall tickets** | Issued only with 75% attendance (or 65–75% with approved medical leave) and no overdue fee; printable with QR code and seat numbers. |
| **Supplementary registration** | Students register for backlog subjects; a fee invoice is raised automatically. |
| **Electives** | Seat-limited elective choice, one per semester. |
| **Outcome attainment (CO-PO)** | Course outcomes, assessment mapping, attainment levels and programme-outcome chart for NBA / NAAC. |
| **Course feedback** | Anonymous five-question ratings; results appear only after five responses. |
| **Parent login** | Created from the student record; read-only access to that child. |
| **Certificates** | Bonafide, study, conduct and transfer certificates: request → approve → serial-numbered printable certificate. |
| **ID card** | Front and back with photo and QR code. |
| **Helpdesk** | Tickets with categories, threaded replies and status. |
| **Admissions pipeline** | Enquiry → Applied → Documents → Admitted board with follow-up dates and a conversion funnel. |
| **Scholarships** | Scheme claims; marking a claim received credits the student's invoice. |
| **Instalments & late fines** | Split an invoice into instalments; per-day late fine with a cap, waivable by the admin. |
| **Library** | Catalogue search, issue and return, 14-day loans, overdue fines. |
| **Hostel** | Hostels, rooms, bed occupancy, allotment (boys / girls hostels enforced). |
| **Transport** | Routes, stops with pickup times, bus passes. |
| **Placement extras** | Student résumé profile, interview rounds per drive, placement confirmation letter, programme-wise report. |
| **Branding & settings** | College name, logo, address, principal, brand colour and fee rules: used on the login page, sidebar, receipts, hall tickets, certificates and grade cards. |

### Working faster

Bulk actions on the student list (status, batch, export selected), sortable columns, rows per page, saved filters, a quick-view side panel, toasts with **Undo** on deletes, an in-app confirm dialog, unsaved-changes warnings, **paste from Excel** into the marks grid, a **drag-and-drop timetable editor**, an attendance heat-map, clickable charts, dashboard department / date filters, a customisable dashboard, breadcrumbs and page-shaped loading skeletons.

### Phone and access

Bottom tab bar on phones, swipe to mark attendance, an installable app (PWA) and **offline attendance**: a sheet marked without a connection is kept on the device and uploads when the network returns. The service worker is registered in production builds only. Interface language: English, Hindi or Telugu for the menu and common labels (page content and data stay as entered). A guided tour runs on first login and can be replayed from My Profile.

### Communication, payments, staff and reports

| Area | What it does |
|---|---|
| **Notification centre** | A personal inbox behind the bell: approvals, results, fee updates, replies, absences. Opening one marks it read and goes to the page. |
| **Email alerts** | Password resets, fee receipts, results, leave decisions, certificates, placement selection, substitute classes; bulk attendance-shortage and overdue-fee reminders. Every message is kept in **Administration → Email outbox**. |
| **WhatsApp (free)** | “Remind parent” buttons open WhatsApp with the message already written, sent from the staff member's own number. Nothing is sent automatically. |
| **Online fee payment** | “Pay now” on the student / parent fee page. A built-in **test checkout** works with no account; Razorpay is used when keys are configured. The receipt is created only after the payment is verified. |
| **Staff attendance & leave** | Daily staff attendance; casual / sick / earned leave with yearly balances; faculty approved by the HOD, others by the principal. |
| **Appraisal records** | Publications, conferences, FDPs, patents, funded projects and awards per faculty member. |
| **Class swaps** | A teacher asks a colleague to take a period; accepting makes them the substitute for that class. |
| **Alumni** | Graduated batches become alumni with employer, designation, city and higher-studies details. |
| **Report builder** | Seven reports (students, faculty, fee dues, collections, results, placements, alumni): pick columns and filters, download for Excel (CSV) or as a PDF. |
| **Accreditation data** | Student strength, faculty cadre and ratios, results, placements and faculty contributions, computed live. These are data sheets to copy from, not the agencies' official templates. |
| **Scheduled reports** | Weekly or monthly summaries by email (attendance, fee collection, pending approvals). The server checks hourly. |
| **PDF downloads** | Receipts, hall tickets, certificates and reports as real PDF files with the college letterhead. |

### Running a college day to day

| Area | What it does |
|---|---|
| **College setup** | Administration → College setup: a nine-step checklist with CSV import (and downloadable templates) for departments, programmes, batches, curriculum, faculty and fee structures. Existing rows are updated, bad rows are skipped and listed. |
| **Academic rules** | Administration → Rules: required attendance and the condonation floor, pass marks (total and end-semester) and the grade scale. Attendance changes apply everywhere at once; pass marks and grades apply to results published afterwards. |
| **Office staff role** | A front-office login with its own dashboard. It can run admissions, student records, certificates, helpdesk, library, hostel and transport, and is refused fees, marks, results, reports and administration. |
| **Refunds** | Refund all or part of a receipt with a reason. Stored as a negative payment linked to the receipt, with its own `RFND-` voucher, so balances and the day book stay correct. |
| **Day closing** | Fees → Day closing: the day's receipts and refunds by mode and cashier, cash counted against the books, a note required for any difference, and a printable report. |
| **Fee statement / no-dues** | One printable page per student: a no-dues certificate when nothing is outstanding, otherwise a statement of dues. |
| **Parent contact log** | Every WhatsApp reminder and bulk reminder email is recorded against the student; calls and meetings are added from the student page. Students → Parent contact log lists them all. |

### Added in the operations round

| Area | What it does |
|---|---|
| **Promotion with detention** | Academics → Batches → Promote opens a review: every student with CGPA, backlogs and attendance. Students over the backlog limit (Administration → Rules) are pre-ticked to be held back; they are marked detained and join the batch a year below. |
| **Mid-term exams and invigilation** | The exam schedule holds mid-term 1, mid-term 2 and end-semester papers. “Assign teachers to halls” gives each hall one teacher, skipping those on approved leave and sharing duties evenly. |
| **Revaluation and grace marks** | Students ask for a re-check of an end-semester paper; the HOD or administrator records the re-checked marks and the published result (grade, SGPA, CGPA, backlogs) follows. Grace marks give failed students within a limit just enough to pass, and are recorded on the result. |
| **Payroll** | Staff → Payroll: a salary per person, a monthly run (working days exclude Sundays and calendar holidays; absences without leave are loss of pay), and printable payslips. It does not work out income tax. |
| **Inventory** | Lab equipment and assets with tag, location, quantity and condition; issue and return with due dates. HODs see their own department. |
| **Gate and visitors** | Visitor sign-in and sign-out; student gate passes: request → approve → out → returned, with late returns flagged. |
| **Batch documents** | All eligible hall tickets for a batch as one PDF; all ID cards for a batch on one page; a bonafide or study certificate issued to every student of a batch with its own serial number. |
| **Profile corrections** | Students and parents ask for a contact detail to be corrected; nothing changes until the office approves. |
| **Notification preferences** | My Profile: choose which kinds of alert are also emailed. In-app alerts always arrive; password and sign-in emails are always sent. |
| **System health** | Administration → System health: last backup, server errors (repeats counted, emailed to administrators when mail is set up), database size, a year-end archive download. |

### Sign-in security

- An account locks for 15 minutes after 5 wrong passwords; a network is blocked after 30 failures in 15 minutes.
- New accounts and admin resets get a temporary password that **must be changed at first sign-in**.
- **Forgot password** emails a single-use link valid for 30 minutes, and gives the same answer whether or not the email is registered.
- Passwords need 8+ characters with letters and numbers; common ones are refused.
- Changing or resetting a password signs out every other session for that account.
- **Two-step sign-in** (staff, optional, from My Profile): after the password, a six-digit code is emailed and must be entered within 10 minutes. It is switched on only after a test code has been entered, so an account cannot be locked out by a mailbox that does not work; the administrator can switch it off for someone. It needs a mail server in production (in development the code is shown on screen).

### Setting up email and payments

Both are optional and configured in `.env` (see `.env.example`):

- **Email:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `APP_URL`. A free Gmail account with an App password works. Without these, emails are stored in the outbox and not delivered; in development the password-reset link is shown on screen so the flow can be tried.
- **Payments:** set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (free test keys start with `rzp_test_`). Without them the test checkout is used. The Razorpay path follows their documented order + signature flow but has not been exercised against a live Razorpay account from this repository.

**Experience:** a “My tasks” panel on every dashboard, edit-in-place for contact details, keyboard shortcuts (press `?`), a text-size option, a skip link and visible focus outlines, charts that expand and download as images, a child switcher for parents with several children, a light, premium interface (light mode only), a Ctrl + K command palette (jump to any page or find a student), a notifications bell, profile photos (stored in MySQL, served only to signed-in users), role-specific dashboards with infographics (gauges, donuts, sparklines, funnels, distributions), illustrated empty states, a responsive mobile layout and print styles for reports and receipts.

## Architecture

```
prisma/
  schema.prisma        MySQL data model (users, academic structure, teaching, exams, fees, placements, audit)
  seed.ts              Deterministic demo college
src/
  proxy.ts             Optimistic auth redirect (Next 16 "proxy", formerly middleware)
  lib/
    auth.ts            Data Access Layer: verifies JWT cookie, loads user, role guards (requireUser)
    session.ts         JWT sign/verify (jose, HS256, httpOnly cookie)
    scope.ts           Row-level scoping: HOD → own department, faculty → own courses, student → self
    grading.ts         Grade scale, result computation, SGPA/CGPA/backlogs (pure, unit-testable)
    attendance.ts / results.ts / fees.ts / placements.ts   domain helpers
  actions/             Server Actions (zod-validated, role-checked, audited)
  app/(app)/…          Authenticated pages (Server Components)
  app/login            Sign-in
  components/          UI kit, forms (useActionState), charts (Recharts), timetable grid
```

**Security model:** every Server Action and page calls `requireUser(roles)` and applies `scope.ts` filters, so access control never depends on hidden UI. Sessions are re-validated against the database on every request, so a disabled user is locked out immediately. Passwords are hashed with bcrypt, and every write is recorded in the audit log.

**Rules:** attendance thresholds, pass marks and the grade scale are changed by the administrator under Administration → Rules (defaults live in `src/lib/grading.ts`). The placement eligibility window is still in code (`src/lib/placements.ts`). Relative grading is not supported.

## Tests

```bash
npm test             # unit tests: grading, college rules, payroll, grace marks, fee status, eligibility, password rules (under a second)
npm run test:e2e     # browser tests of the real flows for every role (about 5 minutes)
```

The browser tests start their own copy of the app on port 3100 against a separate database (`edupilot_test`, created automatically on the same MySQL server), so they never touch your data. The first run needs `npx playwright install chromium --only-shell` once.

## Running in production

`npm run dev` is for development: it stops when the terminal closes or the machine restarts. For everyday use, run the production build in Docker:

```bash
npm run prod:up      # builds the image and starts it at http://localhost:8080
npm run prod:logs    # recent output
npm run prod:down    # stop it
```

Both the app and the database then restart by themselves after a crash or a reboot (as long as Docker starts with the machine). Database migrations are applied on every start. Change the address with `PROD_PORT` and `PROD_URL` in `.env`; set `PROD_URL` to an `https://` address when the site is served over HTTPS so sign-in cookies are marked secure. After changing code, run `npm run prod:up` again to rebuild.

## Backups, restore and housekeeping

```bash
npm run db:backup                                   # writes backups/<database>-<date>.sql.gz and keeps the newest 14
npm run db:restore -- backups/<file>.sql.gz --yes   # REPLACES the database with that backup
```

In production (`npm run prod:up`) a **backup service runs by itself every 24 hours**: it writes `./backups`, keeps the newest 14, and puts a second copy in `BACKUP_MIRROR_DIR` when that is set in `.env`. Point it at another disk, a NAS share or a cloud-synced folder, so a failed machine does not take the backups with it. When the app runs without Docker, `AUTO_BACKUP=1` makes it run the same backup once a day (needs `mysqldump` installed). Administration → System health shows the latest backup and warns when there is none from the last two days.

To move to another server: copy the newest backup file across, point `DATABASE_URL` at the new database, run `npm run db:deploy`, then `npm run db:restore`.

While the app is running it also does this by itself once a day: brings late fines up to date (when a per-day rate is set), and deletes sign-in attempt records older than 30 days and used or expired password-reset links.

## Speed

Dashboards show their banner and task list first and stream the figures in. Fee totals, overdue counts and attendance percentages are worked out by the database rather than by loading every row, and college settings and the current term are kept in memory for 15 seconds (cleared at once when they are saved from the app). Photos are served as WebP by the image optimiser.

```bash
npm run build && npx next start -p 3200      # a production server to test against
npm run test:load -- http://localhost:3200 200 30   # 200 students for 30 seconds
```

## Troubleshooting

If a style change doesn't show up in `npm run dev`, stop the server and delete `.next/dev`. Turbopack's persistent cache can hold stale CSS.

## Scripts

| Script | Purpose |
|---|---|
| `npm run setup` | MySQL up + migrate + seed |
| `npm test` / `npm run test:e2e` | Unit tests / browser tests |
| `npm run prod:up` / `prod:down` / `prod:logs` | Production build in Docker |
| `npm run db:backup` / `db:restore` | Compressed database backup / restore from one |
| `npm run test:load` | Simulated students against a running production server |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:migrate` | Create a migration after editing `schema.prisma` |
| `npm run db:seed` | Reset the database to demo data (destructive) |
| `npm run typecheck` / `lint` | Static checks |

New students get their **roll number (lowercase)** as their initial password, and new faculty get their **employee ID (lowercase)**. Users can change it under *My Profile*.
