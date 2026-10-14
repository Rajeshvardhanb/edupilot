// The words of the product guide. Each entry becomes one page; `shots` name files in docs/product-guide/shots.
// Roles used in `who` and in flow steps: Admin, HOD, Faculty, Accounts, Student, Parent, System.

export const SECTIONS = [
  {
    id: "start", title: "Getting started", blurb: "Signing in, finding your way around, and the tools that are on every screen.",
    pages: [
      {
        title: "Signing in", lead: "One address for the whole college. Each person signs in with their college email and sees only what their role allows.",
        shots: ["login"], who: ["Admin", "HOD", "Faculty", "Accounts", "Office", "Student", "Parent"],
        points: [
          "Seven roles: Administrator / Principal, Head of Department, Faculty, Accounts officer, Office staff, Student and Parent.",
          "New students start with their roll number as the password, and new staff with their employee ID. Both must choose a new password at first sign-in.",
          "Forgot password sends a single-use link by email, valid for 30 minutes.",
          "An account locks for 15 minutes after 5 wrong passwords.",
          "Staff can turn on two-step sign-in: after the password, a six-digit code is emailed and must be entered.",
          "The college name, logo and photo on this page come from Branding & settings.",
        ],
        steps: ["Open the college's EduPilot address", "Enter college email and password", "Change the temporary password (first time only)", "Land on your own dashboard"],
      },
      {
        title: "The layout of every screen", lead: "The same three parts everywhere: the menu on the left, search and your account at the top, and the work area in the middle.",
        shots: ["admin-dashboard"], who: ["Admin", "HOD", "Faculty", "Accounts", "Office", "Student", "Parent"],
        points: [
          "Menu: grouped by area (People, Academics, Examinations, Campus, Services, System). It shows only the items your role can use.",
          "Greeting banner: today's date, the current term and how far through the term you are, with shortcut buttons for the most common jobs.",
          "My tasks: everything waiting on you right now, each one a link to where it gets done. Urgent items are shown in red.",
          "Current term card at the bottom of the menu, so nobody works in the wrong semester.",
          "A short guided tour runs the first time each person signs in, and can be replayed from My Profile.",
        ],
        steps: ["Read My tasks", "Click a task", "Finish it on that page", "The task disappears from the list"],
      },
      {
        title: "Search and notifications", lead: "Find any student or page in two keystrokes, and never miss an approval, result or payment.",
        shots: ["search", "notifications-bell"], who: ["Admin", "HOD", "Faculty", "Accounts", "Office", "Student", "Parent"],
        points: [
          "Press Ctrl + K (or click the search box) to jump to any page or find a student by name or roll number.",
          "The bell holds a personal inbox: approvals, results published, fee updates, helpdesk replies and absences.",
          "Opening a notification marks it read and takes you straight to the page it is about.",
          "Account menu: language (English, Hindi or Telugu for the menu and common labels), text size, keyboard shortcuts, profile and sign out.",
        ],
      },
    ],
  },
  {
    id: "dash", title: "Dashboards for each role", blurb: "Every role opens on a page built for its own daily work.",
    pages: [
      {
        title: "Principal / Administrator dashboard", lead: "The health of the whole institution on one page, with every number linking to the list behind it.",
        shots: ["admin-dashboard-kpis", "admin-dashboard-departments"], who: ["Admin"],
        points: [
          "Headline tiles: active students, term attendance, fees collected and faculty strength, each with its trend.",
          "Daily attendance chart for the last 30, 60 or 90 days, and an attendance-health gauge showing how many students are eligible, condonable or at risk.",
          "Student demographics: gender, admission route and reservation category.",
          "Department cards with strength, attendance and pass rate. Click one to open its students.",
          "Filter by department, and use Customise to choose which sections appear.",
          "Charts expand to full screen and download as images for presentations.",
          "The banner and task list appear at once; the figures follow as they are worked out.",
        ],
      },
      {
        title: "Head of Department dashboard", lead: "The same picture as the principal's, limited to the HOD's own department.",
        shots: ["hod-dashboard"], who: ["HOD"],
        points: [
          "Students, attendance, fee collection and faculty numbers for the department only.",
          "Tasks: student leave to review, staff leave to approve, today's classes with attendance not marked, courses without a teacher.",
          "An HOD manages the department's students, faculty, curriculum, course allocation and results, and cannot see other departments.",
        ],
        steps: ["Review leave requests", "Check unmarked classes", "Assign substitutes", "Watch attendance and results"],
      },
      {
        title: "Faculty dashboard", lead: "Today's classes and everything a teacher owes, on one page.",
        shots: ["faculty-dashboard"], who: ["Faculty"],
        points: [
          "Shortcut buttons: Take attendance, Enter marks, My timetable, Post notice.",
          "Tiles: courses this term, students taught, average attendance, and students below 75% in the teacher's subjects.",
          "My courses and today's timetable, with one click to the attendance sheet for each class.",
          "Tasks: leave requests to review, classes not yet marked, assignments to grade, swap requests from colleagues.",
        ],
        steps: ["Open today's class", "Mark attendance", "Enter marks when due", "Grade submitted assignments"],
      },
      {
        title: "Student dashboard", lead: "Attendance, results, fees and today's classes, the moment a student signs in.",
        shots: ["student-dashboard", "student-dashboard-more"], who: ["Student"],
        points: [
          "Tiles: overall attendance with how many more classes can be missed, CGPA and credits earned, active backlogs, and fee due.",
          "SGPA trend across semesters and an attendance gauge against the 75% line.",
          "Subject-wise attendance rings and today's classes with room and time.",
          "Tasks: assignments to submit, courses waiting for feedback, overdue fees.",
        ],
      },
      {
        title: "Parent dashboard", lead: "A read-only window into the child's attendance, results, fees and timetable.",
        shots: ["parent-dashboard"], who: ["Parent"],
        points: [
          "The parent login is created from the student's record by the office.",
          "Shows the same attendance, CGPA, backlog and fee tiles the student sees.",
          "A parent with more than one child in the college switches between them from the top bar.",
          "Parents can pay fees online and download receipts, and cannot change any academic record.",
        ],
        steps: ["Office creates the parent login", "Parent signs in", "Views attendance and results", "Pays fees online"],
      },
      {
        title: "Accounts dashboard", lead: "Demand, collection and dues for the academic year.",
        shots: ["accounts-dashboard", "accounts-dashboard-charts"], who: ["Accounts", "Admin"],
        points: [
          "Tiles: total demand, collected (with week-on-week change), outstanding, and number of overdue invoices.",
          "Weekly collections for the last 12 weeks and a split by payment mode (cash, UPI, card, bank transfer, DD).",
          "Invoice status bar, recent payments, and the students with the largest overdue balances.",
          "Shortcut buttons to overdue invoices, the day book and fee structures.",
        ],
      },
      {
        title: "Office staff dashboard", lead: "The front desk's own page: enquiries, admissions, certificates and helpdesk, with no access to marks, money or settings.",
        shots: ["office-dashboard", "office-dashboard-more"], who: ["Office"],
        points: [
          "Shortcut buttons to enquiries, new admission, certificates and helpdesk.",
          "Tiles: active enquiries, students admitted this year, certificates to issue and open helpdesk tickets.",
          "Follow-ups due today or overdue, each with the applicant's phone, programme and stage.",
          "An admission funnel and the certificate requests that are waiting.",
          "Office staff manage student records, admissions, certificates, library, hostel and transport. They cannot open fees, marks, results, reports or administration.",
        ],
        steps: ["Call the follow-ups that are due", "Move enquiries forward", "Admit and create the student", "Issue certificates"],
      },
    ],
  },
  {
    id: "people", title: "People", blurb: "Students, faculty, admissions, staff and alumni.",
    pages: [
      {
        title: "Student directory", lead: "Every student in the college, searchable and filterable, with bulk actions.",
        shots: ["students"], who: ["Admin", "Office", "HOD", "Faculty"],
        points: [
          "Search by name, roll number, email or phone. Filter by programme, batch, status and admission type.",
          "Sort by any column, choose rows per page, and save a set of filters for reuse.",
          "Select several students to change status or batch together, or export only the selected rows.",
          "Status values: active, detained, suspended, dropped and graduated.",
          "Export the list to CSV for Excel at any time.",
        ],
        steps: ["Search or filter", "Open a student, or tick several", "Apply a bulk action or export"],
      },
      {
        title: "Student profile", lead: "One page with everything about a student: personal details, attendance, results, fees and placement.",
        shots: ["student-profile"], who: ["Admin", "Office", "HOD", "Faculty"],
        points: [
          "Header with semester, batch and attendance at a glance.",
          "Attendance calendar (heat-map) for the term and subject-wise percentages.",
          "Fee invoices and payments, semester results with SGPA and CGPA, and placement history.",
          "Contact details can be edited in place. Create the parent login from here.",
          "Buttons for the ID card and a printable one-page summary.",
          "Students and parents can ask for a contact detail to be corrected from their own profile; it changes only when the office approves.",
        ],
      },
      {
        title: "New admission and bulk import", lead: "Admit one student with a form, or a whole batch from a spreadsheet.",
        shots: ["student-new", "student-import"], who: ["Admin", "Office"],
        points: [
          "The admission form covers personal details, batch, admission type, previous institution and guardian contact.",
          "Lateral entry (Diploma to B.Tech second year) starts the student in semester 3 automatically.",
          "Bulk import reads a CSV exported from the admissions or counselling portal. Duplicate roll numbers and emails are skipped and reported.",
          "A login is created for every student at the same time.",
        ],
        steps: ["Fill the form or upload the CSV", "EduPilot creates the student and the login", "Student signs in with the roll number", "Student sets a new password"],
      },
      {
        title: "ID card", lead: "A printable identity card, front and back, generated from the student's record.",
        shots: ["student-id-card"], who: ["Admin", "Office", "Student"],
        points: [
          "Shows photo, name, roll number, programme, batch, blood group, guardian contact and address.",
          "Carries a QR code and the college name and logo from Branding & settings.",
          "Students see their own card under ID card; the office can open any student's card from the profile.",
          "ID cards for a whole batch print from one page.",
        ],
      },
      {
        title: "Faculty", lead: "Staff profiles with designation, qualification, department and teaching history.",
        shots: ["faculty", "faculty-profile"], who: ["Admin", "HOD"],
        points: [
          "Search by name, employee ID or specialisation; filter by department.",
          "Each profile lists every subject the teacher has taught, term by term.",
          "Adding a faculty member creates their login (employee ID as the first password).",
          "Workload per teacher is shown on the course allocation page.",
        ],
      },
      {
        title: "Admissions pipeline", lead: "Track every enquiry from the first call to a confirmed admission.",
        shots: ["admissions"], who: ["Admin", "Office"],
        points: [
          "A board with four stages: Enquiry, Applied, Documents verified, Admitted.",
          "Each card holds the applicant's phone, programme, source, notes and next follow-up date. Overdue follow-ups are shown in red.",
          "Drag a card to another column to move it, or use the button on the card.",
          "Tiles for active enquiries, follow-ups due today, admitted count and conversion rate.",
          "An admitted enquiry can be turned into a student record in one step.",
        ],
        steps: ["Record the enquiry", "Move it to Applied", "Verify documents", "Mark Admitted", "Create the student record"],
      },
      {
        title: "Staff attendance and leave", lead: "Daily attendance for staff, and leave requests with yearly balances.",
        shots: ["staff", "staff-leave"], who: ["Admin", "HOD", "Faculty"],
        points: [
          "Mark each staff member's attendance for the day; approved leave shows automatically.",
          "Leave types: casual, sick, earned and on-duty, each with a yearly balance that is checked when applying.",
          "Faculty leave is approved by the HOD; HOD and office-staff leave by the principal.",
          "The applicant is notified of the decision.",
        ],
        steps: ["Staff member applies", "HOD or principal approves", "Balance is reduced", "Attendance shows the leave"],
      },
      {
        title: "Appraisal records and class swaps", lead: "A record of each teacher's contributions, and a simple way to exchange a class with a colleague.",
        shots: ["staff-achievements", "staff-swaps"], who: ["Faculty", "HOD", "Admin"],
        points: [
          "Appraisal records: publications, conferences, FDPs and workshops, patents, funded projects and awards.",
          "These feed the accreditation data sheets.",
          "Class swap: a teacher asks a colleague to take a period. When the colleague accepts, the class appears on their attendance page for that date.",
        ],
        steps: ["Teacher requests a swap", "Colleague accepts", "Colleague takes attendance for that class"],
      },
      {
        title: "Payroll", lead: "A salary for each member of staff, a monthly run, and a payslip for everyone.",
        shots: ["payroll", "payslip"], who: ["Accounts", "Admin", "Faculty", "HOD", "Office"],
        points: [
          "Set basic pay, HRA, DA, allowances, provident-fund percentage and fixed deductions per person.",
          "Run payroll for a month in one click. It can be run again after attendance is corrected.",
          "Working days leave out Sundays and the holidays on the academic calendar.",
          "A day marked absent in staff attendance is a loss-of-pay day; a half day counts as half. Approved leave is paid.",
          "Each person sees their own payslips; it prints on the college letterhead with the net pay in words.",
          "This is a salary statement. It does not work out income tax.",
        ],
        steps: ["Set salaries once", "Mark staff attendance through the month", "Run payroll", "Staff open their payslips"],
      },
      {
        title: "Alumni", lead: "Graduated batches become alumni records automatically.",
        shots: ["alumni"], who: ["Admin"],
        points: [
          "Each record holds current employer, designation, city and higher-studies details.",
          "Tiles: total alumni, working with a known employer, in higher studies, and not yet updated.",
          "Search by name, roll number, company or city; filter by programme and graduation year.",
          "Export for alumni meets and accreditation.",
        ],
      },
      {
        title: "Parent contact log", lead: "A record of every time the college contacted a parent, so the next person knows what was already said.",
        shots: ["parent-contacts", "parent-contact-log"], who: ["Admin", "HOD", "Faculty", "Accounts", "Office"],
        points: [
          "Each entry shows how the parent was contacted (WhatsApp, email, phone or in person), what it was about, the message and who made the contact.",
          "WhatsApp reminders and bulk reminder emails are recorded automatically.",
          "Phone calls and meetings are added in a few words from the student's page.",
          "A college-wide log filters by channel and subject, with a 30-day count of families contacted.",
          "HODs and teachers see entries for their own department's students only.",
        ],
        steps: ["Press Remind parent, or add a call", "The entry is saved with your name", "Colleagues see it on the student's page"],
      },
    ],
  },
  {
    id: "academics", title: "Academic set-up", blurb: "The structure everything else depends on: departments, programmes, batches, curriculum, timetable and calendar.",
    pages: [
      {
        title: "Departments and programmes", lead: "Define the college's departments and the courses each one offers.",
        shots: ["academics-departments", "academics-programs"], who: ["Admin"],
        points: [
          "Departments with their Head of Department, faculty count and student strength.",
          "Programmes at three levels: Diploma, UG (B.Tech) and PG (M.Tech), each with duration and sanctioned intake.",
          "Appointing an HOD gives that person department-wide access.",
        ],
      },
      {
        title: "Batches, sections and terms", lead: "Group students by admission year and section, and move them forward each semester.",
        shots: ["academics-batches", "academics-terms"], who: ["Admin"],
        points: [
          "A batch is one admission year and section of a programme, for example BTCSE 2024-A.",
          "Promote moves a whole batch to the next semester. After the final semester the batch is graduated and its students become alumni.",
          "Academic terms hold the start and end dates. One term is marked current, and it drives attendance, timetable and dashboards.",
        ],
        steps: ["Create the term", "Mark it current", "Teach and examine", "Promote each batch", "Graduate final-year batches"],
      },
      {
        title: "Promoting a batch", lead: "Move a class to the next semester after reviewing who is held back.",
        shots: ["promote"], who: ["Admin"],
        points: [
          "The review lists every student with CGPA, active backlogs and attendance.",
          "Students over the college's backlog limit are already ticked to be held back. The administrator can change any tick before confirming.",
          "Held-back students are marked detained and join the batch a year below, so they repeat the year with that class.",
          "A final-semester batch graduates instead: its students become alumni, and anyone with a backlog is held back.",
          "The backlog limit is set under Administration → Rules. With no limit, everyone is promoted.",
        ],
        steps: ["Open Promote on the batch", "Review the ticked students", "Confirm", "Detained students move to the junior batch"],
      },
      {
        title: "Curriculum and course allocation", lead: "The scheme of instruction for each programme, and who teaches what this term.",
        shots: ["academics-subjects", "academics-allocation"], who: ["Admin", "HOD"],
        points: [
          "Each subject has a code, type (theory or lab), L-T-P hours, credits and the internal / external marks split.",
          "Generate creates this term's courses for a batch from its curriculum in one click.",
          "Assign a teacher to each course. A workload panel shows how many courses each teacher holds.",
          "Courses without a teacher appear as an urgent task for the HOD.",
        ],
        steps: ["Enter the curriculum once", "Generate courses for the term", "Assign teachers", "Build the timetable"],
      },
      {
        title: "Timetable", lead: "A weekly grid for each batch or each teacher, with clash checks.",
        shots: ["timetable", "timetable-edit"], who: ["Admin", "HOD", "Faculty", "Student", "Parent"],
        points: [
          "View by batch or by faculty member. Students and parents see their own batch.",
          "The editor is drag-and-drop: drag a subject onto a period.",
          "A teacher cannot be placed in two classes at the same time; the clash is blocked on save.",
          "Each subject shows periods placed against weekly hours required.",
        ],
        steps: ["Open Edit batch timetable", "Drag subjects onto the grid", "Save (clashes are refused)", "Students and teachers see it immediately"],
      },
      {
        title: "Academic calendar", lead: "Holidays, examinations and events in a month view.",
        shots: ["calendar"], who: ["Admin", "HOD", "Faculty", "Student", "Parent"],
        points: [
          "Three kinds of entry: holiday, exam and event.",
          "Holidays and Sundays block attendance marking, so no class is recorded on a closed day.",
          "A Coming up list shows the next dates for everyone.",
        ],
      },
    ],
  },
  {
    id: "teaching", title: "Daily teaching", blurb: "Attendance, leave, study material and syllabus progress.",
    pages: [
      {
        title: "Taking attendance", lead: "Period-wise attendance in a few taps, from a desk or a phone.",
        shots: ["attendance-courses", "attendance-sheet"], who: ["Faculty", "HOD"],
        points: [
          "The teacher's courses with classes held, last class taken, average attendance and students below 75%.",
          "Everyone starts as present; tap a name to mark absent. Late and On-duty are one tap each.",
          "Students below 75% are flagged on the sheet. Approved leave and on-duty are pre-filled.",
          "Record the topic covered with each class. Past classes can be reopened and corrected, with the change recorded.",
          "On a phone, swipe left for absent and right for present. A sheet marked without a connection is kept on the device and uploads when the network returns.",
        ],
        steps: ["Open the course", "Pick date and period", "Tap the absentees", "Save"],
      },
      {
        title: "Shortage report and substitute classes", lead: "See who is falling short before the exams, and cover a class when a teacher is away.",
        shots: ["attendance-report", "substitutions"], who: ["Admin", "HOD"],
        points: [
          "The 75% rule with a 65–75% condonation band (both figures can be changed under Administration → Rules): each student is shown as eligible, condonable or detained.",
          "Subject-wise percentages for every student in a batch, printable for the notice board.",
          "Email alerts to all students below the line, and a Remind parent button that opens WhatsApp with the message already written.",
          "Substitutes: the HOD assigns another teacher for a period. It is refused if that teacher already has a class then.",
        ],
        steps: ["Open the shortage report", "Send alerts", "Students apply for condonation", "Hall tickets follow the rule"],
      },
      {
        title: "Student leave and on-duty", lead: "Students apply online; staff approve; attendance is corrected automatically.",
        shots: ["student-leave", "leave"], who: ["Student", "Faculty", "HOD", "Admin"],
        points: [
          "Three request types: leave, medical leave and on-duty (representing the college).",
          "Approving on-duty converts that student's absences on those dates to On-duty, and pre-fills OD on future attendance sheets.",
          "Approved medical leave supports a condonation request when attendance is between 65% and 75%.",
          "The student is notified of the decision in the app and by email.",
        ],
        steps: ["Student applies with dates and reason", "Teacher or HOD approves", "Attendance updates", "Student is notified"],
      },
      {
        title: "Study material and assignments", lead: "Share notes with a class, set assignments, collect submissions and grade them.",
        shots: ["materials-faculty", "student-materials"], who: ["Faculty", "Student"],
        points: [
          "Share a file (up to 5 MB) or a link with the whole class.",
          "Set an assignment with a due date and maximum marks.",
          "Students submit an answer, a file or a link online.",
          "The teacher grades each submission and writes feedback; the student sees both.",
        ],
        steps: ["Teacher publishes notes or an assignment", "Students are notified", "Students submit", "Teacher grades with feedback"],
      },
      {
        title: "Syllabus coverage", lead: "A unit-wise lesson plan for each subject, ticked off as it is taught.",
        shots: ["syllabus", "syllabus-coverage"], who: ["Faculty", "HOD", "Admin"],
        points: [
          "The teacher enters the units and topics once, then ticks each topic when it is finished.",
          "HODs see coverage for every course against how much of the term has elapsed.",
          "Courses running more than 15 points behind are counted and highlighted.",
        ],
        steps: ["Enter the lesson plan", "Tick topics as taught", "HOD reviews coverage"],
      },
    ],
  },
  {
    id: "exams", title: "Examinations and results", blurb: "From internal marks to the grade card.",
    pages: [
      {
        title: "Marks entry", lead: "A spreadsheet-style grid for internal and end-semester marks.",
        shots: ["marks-courses", "marks-grid"], who: ["Faculty", "HOD"],
        points: [
          "An assessment plan per course: mid-terms, assignments, quizzes, lab internals and the end-semester exam.",
          "Type marks down the column with the keyboard, enter AB for absent, or paste a whole column from Excel.",
          "Internal marks are scaled to the subject's internal maximum automatically.",
          "A live preview shows the projected pass percentage and class average.",
          "The HOD or administrator publishes: this locks the marks and releases results to students.",
        ],
        steps: ["Add the assessments", "Enter or paste marks", "Check the preview", "HOD publishes and locks"],
      },
      {
        title: "Exam schedule, seating and invigilation", lead: "The time-table for mid-term and end-semester papers, exam halls, a generated seating plan and who supervises each hall.",
        shots: ["exam-schedule"], who: ["Admin"],
        points: [
          "Schedule mid-term and end-semester papers with date and session. Two papers for the same batch in one session are refused.",
          "Record exam halls with their capacity.",
          "Generate seating places students in roll-number order and alternates papers so neighbours write different exams.",
          "The schedule and seat numbers appear on the hall ticket.",
          "Invigilation duty: one click gives each hall a teacher, skipping anyone on approved leave and sharing duties evenly. Teachers are notified and see their own duties at the top of the page.",
        ],
        steps: ["Schedule the papers", "Add exam halls", "Generate seating", "Assign teachers to halls", "Print"],
      },
      {
        title: "Hall tickets", lead: "Issued only to students who meet the attendance and fee rules.",
        shots: ["hall-tickets", "hall-ticket"], who: ["Admin", "Student"],
        points: [
          "A student is eligible with 75% attendance, or 65–75% with approved medical leave, and no overdue fee.",
          "The list states the exact reason a ticket is withheld.",
          "The ticket shows photo, exam dates, sessions, hall and seat, with a QR code, and prints or downloads as a PDF.",
          "Students download their own ticket once eligible.",
          "All eligible tickets for a batch download as one PDF, ready to print in a single run.",
        ],
        steps: ["EduPilot checks attendance and fees", "Eligible students get a ticket", "Others see the reason", "Clearing the dues or shortage releases it"],
      },
      {
        title: "Results and grade cards", lead: "Grades, SGPA and CGPA calculated the moment marks are published.",
        shots: ["results-sheet", "student-results"], who: ["Admin", "HOD", "Student", "Parent"],
        points: [
          "Ten-point grading: O, A+, A, B+, B, C, P and F (or AB).",
          "Pass rule: at least 40% in total and at least 35% in the end-semester exam by default. Both, and the grade scale, are set under Administration → Rules.",
          "Batch result sheet with students appeared, all-clear pass percentage, average SGPA and the topper.",
          "Backlogs are tracked, and a later pass clears them.",
          "Students see every semester's results and print a grade card.",
        ],
        steps: ["Marks are published", "Grades and SGPA are computed", "Students are notified", "Grade card is printed"],
      },
      {
        title: "Revaluation and grace marks", lead: "Correct a published result properly, with a record of who changed what.",
        shots: ["revaluation"], who: ["Student", "HOD", "Admin"],
        points: [
          "A student asks for an end-semester paper to be re-checked, with a reason. One request per subject.",
          "The HOD or administrator enters the re-checked marks. The published result, grade, SGPA, CGPA and backlogs follow automatically.",
          "Marks can go up or down. If nothing changed, the request is closed as “no change”. The student is notified either way.",
          "Grace marks (moderation): for a published course, students who failed within a set number of marks get just enough to pass.",
          "Grace given is kept on each result, and every change is in the audit log.",
        ],
        steps: ["Student requests a re-check", "Examiner enters the re-checked marks", "Result updates", "Student is notified"],
      },
      {
        title: "Supplementary exams and electives", lead: "Backlog registration with an automatic fee, and seat-limited elective choice.",
        shots: ["supplementary", "electives"], who: ["Student", "Admin"],
        points: [
          "A student with backlogs registers for the supplementary exam and picks the subjects.",
          "A fee invoice is raised automatically for the registration.",
          "Electives: the office opens electives with a seat limit; each student chooses one per semester until seats run out.",
        ],
        steps: ["Student registers for backlog subjects", "Invoice is raised", "Student pays", "Marks entered as usual"],
      },
      {
        title: "Outcome attainment (CO-PO)", lead: "Course outcomes mapped to assessments, for NBA and NAAC files.",
        shots: ["outcomes", "outcome-attainment"], who: ["Faculty", "HOD", "Admin"],
        points: [
          "Define course outcomes (CO1, CO2 …) for a subject and map each to programme outcomes with a strength of 1 to 3.",
          "Map assessments to the outcomes they test.",
          "Attainment levels are calculated from marks against a target (for example 60% of marks by 70%, 60% or 50% of students).",
          "A programme-outcome chart summarises the result, and the page prints cleanly.",
        ],
      },
      {
        title: "Course feedback", lead: "Anonymous ratings from students on every course.",
        shots: ["student-feedback", "feedback"], who: ["Student", "Faculty", "HOD", "Admin"],
        points: [
          "Five questions rated from one to five, with an optional comment.",
          "Responses are anonymous. Staff see only averages.",
          "Results for a course appear only after at least five students have responded.",
        ],
        steps: ["Student rates each course", "Responses are pooled", "Averages appear after five responses"],
      },
    ],
  },
  {
    id: "fees", title: "Fees and finance", blurb: "Structures, invoices, collection, receipts, online payment and scholarships.",
    pages: [
      {
        title: "Fee structures and invoices", lead: "Set the fee once per programme and year, then raise invoices for a whole batch.",
        shots: ["fee-structures", "fees"], who: ["Accounts", "Admin"],
        points: [
          "A structure lists the heads (tuition, development, examination, library and lab, and so on) for one programme and year.",
          "Generate raises an invoice for every student in a batch. Students who already have one are skipped.",
          "The invoice list shows payable, paid, balance, due date and status: paid, partial, pending or overdue.",
          "Filter by programme and status; email reminders to everyone overdue in one click.",
        ],
        steps: ["Create the fee structure", "Generate invoices for a batch", "Students see the invoice", "Collect and track"],
      },
      {
        title: "Invoice, instalments and late fines", lead: "Everything about one student's fee on a single page.",
        shots: ["fee-invoice"], who: ["Accounts", "Admin"],
        points: [
          "Fee heads, concession or scholarship, amount payable, paid and balance.",
          "Split an invoice into instalments, each with its own due date.",
          "A per-day late fine with an upper cap can be applied to overdue invoices, and waived by the administrator.",
          "Record a payment at the counter by cash, UPI, card, bank transfer or demand draft.",
          "Refund a receipt from the same page, and open the student's fee statement.",
        ],
        steps: ["Open the invoice", "Record the payment and mode", "Receipt is created", "Student and parent are notified"],
      },
      {
        title: "Day book and receipts", lead: "Every payment in order, and a receipt for each one.",
        shots: ["fee-ledger", "fee-receipt"], who: ["Accounts", "Admin"],
        points: [
          "The payment ledger filters by date range and mode, with totals for each mode.",
          "Receipts are numbered in sequence and carry the amount in words.",
          "Each receipt prints on the college letterhead and downloads as a PDF.",
          "The receipt is emailed to the student when a mail server is connected.",
        ],
      },
      {
        title: "Online fee payment", lead: "Students and parents pay from their own login.",
        shots: ["student-fees", "student-pay"], who: ["Student", "Parent"],
        points: [
          "My fees shows each invoice, the instalment plan, payments made and the balance.",
          "Pay now opens the checkout for the amount due.",
          "A built-in test checkout lets the college try the whole flow without a payment account.",
          "With Razorpay keys entered, real payments go through Razorpay. This path follows Razorpay's documented flow and should be tried with the college's own account before going live.",
          "The receipt is created only after the payment is verified.",
        ],
        steps: ["Student opens My fees", "Clicks Pay now", "Pays at the checkout", "Payment is verified", "Receipt appears and is emailed"],
      },
      {
        title: "Scholarships and reimbursements", lead: "Track government and college scheme claims until the money arrives.",
        shots: ["scholarships"], who: ["Accounts", "Admin"],
        points: [
          "Record a claim against a student with scheme, amount, academic year and application number.",
          "Stages: applied, sanctioned, received or rejected.",
          "Marking a claim received credits the student's invoice automatically.",
          "Tiles show the totals claimed, sanctioned and received.",
        ],
        steps: ["Record the claim", "Mark it sanctioned", "Mark it received", "Invoice balance is reduced"],
      },
      {
        title: "Refunds and day closing", lead: "Pay money back against a receipt, and check the cash drawer against the books every evening.",
        shots: ["fee-refund", "fee-closing"], who: ["Accounts", "Admin"],
        points: [
          "Refund all or part of any receipt, with a reason. The refund gets its own voucher number and reduces the amount paid on the invoice.",
          "A receipt can never be refunded for more than was paid on it.",
          "Day closing totals the day's receipts and refunds by payment mode and by cashier.",
          "Enter the cash counted in the drawer. A difference from the books must be explained in a note before the day can be closed.",
          "Each closing is kept, shown as tallied, short or excess, and prints as a report.",
        ],
        steps: ["Open Day closing", "Check the totals by mode", "Count the cash and enter it", "Explain any difference", "Close the day"],
      },
      {
        title: "Fee statement and no-dues certificate", lead: "One document with a student's complete fee position.",
        shots: ["fee-statement"], who: ["Accounts", "Admin", "Student", "Parent"],
        points: [
          "Lists every invoice with amount payable, paid and balance.",
          "When nothing is outstanding it reads as a no-dues certificate, ready for the accounts officer's seal and signature.",
          "When a balance remains it is a statement of dues, with the amount in words.",
          "Students and parents open their own from My fees; the office opens anyone's from the student or invoice page.",
          "Prints on the college letterhead.",
        ],
        steps: ["Open the student's fee statement", "Print", "Sign and seal"],
      },
    ],
  },
  {
    id: "campus", title: "Campus and student services", blurb: "Placements, library, hostel, transport, certificates, helpdesk and notices.",
    pages: [
      {
        title: "Placement drives", lead: "Publish a drive and let EduPilot work out who is eligible.",
        shots: ["placements", "placement-drive"], who: ["Admin", "Student"],
        points: [
          "A drive has the company, role, package, date and eligibility: programme level, minimum CGPA and maximum backlogs.",
          "Eligibility is checked automatically for every pre-final and final-year student.",
          "Interview rounds per drive; move applicants through shortlisted, selected or rejected.",
          "A selected student receives a notification and a placement confirmation letter.",
          "Tiles show students placed, offers, highest and average package.",
        ],
        steps: ["Publish the drive", "Eligible students apply", "Shortlist through the rounds", "Mark selected", "Offer letter is issued"],
      },
      {
        title: "Placements for students", lead: "Students see only the drives they qualify for, and why they don't for the others.",
        shots: ["student-placements"], who: ["Student"],
        points: [
          "Each drive shows package, date, criteria and the student's own application status.",
          "Apply is offered only when the student meets the criteria; otherwise the reason is shown.",
          "A résumé profile is kept alongside the academic record.",
        ],
      },
      {
        title: "Library", lead: "Catalogue, issue and return, with overdue fines.",
        shots: ["library"], who: ["Admin", "Office", "Student", "Faculty"],
        points: [
          "Catalogue with title, author, ISBN, category and number of copies.",
          "Issue a book to a member; loans run for 14 days.",
          "Overdue loans are flagged and a per-day fine is calculated on return.",
          "Students and staff search the catalogue and see the books they hold.",
        ],
        steps: ["Add books to the catalogue", "Issue to a member", "Return (fine if late)"],
      },
      {
        title: "Hostel", lead: "Hostels, rooms, beds and who is in each one.",
        shots: ["hostel"], who: ["Admin", "Office"],
        points: [
          "Separate boys' and girls' hostels; a student can only be allotted to the matching one.",
          "Each room shows its beds and occupants, with vacant beds visible at a glance.",
          "Tiles for hostels, total beds, occupied and vacant.",
        ],
        steps: ["Create the hostel and rooms", "Allot a student to a room", "Vacate at the end of the year"],
      },
      {
        title: "Transport", lead: "Bus routes, stops with pickup times, and passes.",
        shots: ["transport"], who: ["Admin", "Office"],
        points: [
          "Each route has its bus number, driver, yearly fee and an ordered list of stops with times.",
          "Issue a bus pass to a student for a route and boarding stop.",
          "The number of riders is shown per route and per stop.",
        ],
        steps: ["Add the route and stops", "Issue passes", "See riders per stop"],
      },
      {
        title: "Inventory", lead: "Lab equipment and other assets: what there is, where it is, and who has it.",
        shots: ["inventory"], who: ["Admin", "HOD", "Office"],
        points: [
          "Each asset has a tag, category, room or lab, quantity, cost, purchase date and condition.",
          "Issue a quantity to a person, class or lab with a due date; mark it returned when it comes back.",
          "Items past their due date are flagged as overdue, and more than is available cannot be issued.",
          "Tiles show total items, value at cost, how many are out and how many need repair.",
          "HODs see and manage their own department's assets.",
        ],
        steps: ["Add the asset with its tag", "Issue it with a due date", "Mark it returned"],
      },
      {
        title: "Gate and visitors", lead: "Who is on campus as a visitor, and which students are out.",
        shots: ["gate"], who: ["Office", "Admin", "Student"],
        points: [
          "Visitors are signed in with name, phone, purpose and who they are meeting, and signed out when they leave.",
          "A student asks for a gate pass with a reason and the times of leaving and returning.",
          "The office approves or rejects it, marks the student out at the gate, and marks them back on return.",
          "Students who are past the time they gave are shown as late, with their hostel room.",
        ],
        steps: ["Student requests a gate pass", "Office approves", "Marked out at the gate", "Marked returned"],
      },
      {
        title: "Certificates", lead: "Bonafide, study, conduct and transfer certificates without a visit to the office.",
        shots: ["student-certificates", "certificate"], who: ["Student", "Admin", "Office"],
        points: [
          "The student chooses the certificate and states the purpose.",
          "The office approves or rejects the request.",
          "An approved certificate gets a serial number and is printed on the college letterhead with the principal's name, or downloaded as a PDF.",
          "For a scholarship round, the office issues the same certificate to every student of a batch in one step, each with its own serial number, and prints them together.",
        ],
        steps: ["Student requests", "Office approves", "Serial number is issued", "Student prints or downloads"],
      },
      {
        title: "Helpdesk", lead: "Grievances and support requests, tracked to resolution.",
        shots: ["helpdesk", "helpdesk-ticket"], who: ["Student", "Parent", "Faculty", "Admin", "Office"],
        points: [
          "Tickets have a category, a subject and a description.",
          "Replies form a thread, so the whole conversation stays in one place.",
          "Status moves from open to in progress to resolved, and the person who raised it is notified of each reply.",
        ],
        steps: ["Raise a ticket", "Office replies", "Status is updated", "Ticket is resolved"],
      },
      {
        title: "Notices and the notification centre", lead: "Circulars for everyone, and a personal inbox for each person.",
        shots: ["notices", "notifications"], who: ["Admin", "HOD", "Faculty", "Student", "Parent"],
        points: [
          "Post a notice to everyone, to students only or to staff only. Important notices can be pinned to the top.",
          "A notice can also be sent by email.",
          "The notification centre lists everything addressed to one person, newest first, with Mark all as read.",
        ],
      },
    ],
  },
  {
    id: "admin", title: "Reports and administration", blurb: "Getting data out, and keeping the system in order.",
    pages: [
      {
        title: "Report builder", lead: "Pick a report, choose the columns, download.",
        shots: ["reports"], who: ["Admin", "HOD", "Accounts"],
        points: [
          "Seven reports: students, faculty, fee dues, collections, results, placements and alumni.",
          "Filter by programme and batch, and tick only the columns you need.",
          "Download for Excel (CSV) or as a PDF, or print.",
          "HODs get the same reports limited to their department.",
        ],
        steps: ["Choose the report", "Set filters and columns", "Run", "Download as CSV or PDF"],
      },
      {
        title: "Accreditation data and scheduled reports", lead: "Figures for AICTE, NAAC and NBA files, and summaries that arrive by email.",
        shots: ["accreditation", "report-schedules"], who: ["Admin", "HOD"],
        points: [
          "Student strength by sanctioned intake, faculty cadre and ratios, results, placements and faculty contributions, calculated from live records.",
          "These are data sheets to copy from. They are not the agencies' official templates.",
          "Scheduled reports send a weekly or monthly summary of attendance, fee collection or pending approvals by email.",
        ],
      },
      {
        title: "College setup", lead: "A guided checklist for bringing a new college onto the system, with spreadsheet import for the bulk steps.",
        shots: ["admin-setup"], who: ["Admin"],
        points: [
          "Nine steps in order: college details, departments, programmes, academic term, batches, curriculum, faculty, fee structures and students.",
          "Each step shows whether it is done and how many records exist.",
          "Six steps accept a spreadsheet saved as CSV. A template with the exact columns and example rows can be downloaded for each.",
          "Rows that already exist are updated, so a corrected file can be uploaded again. Rows with a problem are skipped and listed with the reason.",
          "Importing faculty or students creates their logins at the same time.",
        ],
        steps: ["Download the template", "Fill it in Excel", "Save as CSV and upload", "Fix any skipped rows", "Move to the next step"],
      },
      {
        title: "Academic rules", lead: "Set your university's regulations yourself. Nothing here needs a programmer.",
        shots: ["admin-rules"], who: ["Admin"],
        points: [
          "Attendance: the required percentage and how far below it condonation is allowed.",
          "Passing a subject: the minimum total, and the minimum in the end-semester exam.",
          "The grade scale: each grade's letter, the marks it starts at and its grade points.",
          "Attendance changes apply everywhere at once: dashboards, the shortage report, reminders and hall-ticket eligibility.",
          "Pass marks and grades apply to results published from then on. Results already published keep their grades.",
          "Promotion: the backlog limit above which a student is held back. Placements: which years may apply.",
          "A scale that could not work (for example, a pass mark with no grade to give) is refused with an explanation.",
        ],
      },
      {
        title: "Users and access", lead: "Who can sign in, and what they can do.",
        shots: ["admin-users"], who: ["Admin"],
        points: [
          "Every account with its role, last sign-in and status.",
          "Add administrator, accounts and office-staff users; students and faculty get their logins from their own records.",
          "See who has two-step sign-in on, and switch it off for someone who has lost access to their mailbox.",
          "Disable an account to lock that person out immediately.",
          "Reset a password to a temporary one that must be changed at next sign-in.",
        ],
      },
      {
        title: "Branding and settings", lead: "Make it your college's system.",
        shots: ["admin-settings"], who: ["Admin"],
        points: [
          "College name, short name, tagline, approval line, address, phone, email and principal's name.",
          "Upload the logo and choose the brand colour used across the app.",
          "A live preview shows the header that appears on receipts, hall tickets, certificates and grade cards.",
          "Fee rules: late fine per day and its cap.",
        ],
      },
      {
        title: "System health", lead: "Is the system being looked after? Backups, errors, email and storage on one page.",
        shots: ["admin-health"], who: ["Admin"],
        points: [
          "The date and size of the latest database backup, with a warning when there is none from the last two days.",
          "Server errors, each listed once with how many times it has happened. Administrators are emailed when a new one appears.",
          "Database size, whether email is connected, and when the daily housekeeping last ran.",
          "A year-end archive: every record as one downloadable file.",
        ],
      },
      {
        title: "Email outbox and audit log", lead: "A record of every message sent and every change made.",
        shots: ["admin-email", "admin-audit"], who: ["Admin"],
        points: [
          "Emails cover password resets, fee receipts, results, leave decisions, certificates, placement selection and reminders.",
          "Every email is listed in the outbox with its status. Until a mail server is connected, messages are stored here and not delivered.",
          "The audit log records every create, update, delete, publish and sign-in, with who did it and when.",
        ],
      },
      {
        title: "My profile", lead: "Each person's own account page.",
        shots: ["profile"], who: ["Admin", "HOD", "Faculty", "Accounts", "Office", "Student", "Parent"],
        points: [
          "Upload a profile photo, used on the ID card and hall ticket.",
          "Change password. Passwords need at least 8 characters with letters and numbers.",
          "Changing a password signs out every other device using that account.",
          "Staff can turn on two-step sign-in here. It is switched on only after a test code reaches their mailbox.",
          "Notification preferences: choose which kinds of alert are also sent by email.",
          "Replay the guided tour at any time.",
        ],
      },
    ],
  },
];

export const PHONE = {
  title: "On a phone", lead: "EduPilot runs in the phone's browser. Nothing to install from an app store.",
  shots: [["m-student-dashboard", "Student dashboard"], ["m-student-attendance", "Attendance calendar"], ["m-student-fees", "Fees and Pay now"], ["m-attendance-sheet", "Teacher's attendance sheet"], ["m-menu", "Full menu"]],
  points: [
    "A tab bar at the bottom gives students, parents and teachers their five most-used pages.",
    "Teachers swipe left or right to mark attendance, and can mark without a connection.",
    "It can be added to the home screen and opened like an app.",
    "Tables become a list of cards on a phone, with the column heading beside each value.",
  ],
};

export const FLOWS = [
  {
    title: "Admission to first day", lead: "How a prospective student becomes an enrolled one.",
    steps: [["Office", "Record the enquiry", "Admissions pipeline"], ["Office", "Follow up and move to Applied", "Follow-up dates and reminders"], ["Office", "Verify documents", "Stage: Documents verified"], ["Office", "Mark Admitted and create the student", "Roll number, batch, admission type"], ["System", "Create the login and the parent login", "Roll number as first password"], ["Accounts", "Generate the fee invoice", "From the fee structure"], ["Student", "Sign in, set a password, pay the fee", "Online or at the counter"], ["System", "Issue receipt and ID card", "PDF and printable card"]],
  },
  {
    title: "A teaching day", lead: "What happens between the first bell and the last.",
    steps: [["Faculty", "Open today's class from the dashboard", "My courses · Today"], ["Faculty", "Mark attendance and the topic covered", "Tap absentees, save"], ["System", "Update each student's percentage", "Dashboards and shortage report"], ["Student", "Apply for leave or on-duty if needed", "Leave & OD"], ["HOD", "Approve leave; assign a substitute", "Attendance corrected automatically"], ["Faculty", "Share notes or set an assignment", "Study material"], ["Student", "Submit the assignment", "Online"], ["Faculty", "Grade, and tick the syllabus topic", "Coverage visible to the HOD"]],
  },
  {
    title: "The examination cycle", lead: "From internal assessments to the grade card.",
    steps: [["Faculty", "Enter internal marks", "Mid-terms, assignments, lab"], ["Admin", "Schedule end-semester papers", "Clash checks"], ["Admin", "Add halls and generate seating", "Alternating papers"], ["System", "Decide hall-ticket eligibility", "75% attendance, no overdue fee"], ["Student", "Download the hall ticket", "With seat numbers and QR code"], ["Faculty", "Enter end-semester marks", "Keyboard or paste from Excel"], ["HOD", "Publish and lock results", "Students are notified"], ["Student", "View grades, SGPA, CGPA; print the grade card", "Backlogs tracked"], ["Student", "Register for supplementary if needed", "Invoice raised automatically"]],
  },
  {
    title: "The fee cycle", lead: "From demand to receipt.",
    steps: [["Accounts", "Create the fee structure", "Per programme and year"], ["Accounts", "Generate invoices for the batch", "One click"], ["Student", "See the invoice under My fees", "With instalments"], ["Student", "Pay online, or at the counter", "UPI, card, cash, bank, DD"], ["System", "Verify, then create the receipt", "Sequential number, amount in words"], ["System", "Notify student and parent", "In-app and email"], ["Accounts", "Chase overdue invoices", "Email reminders, late fine"], ["Accounts", "Credit scholarships when received", "Balance reduced automatically"], ["Accounts", "Close the day", "Cash counted against the books"]],
  },
  {
    title: "A placement drive", lead: "From announcement to offer letter.",
    steps: [["Admin", "Publish the drive with criteria", "CGPA, backlogs, programme"], ["System", "Work out who is eligible", "Pre-final and final year"], ["Student", "Apply", "Only if eligible"], ["Admin", "Run the interview rounds", "Shortlist at each round"], ["Admin", "Mark the selected students", "Status: Selected"], ["System", "Notify and issue the confirmation letter", "Printable"], ["Admin", "Review placement statistics", "Placed, offers, packages"]],
  },
  {
    title: "A certificate request", lead: "No queue at the office window.",
    steps: [["Student", "Request a certificate and state the purpose", "Bonafide, study, conduct, transfer"], ["Office", "Approve or reject", "From My tasks"], ["System", "Assign the serial number", "On the college letterhead"], ["Student", "Print or download the PDF", "Notified when ready"]],
  },
  {
    title: "End of semester", lead: "Closing one term and opening the next.",
    steps: [["HOD", "Confirm all results are published", "Marks locked"], ["Admin", "Create the next term and mark it current", "Academic terms"], ["Admin", "Promote each batch", "Next semester"], ["Admin", "Graduate final-year batches", "Students become alumni"], ["Admin", "Generate the new term's courses", "From the curriculum"], ["HOD", "Assign teachers and build the timetable", "Clash checks"], ["Accounts", "Generate the new year's invoices", "From fee structures"]],
  },
];

export const ROLES = [
  ["Admin", "Administrator / Principal", "Everything: set-up, people, academics, exams, fees, placements, reports and settings."],
  ["HOD", "Head of Department", "Own department: students, faculty, curriculum, course allocation, timetable, approvals and results."],
  ["Faculty", "Faculty", "Own courses: attendance, marks, study material, syllabus coverage, timetable, leave and class swaps."],
  ["Accounts", "Accounts officer", "Fee structures, invoices, collection, refunds, receipts, day book and closing, scholarships and financial reports."],
  ["Office", "Office staff", "Front desk: enquiries and admissions, student records, certificates, ID cards, helpdesk, library, hostel and transport. No marks, money or settings."],
  ["Student", "Student", "Own attendance, timetable, results, fees and online payment, placements, leave, certificates, helpdesk and ID card."],
  ["Parent", "Parent", "Read-only view of their child's attendance, results, fees and timetable, with online fee payment."],
];

export const CLOSING = {
  security: [
    "Every page and every action checks the person's role on the server, so hidden menu items cannot be reached by typing an address.",
    "HODs are limited to their department, teachers to their courses, students and parents to one student's record.",
    "Passwords are stored encrypted (hashed). Accounts lock after repeated wrong passwords.",
    "Two-step sign-in for staff: an emailed one-time code after the password.",
    "A disabled account is locked out immediately, and changing a password signs out other devices.",
    "Every change is written to the audit log with the person and the time.",
    "The database is backed up automatically every night, the newest 14 are kept, and a second copy can go to another disk. Server errors are logged and emailed to the administrator.",
  ],
  golive: [
    ["A server or cloud machine", "EduPilot and its MySQL database run in Docker and restart by themselves after a reboot."],
    ["A web address with HTTPS", "For example erp.yourcollege.edu."],
    ["A mail account (optional)", "Any SMTP account, including a free Gmail account with an app password. Without it, emails are stored in the outbox and not delivered."],
    ["A Razorpay account (optional)", "For real online payments. Without it, fees are collected at the counter and the test checkout is used for demonstrations."],
    ["Your data", "The College setup checklist imports departments, programmes, batches, curriculum, faculty, fee structures and students from spreadsheets."],
    ["Your regulations", "Attendance thresholds, pass marks and the grade scale start from common practice and are changed by the administrator on the Rules page."],
  ],
  notIncluded: [
    "SMS and automatic WhatsApp messages (paid services). WhatsApp reminders open the staff member's own WhatsApp with the message written.",
    "A separate app-store mobile app. The system runs in the phone's browser and can be added to the home screen.",
    "Official accreditation templates. The accreditation pages provide the figures to copy into them.",
  ],
};
