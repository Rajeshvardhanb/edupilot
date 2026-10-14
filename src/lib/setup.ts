/** Spreadsheet templates for setting up a new college. Shared by the setup page (shows them) and the import action (checks against them). */
export const SETUP_KINDS = {
  departments: {
    label: "Departments", columns: ["code", "name"], required: ["code", "name"],
    sample: [["CSE", "Computer Science & Engineering"], ["ME", "Mechanical Engineering"]],
    help: "One row per department. The code is a short form such as CSE.",
  },
  programs: {
    label: "Programmes", columns: ["code", "name", "level", "durationYears", "intake", "department"], required: ["code", "name", "level", "durationYears", "department"],
    sample: [["BTCSE", "B.Tech — Computer Science & Engineering", "UG", "4", "120", "CSE"], ["DME", "Diploma — Mechanical Engineering", "DIPLOMA", "3", "60", "ME"]],
    help: "level is DIPLOMA, UG or PG. department is the department code.",
  },
  batches: {
    label: "Batches", columns: ["program", "admissionYear", "section", "currentSemester"], required: ["program", "admissionYear"],
    sample: [["BTCSE", "2026", "A", "1"], ["BTCSE", "2025", "A", "3"]],
    help: "program is the programme code. section defaults to A and currentSemester to 1.",
  },
  subjects: {
    label: "Curriculum", columns: ["code", "name", "program", "semester", "credits", "type", "lectureHrs", "tutorialHrs", "practicalHrs", "internalMax", "externalMax"], required: ["code", "name", "program", "semester", "credits"],
    sample: [["BTCSE101", "Engineering Mathematics – I", "BTCSE", "1", "4", "THEORY", "3", "1", "0", "40", "60"], ["BTCSE106", "Physics Lab", "BTCSE", "1", "1.5", "LAB", "0", "0", "3", "50", "50"]],
    help: "type is THEORY, LAB, PROJECT, ELECTIVE or AUDIT. Hours default to 3-0-0 and marks to 40 internal + 60 external.",
  },
  faculty: {
    label: "Faculty", columns: ["employeeId", "name", "email", "phone", "department", "designation", "qualification", "specialization", "joiningDate"], required: ["employeeId", "name", "email", "department", "designation"],
    sample: [["EMP001", "Dr. Vivaan Patel", "vivaan@college.edu", "9800000001", "CSE", "Professor", "Ph.D", "Compilers", "2014-06-15"]],
    help: "Each teacher gets a login; the first password is the employee ID in lowercase and must be changed at first sign-in. joiningDate is YYYY-MM-DD.",
  },
  fees: {
    label: "Fee structures", columns: ["program", "yearOfStudy", "academicYear", "head", "amount"], required: ["program", "yearOfStudy", "academicYear", "head", "amount"],
    sample: [["BTCSE", "1", "2026-27", "Tuition Fee", "85000"], ["BTCSE", "1", "2026-27", "Examination Fee", "3500"], ["BTCSE", "2", "2026-27", "Tuition Fee", "85000"]],
    help: "One row per fee head. Rows with the same programme, year of study and academic year become one fee structure.",
  },
} as const;

export type SetupKind = keyof typeof SETUP_KINDS;

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** The template as CSV text: header plus example rows. */
export const setupTemplate = (kind: SetupKind) => [SETUP_KINDS[kind].columns, ...SETUP_KINDS[kind].sample].map((r) => r.map(cell).join(",")).join("\n") + "\n";
