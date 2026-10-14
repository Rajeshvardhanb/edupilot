import { Prisma, PrismaClient, type AssessmentType, type ProgramLevel, type SubjectType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { computeResult } from "../src/lib/grading";
import { addDemoExtras } from "./demo-extras";

const db = new PrismaClient();

// Deterministic PRNG so every seed produces the same college.
let s = 20261009;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const FIRST_M = ["Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Rohan", "Karthik", "Rahul", "Vikram", "Harsha", "Nikhil", "Pranav", "Manoj", "Suresh", "Ravi", "Teja", "Krishna", "Abhishek", "Siddharth", "Varun"];
const FIRST_F = ["Ananya", "Diya", "Priya", "Sneha", "Kavya", "Lakshmi", "Divya", "Meera", "Pooja", "Swathi", "Harika", "Bhavana", "Nandini", "Sahithi", "Keerthi", "Aishwarya", "Ishita", "Tanvi", "Shreya", "Ritu"];
const LAST = ["Reddy", "Sharma", "Rao", "Kumar", "Naidu", "Patel", "Iyer", "Gupta", "Verma", "Chowdary", "Nair", "Joshi", "Singh", "Varma", "Pillai", "Desai", "Kulkarni", "Mishra", "Yadav", "Shetty"];
const CITIES = ["Hyderabad", "Vijayawada", "Warangal", "Guntur", "Visakhapatnam", "Nellore", "Karimnagar", "Tirupati", "Kurnool", "Khammam"];

const DEPTS = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "ECE", name: "Electronics & Communication Engineering" },
  { code: "EEE", name: "Electrical & Electronics Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "CE", name: "Civil Engineering" },
];

const PROGRAMS: { code: string; name: string; dept: string; level: ProgramLevel; years: number; intake: number }[] = [
  { code: "BTCSE", name: "B.Tech — Computer Science & Engineering", dept: "CSE", level: "UG", years: 4, intake: 120 },
  { code: "BTECE", name: "B.Tech — Electronics & Communication Engg.", dept: "ECE", level: "UG", years: 4, intake: 60 },
  { code: "BTEEE", name: "B.Tech — Electrical & Electronics Engg.", dept: "EEE", level: "UG", years: 4, intake: 60 },
  { code: "BTME", name: "B.Tech — Mechanical Engineering", dept: "ME", level: "UG", years: 4, intake: 60 },
  { code: "DCSE", name: "Diploma — Computer Engineering", dept: "CSE", level: "DIPLOMA", years: 3, intake: 60 },
  { code: "DME", name: "Diploma — Mechanical Engineering", dept: "ME", level: "DIPLOMA", years: 3, intake: 60 },
  { code: "DCE", name: "Diploma — Civil Engineering", dept: "CE", level: "DIPLOMA", years: 3, intake: 60 },
  { code: "MTCSE", name: "M.Tech — Computer Science & Engineering", dept: "CSE", level: "PG", years: 2, intake: 18 },
];

type Sub = [name: string, type?: SubjectType];
const COMMON_UG: Record<number, Sub[]> = {
  1: [["Engineering Mathematics – I"], ["Engineering Physics"], ["Programming for Problem Solving"], ["Basic Electrical Engineering"], ["Engineering Graphics", "LAB"], ["Physics Lab", "LAB"]],
  2: [["Engineering Mathematics – II"], ["Engineering Chemistry"], ["English for Communication"], ["Data Structures"], ["Workshop Practice", "LAB"], ["Programming Lab", "LAB"]],
};
const DEPT_UG: Record<string, Record<number, Sub[]>> = {
  CSE: {
    3: [["Discrete Mathematics"], ["Object Oriented Programming"], ["Digital Logic Design"], ["Computer Organization"], ["Database Management Systems"], ["OOP & DBMS Lab", "LAB"]],
    4: [["Probability & Statistics"], ["Design & Analysis of Algorithms"], ["Operating Systems"], ["Formal Languages & Automata"], ["Software Engineering"], ["OS & Algorithms Lab", "LAB"]],
    5: [["Computer Networks"], ["Compiler Design"], ["Artificial Intelligence"], ["Web Technologies"], ["Cloud Computing", "ELECTIVE"], ["Networks & Web Lab", "LAB"]],
    6: [["Machine Learning"], ["Cryptography & Network Security"], ["Distributed Systems"], ["Mobile App Development", "ELECTIVE"], ["Mini Project", "PROJECT"], ["ML Lab", "LAB"]],
  },
  ECE: {
    3: [["Signals & Systems"], ["Electronic Devices & Circuits"], ["Network Analysis"], ["Digital Electronics"], ["Probability Theory & Random Processes"], ["EDC Lab", "LAB"]],
    4: [["Analog Communications"], ["Linear IC Applications"], ["Electromagnetic Waves"], ["Control Systems"], ["Pulse & Digital Circuits"], ["Analog Communication Lab", "LAB"]],
    5: [["Digital Communications"], ["Microprocessors & Microcontrollers"], ["Antennas & Wave Propagation"], ["Digital Signal Processing"], ["VLSI Design", "ELECTIVE"], ["DSP Lab", "LAB"]],
  },
  EEE: {
    3: [["Electrical Circuit Analysis"], ["Electromagnetic Fields"], ["DC Machines & Transformers"], ["Analog Electronics"], ["Power Systems – I"], ["Electrical Machines Lab – I", "LAB"]],
    4: [["AC Machines"], ["Power Systems – II"], ["Control Systems"], ["Measurements & Instrumentation"], ["Digital Electronics"], ["Electrical Machines Lab – II", "LAB"]],
    5: [["Power Electronics"], ["Power System Analysis"], ["Microprocessors & Microcontrollers"], ["Electrical Machine Design"], ["Renewable Energy Sources", "ELECTIVE"], ["Power Electronics Lab", "LAB"]],
  },
  ME: {
    3: [["Engineering Mechanics"], ["Thermodynamics"], ["Material Science & Metallurgy"], ["Mechanics of Solids"], ["Manufacturing Processes"], ["Material Testing Lab", "LAB"]],
    4: [["Kinematics of Machinery"], ["Fluid Mechanics & Hydraulic Machines"], ["Applied Thermodynamics"], ["Machine Drawing"], ["Metrology"], ["Fluid Mechanics Lab", "LAB"]],
    5: [["Dynamics of Machinery"], ["Design of Machine Members"], ["Heat Transfer"], ["Machine Tools"], ["Automobile Engineering", "ELECTIVE"], ["Heat Transfer Lab", "LAB"]],
  },
};
const DIPLOMA: Record<string, Record<number, Sub[]>> = {
  CSE: {
    1: [["Applied Mathematics – I"], ["Applied Physics"], ["Basics of Computer Engineering"], ["Communication English"], ["Computer Fundamentals Lab", "LAB"]],
    2: [["Applied Mathematics – II"], ["Applied Chemistry"], ["Programming in C"], ["Digital Electronics"], ["C Programming Lab", "LAB"]],
    3: [["Data Structures using C"], ["Computer Organization"], ["Database Management Systems"], ["Operating Systems"], ["DBMS Lab", "LAB"]],
    4: [["Object Oriented Programming through Java"], ["Computer Networks"], ["Web Designing"], ["Software Engineering"], ["Java Lab", "LAB"]],
    5: [["Python Programming"], ["Cloud & Network Administration"], ["Mobile Application Development"], ["Industrial Management"], ["Project Work", "PROJECT"]],
  },
  ME: {
    1: [["Applied Mathematics – I"], ["Applied Physics"], ["Engineering Drawing"], ["Communication English"], ["Workshop Practice", "LAB"]],
    2: [["Applied Mathematics – II"], ["Applied Chemistry"], ["Engineering Mechanics"], ["Basic Electrical Engineering"], ["Machine Drawing Lab", "LAB"]],
    3: [["Strength of Materials"], ["Thermal Engineering – I"], ["Manufacturing Technology"], ["Engineering Materials"], ["Manufacturing Lab", "LAB"]],
    4: [["Thermal Engineering – II"], ["Fluid Mechanics"], ["Machine Design"], ["Production Technology"], ["Thermal Lab", "LAB"]],
    5: [["Refrigeration & Air Conditioning"], ["CAD/CAM"], ["Automobile Engineering"], ["Industrial Management"], ["Project Work", "PROJECT"]],
  },
  CE: {
    1: [["Applied Mathematics – I"], ["Applied Physics"], ["Engineering Drawing"], ["Communication English"], ["Surveying Practice – I", "LAB"]],
    2: [["Applied Mathematics – II"], ["Applied Chemistry"], ["Construction Materials"], ["Surveying – I"], ["Surveying Practice – II", "LAB"]],
    3: [["Strength of Materials"], ["Surveying – II"], ["Hydraulics"], ["Building Construction"], ["Material Testing Lab", "LAB"]],
    4: [["Reinforced Concrete Structures"], ["Transportation Engineering"], ["Environmental Engineering"], ["Estimating & Costing"], ["AutoCAD Lab", "LAB"]],
    5: [["Steel Structures"], ["Irrigation Engineering"], ["Construction Management"], ["Quantity Surveying"], ["Project Work", "PROJECT"]],
  },
};
const MTECH: Record<number, Sub[]> = {
  1: [["Advanced Data Structures"], ["Mathematical Foundations of CS"], ["Machine Learning"], ["Research Methodology"], ["Advanced DS Lab", "LAB"]],
  2: [["Advanced Algorithms"], ["Deep Learning"], ["Big Data Analytics"], ["Cyber Security", "ELECTIVE"], ["Deep Learning Lab", "LAB"]],
  3: [["Dissertation Phase – I", "PROJECT"], ["MOOC Elective", "ELECTIVE"]],
};

function subjectsFor(p: (typeof PROGRAMS)[number], sem: number): Sub[] {
  if (p.level === "DIPLOMA") return DIPLOMA[p.dept]?.[sem] ?? [];
  if (p.level === "PG") return MTECH[sem] ?? [];
  return COMMON_UG[sem] ?? DEPT_UG[p.dept]?.[sem] ?? [];
}

// Academic calendar: odd semesters Jul–Dec, even Jan–May.
const TERMS = [
  { name: "2024-25 Odd Semester", start: "2024-07-15", end: "2024-12-20", year: 2024, odd: true },
  { name: "2024-25 Even Semester", start: "2025-01-06", end: "2025-05-20", year: 2024, odd: false },
  { name: "2025-26 Odd Semester", start: "2025-07-14", end: "2025-12-19", year: 2025, odd: true },
  { name: "2025-26 Even Semester", start: "2026-01-05", end: "2026-05-22", year: 2025, odd: false },
  { name: "2026-27 Odd Semester", start: "2026-07-13", end: "2026-12-18", year: 2026, odd: true, current: true },
];
const semesterIn = (admissionYear: number, t: (typeof TERMS)[number]) => (t.year - admissionYear) * 2 + (t.odd ? 1 : 2);

async function main() {
  console.log("Resetting database…");
  // Refunds point at the receipt they reverse, so they go before the receipts themselves.
  await db.payment.deleteMany({ where: { refundOfId: { not: null } } });
  await db.cashClosing.deleteMany();
  await db.asset.deleteMany();
  await db.visitor.deleteMany();
  await db.errorLog.deleteMany();
  await db.invigilationDuty.deleteMany();
  // Academic rules go back to the standard ones.
  await db.institution.updateMany({ data: { attendanceRequired: 75, attendanceCondonable: 65, passPercent: 40, minExternalPercent: 35, gradeScale: Prisma.DbNull } });
  // Children first; MySQL enforces the RESTRICT relations.
  for (const m of [
    "emailLog", "loginAttempt", "bookIssue", "book", "hostel", "transportRoute", "enquiry", "calendarEvent", "examRoom",
    "placementApplication", "placementDrive", "company", "notice", "payment", "feeInvoice", "feeItem", "feeStructure",
    "subjectResult", "mark", "assessment", "attendanceRecord", "attendanceSession", "timetableSlot", "courseOffering",
    "student", "subject", "batch", "term", "auditLog",
  ] as const) {
    await (db[m] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
  await db.department.updateMany({ data: { hodId: null } });
  await db.faculty.deleteMany();
  await db.program.deleteMany();
  await db.department.deleteMany();
  await db.user.deleteMany();

  const hash = await bcrypt.hash("password123", 10);

  // ── Staff ──
  await db.user.create({ data: { email: "admin@edupilot.edu", name: "Dr. Ramesh Babu (Principal)", role: "ADMIN", passwordHash: hash, phone: "9000000001" } });
  await db.user.create({ data: { email: "accounts@edupilot.edu", name: "Srinivas Murthy", role: "ACCOUNTANT", passwordHash: hash, phone: "9000000002" } });
  await db.user.create({ data: { email: "office@edupilot.edu", name: "Lakshmi Prasad", role: "OFFICE", passwordHash: hash, phone: "9000000003" } });

  const depts = new Map<string, string>();
  for (const d of DEPTS) depts.set(d.code, (await db.department.create({ data: d })).id);

  const facultyByDept = new Map<string, string[]>();
  const DESIGNATIONS = ["Professor", "Associate Professor", "Assistant Professor", "Assistant Professor", "Assistant Professor", "Lecturer"];
  let emp = 1;
  for (const d of DEPTS) {
    const ids: string[] = [];
    const count = d.code === "CSE" ? 8 : 6;
    for (let i = 0; i < count; i++) {
      const female = rand() < 0.4;
      const name = `${i === 0 ? "Dr. " : ""}${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
      const isHod = i === 0;
      const email =
        d.code === "CSE" && isHod ? "hod.cse@edupilot.edu" :
        d.code === "CSE" && i === 2 ? "faculty@edupilot.edu" :
        `${d.code.toLowerCase()}.fac${i + 1}@edupilot.edu`;
      const user = await db.user.create({
        data: {
          email, name, role: isHod ? "HOD" : "FACULTY", passwordHash: hash, phone: `98${String(emp).padStart(8, "0")}`,
          faculty: {
            create: {
              employeeId: `EMP${String(emp++).padStart(4, "0")}`, departmentId: depts.get(d.code)!,
              designation: isHod ? "Professor" : DESIGNATIONS[i % DESIGNATIONS.length],
              qualification: isHod ? "Ph.D" : pick(["M.Tech", "M.Tech", "M.E", "Ph.D"]),
              specialization: d.name.split(" ")[0], joiningDate: day(`${2008 + Math.floor(rand() * 16)}-06-15`),
            },
          },
        },
        include: { faculty: true },
      });
      ids.push(user.faculty!.id);
      if (isHod) await db.department.update({ where: { id: depts.get(d.code)! }, data: { hodId: user.faculty!.id } });
    }
    facultyByDept.set(d.code, ids);
  }

  // ── Programs, subjects ──
  const programs = new Map<string, { id: string; p: (typeof PROGRAMS)[number] }>();
  const subjects = new Map<string, { id: string; type: SubjectType; internalMax: number; externalMax: number; credits: number }[]>();
  for (const p of PROGRAMS) {
    const prog = await db.program.create({
      data: { code: p.code, name: p.name, level: p.level, durationYears: p.years, totalSemesters: p.years * 2, intake: p.intake, departmentId: depts.get(p.dept)! },
    });
    programs.set(p.code, { id: prog.id, p });
    for (let sem = 1; sem <= p.years * 2; sem++) {
      const list = subjectsFor(p, sem);
      const created = [];
      for (const [i, [name, type = "THEORY"]] of list.entries()) {
        const lab = type === "LAB";
        const diploma = p.level === "DIPLOMA";
        const sub = await db.subject.create({
          data: {
            code: `${p.code}${sem}${String(i + 1).padStart(2, "0")}`, name, programId: prog.id, semester: sem, type,
            credits: lab ? 1.5 : type === "PROJECT" ? 2 : diploma ? 3 : 4,
            lectureHrs: lab ? 0 : 3, tutorialHrs: lab || diploma ? 0 : 1, practicalHrs: lab ? 3 : type === "PROJECT" ? 4 : 0,
            internalMax: lab ? 50 : diploma ? 20 : 40, externalMax: lab ? 50 : diploma ? 80 : 60,
          },
        });
        created.push({ id: sub.id, type, internalMax: sub.internalMax, externalMax: sub.externalMax, credits: sub.credits });
      }
      subjects.set(`${p.code}:${sem}`, created);
    }
  }

  // ── Terms ──
  const terms = [];
  for (const t of TERMS) terms.push({ ...t, id: (await db.term.create({ data: { name: t.name, startDate: day(t.start), endDate: day(t.end), isCurrent: !!t.current } })).id });
  const current = terms.at(-1)!;

  // ── Batches & students ──
  const BATCHES: [string, number, string][] = [
    ["BTCSE", 2024, "A"], ["BTCSE", 2024, "B"], ["BTCSE", 2025, "A"], ["BTCSE", 2025, "B"], ["BTCSE", 2026, "A"],
    ["BTECE", 2024, "A"], ["BTECE", 2025, "A"], ["BTEEE", 2025, "A"], ["BTME", 2024, "A"], ["BTME", 2025, "A"],
    ["DCSE", 2024, "A"], ["DCSE", 2025, "A"], ["DME", 2025, "A"], ["DCE", 2024, "A"],
    ["MTCSE", 2025, "A"],
    ["DCSE", 2022, "A"], ["DME", 2022, "A"], // completed in 2025: these are the alumni
  ];
  const batches: { id: string; code: string; year: number; section: string; level: ProgramLevel; dept: string; students: { id: string; ability: number; regularity: number; entrySemester: number; demo: boolean }[] }[] = [];
  let studentDemoAssigned = false;
  for (const [code, year, section] of BATCHES) {
    const { id: programId, p } = programs.get(code)!;
    const graduated = semesterIn(year, current) > p.years * 2;
    const sem = Math.min(p.years * 2, semesterIn(year, current));
    const batch = await db.batch.create({ data: { programId, admissionYear: year, section, currentSemester: sem } });
    const entry = { id: batch.id, code, year, section, level: p.level, dept: p.dept, students: [] as (typeof batches)[number]["students"] };
    const regular = p.level === "PG" ? 12 : 24;
    const usedNames = new Set<string>();
    const lateral = p.level === "UG" && year <= 2025 && section === "A" ? 4 : 0;
    for (let i = 0; i < regular + lateral; i++) {
      const isLateral = i >= regular;
      const female = rand() < 0.42;
      let first: string, last: string;
      do { first = pick(female ? FIRST_F : FIRST_M); last = pick(LAST); } while (usedNames.has(`${first} ${last}`));
      usedNames.add(`${first} ${last}`);
      const seq = isLateral ? 300 + i - regular + 1 : (section === "B" ? 100 : 0) + i + 1;
      const rollNo = `${String(isLateral ? year + 1 : year).slice(2)}${code}${String(seq).padStart(3, "0")}`;
      const demo: boolean = !studentDemoAssigned && code === "BTCSE" && year === 2024 && section === "A";
      studentDemoAssigned ||= demo;
      const ability = demo ? 0.82 : Math.min(0.97, Math.max(0.4, between(0.52, 0.95) + (rand() < 0.08 ? -0.15 : 0)));
      const user = await db.user.create({
        data: {
          email: demo ? "student@edupilot.edu" : `${rollNo.toLowerCase()}@student.edupilot.edu`,
          name: `${first} ${last}`, role: "STUDENT", passwordHash: hash, phone: `9${String(Math.floor(rand() * 1e9)).padStart(9, "0")}`,
          student: {
            create: {
              rollNo, batchId: batch.id,
              admissionType: isLateral ? "LATERAL" : rand() < 0.15 ? "MANAGEMENT" : "REGULAR",
              admissionDate: day(`${isLateral ? year + 1 : year}-08-0${1 + Math.floor(rand() * 8)}`),
              entrySemester: isLateral ? 3 : 1,
              dob: day(`${year - (p.level === "DIPLOMA" ? 16 : p.level === "PG" ? 22 : 18)}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`),
              gender: female ? "FEMALE" : "MALE", category: pick(["GENERAL", "GENERAL", "OBC", "OBC", "SC", "ST", "EWS"] as const),
              bloodGroup: pick(["A+", "B+", "O+", "AB+", "O-", "B-"]), address: `${Math.floor(between(1, 99))}-${Math.floor(between(1, 500))}, ${pick(CITIES)}`,
              guardianName: `${pick(FIRST_M)} ${last}`, guardianPhone: `9${String(Math.floor(rand() * 1e9)).padStart(9, "0")}`,
              previousSchool: isLateral ? "Govt. Polytechnic, " + pick(CITIES) : p.level === "PG" ? "B.Tech, " + pick(CITIES) + " Engg. College" : pick(["Narayana", "Sri Chaitanya", "Govt. Junior College", "ZPHS"]) + ", " + pick(CITIES),
              previousScore: Math.round(between(60, 97) * 10) / 10,
              status: graduated ? "GRADUATED" : !demo && rand() < 0.02 ? "DETAINED" : "ACTIVE",
            },
          },
        },
        include: { student: true },
      });
      entry.students.push({ id: user.student!.id, ability, regularity: demo ? 0.86 : between(0.55, 0.99), entrySemester: isLateral ? 3 : 1, demo });
    }
    batches.push(entry);
  }
  console.log(`Created ${batches.reduce((n, b) => n + b.students.length, 0)} students in ${batches.length} batches`);

  // ── Offerings: past terms get full marks & published results; current term gets timetable, attendance, Mid-1 ──
  const facultyLoad = new Map<string, number>();
  const pickFaculty = (dept: string, prefer?: string) => {
    const list = facultyByDept.get(dept)!;
    if (prefer) return prefer;
    const f = [...list].sort((a, b) => (facultyLoad.get(a) ?? 0) - (facultyLoad.get(b) ?? 0))[0];
    facultyLoad.set(f, (facultyLoad.get(f) ?? 0) + 1);
    return f;
  };
  const demoFaculty = (await db.user.findUniqueOrThrow({ where: { email: "faculty@edupilot.edu" }, include: { faculty: true } })).faculty!.id;

  const marksRows: Prisma.MarkCreateManyInput[] = [];
  const resultRows: Prisma.SubjectResultCreateManyInput[] = [];
  const currentOfferings: { id: string; batchIdx: number; facultyId: string; subject: { type: SubjectType; credits: number } }[] = [];

  for (const [bi, b] of batches.entries()) {
    const { p } = programs.get(b.code)!;
    for (const t of terms) {
      const sem = semesterIn(b.year, t);
      if (sem < 1 || sem > p.years * 2) continue;
      for (const [si, sub] of (subjects.get(`${b.code}:${sem}`) ?? []).entries()) {
        const isCurrent = t.id === current.id;
        const prefer = isCurrent && b.code === "BTCSE" && b.year === 2025 && b.section === "A" && si < 2 ? demoFaculty :
          isCurrent && b.code === "BTCSE" && b.year === 2024 && b.section === "A" && si === 0 ? demoFaculty : undefined;
        const facultyId = pickFaculty(b.dept === "CE" && p.level === "DIPLOMA" ? "CE" : b.dept, prefer);
        const off = await db.courseOffering.create({
          data: { subjectId: sub.id, batchId: b.id, termId: t.id, facultyId, resultsPublished: !isCurrent },
        });
        const plan: [string, AssessmentType, number][] = sub.type === "LAB" || sub.type === "PROJECT"
          ? [["Lab Record & Viva", "LAB_INTERNAL", 30], ["Internal Lab Exam", "LAB_INTERNAL", 20], ["External Practical Exam", "END_SEM", 50]]
          : [["Mid Term 1", "MID_TERM", 30], ["Mid Term 2", "MID_TERM", 30], ["Assignment", "ASSIGNMENT", 10], ["End Semester Exam", "END_SEM", 100]];
        const assessments = [];
        for (const [ai, [name, type, max]] of plan.entries()) {
          if (isCurrent && ai > 0) break; // current term: only first internal so far
          assessments.push(await db.assessment.create({ data: { offeringId: off.id, name, type, maxMarks: max, date: day(isCurrent ? "2026-09-08" : t.end) } }));
        }
        const eligible = b.students.filter((st) => sem >= st.entrySemester);
        for (const st of eligible) {
          const marks = assessments.map((a) => {
            const absent = !st.demo && rand() < 0.015;
            const perf = Math.min(1, Math.max(0, st.ability + between(-0.15, 0.12) + (a.type === "END_SEM" ? -0.05 : 0.05)));
            return { assessmentId: a.id, studentId: st.id, isAbsent: absent, marks: absent ? null : Math.round(perf * a.maxMarks) };
          });
          marksRows.push(...marks);
          if (!isCurrent) {
            const r = computeResult(sub, assessments, marks);
            resultRows.push({ offeringId: off.id, studentId: st.id, internal: r.internal, external: r.external, total: r.total, grade: r.grade, gradePoint: r.gradePoint, credits: sub.credits, passed: r.passed });
          }
        }
        if (isCurrent) currentOfferings.push({ id: off.id, batchIdx: bi, facultyId, subject: sub });
      }
    }
  }
  for (let i = 0; i < marksRows.length; i += 5000) await db.mark.createMany({ data: marksRows.slice(i, i + 5000) });
  for (let i = 0; i < resultRows.length; i += 5000) await db.subjectResult.createMany({ data: resultRows.slice(i, i + 5000) });
  console.log(`Marks: ${marksRows.length}, published results: ${resultRows.length}`);

  // ── Timetable for current term (no batch or faculty clashes) ──
  const facultyBusy = new Set<string>();
  const slots: Prisma.TimetableSlotCreateManyInput[] = [];
  const PERIODS = (d: number) => (d === 6 ? 4 : 7);
  for (const [bi, b] of batches.entries()) {
    const offs = currentOfferings.filter((o) => o.batchIdx === bi);
    const batchBusy = new Set<string>();
    for (const o of offs) {
      const lab = o.subject.type === "LAB" || o.subject.type === "PROJECT";
      let need = lab ? 3 : 4;
      const days = [1, 2, 3, 4, 5, 6].sort(() => rand() - 0.5);
      for (const d of days) {
        if (need <= 0) break;
        const block = lab ? 3 : 1;
        const starts = lab ? [5, 1, 2] : [1, 2, 3, 4, 5, 6, 7].sort(() => rand() - 0.5);
        for (const p0 of starts) {
          const ps = Array.from({ length: block }, (_, k) => p0 + k);
          if (ps.some((p) => p > PERIODS(d) || batchBusy.has(`${d}:${p}`) || facultyBusy.has(`${o.facultyId}:${d}:${p}`))) continue;
          for (const p of ps) {
            batchBusy.add(`${d}:${p}`);
            facultyBusy.add(`${o.facultyId}:${d}:${p}`);
            slots.push({ offeringId: o.id, batchId: b.id, dayOfWeek: d, period: p, room: lab ? `${b.dept}-LAB-${1 + (bi % 3)}` : `${b.dept}-${100 + bi}` });
          }
          need -= block;
          break;
        }
      }
    }
  }
  await db.timetableSlot.createMany({ data: slots });

  // ── Attendance: current term from 13 Jul 2026 up to yesterday, following the timetable ──
  const sessions: Prisma.AttendanceSessionCreateManyInput[] = [];
  const records: Prisma.AttendanceRecordCreateManyInput[] = [];
  const holidays = new Set(["2026-08-15", "2026-08-27", "2026-10-02"]);
  const offeringFaculty = new Map(currentOfferings.map((o) => [o.id, o.facultyId]));
  const facultyUser = new Map((await db.faculty.findMany({ select: { id: true, userId: true } })).map((f) => [f.id, f.userId]));
  for (let d = day("2026-07-13"); d < day("2026-10-09"); d = new Date(d.getTime() + 864e5)) {
    const dow = d.getUTCDay();
    if (dow === 0 || holidays.has(d.toISOString().slice(0, 10))) continue;
    for (const slot of slots.filter((x) => x.dayOfWeek === dow)) {
      const b = batches.find((x) => x.id === slot.batchId)!;
      const sessionId = randomUUID();
      sessions.push({ id: sessionId, offeringId: slot.offeringId, date: d, period: slot.period, takenById: facultyUser.get(offeringFaculty.get(slot.offeringId)!) });
      for (const st of b.students) {
        const r = rand();
        const status = r < st.regularity ? (rand() < 0.04 ? "LATE" : "PRESENT") : rand() < 0.15 ? "ON_DUTY" : "ABSENT";
        records.push({ sessionId, studentId: st.id, status });
      }
    }
  }
  for (let i = 0; i < sessions.length; i += 5000) await db.attendanceSession.createMany({ data: sessions.slice(i, i + 5000) });
  for (let i = 0; i < records.length; i += 10000) await db.attendanceRecord.createMany({ data: records.slice(i, i + 10000) });
  console.log(`Timetable slots: ${slots.length}, attendance sessions: ${sessions.length}, records: ${records.length}`);

  // ── Fees (2026-27) ──
  const accountant = await db.user.findUniqueOrThrow({ where: { email: "accounts@edupilot.edu" } });
  let invNo = 1, rcptNo = 1;
  for (const [code, { id: programId, p }] of programs) {
    for (let y = 1; y <= p.years; y++) {
      const ug = p.level === "UG", pg = p.level === "PG";
      const items = [
        { head: "Tuition Fee", amount: pg ? 57000 : ug ? 85000 : 22000 },
        { head: "Special / Development Fee", amount: ug || pg ? 5000 : 2000 },
        { head: "Examination Fee", amount: ug || pg ? 3500 : 1500 },
        { head: "Library & Lab Fee", amount: ug || pg ? 4000 : 1500 },
        ...(y === 1 ? [{ head: "Admission & Caution Deposit", amount: 3000 }] : []),
      ];
      const structure = await db.feeStructure.create({
        data: { name: `${code} — Year ${y} (2026-27)`, programId, yearOfStudy: y, academicYear: "2026-27", items: { create: items } },
      });
      const total = items.reduce((sum, i) => sum + i.amount, 0);
      for (const b of batches.filter((x) => x.code === code && 2026 - x.year + 1 === y)) {
        for (const st of b.students) {
          const concession = rand() < 0.12 ? Math.round(total * 0.5) : 0;
          const inv = await db.feeInvoice.create({
            data: { invoiceNo: `INV-2026-${String(invNo++).padStart(5, "0")}`, studentId: st.id, structureId: structure.id, title: structure.name, amount: total, concession, dueDate: day("2026-09-30") },
          });
          const r = rand();
          const payable = total - concession;
          const pays = r < 0.55 ? [payable] : r < 0.8 ? [Math.round(payable * 0.5)] : [];
          for (const amount of pays) {
            await db.payment.create({
              data: { receiptNo: `RCPT-2026-${String(rcptNo++).padStart(5, "0")}`, invoiceId: inv.id, amount, mode: pick(["UPI", "UPI", "BANK_TRANSFER", "CASH", "CARD", "DD"] as const), reference: `TXN${Math.floor(rand() * 1e10)}`, paidAt: new Date(day("2026-07-01").getTime() + Math.floor(rand() ** 0.7 * 99) * 864e5), collectedById: accountant.id },
            });
          }
        }
      }
    }
  }

  // ── Notices ──
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@edupilot.edu" } });
  const hod = await db.user.findUniqueOrThrow({ where: { email: "hod.cse@edupilot.edu" } });
  await db.notice.createMany({
    data: [
      { title: "Mid Term 2 examinations from 3rd November", body: "Mid Term 2 examinations for all B.Tech and Diploma semesters will be held from 3rd to 8th November 2026. Detailed time-tables will be shared by the respective departments.", audience: "ALL", pinned: true, createdById: admin.id, createdAt: new Date("2026-10-05T09:00:00Z") },
      { title: "Attendance shortage — condonation window", body: "Students with attendance between 65% and 75% may apply for condonation with a medical certificate before 20th October. Students below 65% will be detained as per regulations.", audience: "STUDENTS", pinned: true, createdById: admin.id, createdAt: new Date("2026-10-01T09:00:00Z") },
      { title: "Last date for fee payment extended", body: "The last date for payment of 2026-27 tuition fee without fine is extended to 15th October 2026. A late fee of ₹100/day applies thereafter.", audience: "STUDENTS", createdById: accountant.id, createdAt: new Date("2026-09-28T09:00:00Z") },
      { title: "Faculty Development Programme on Generative AI", body: "A five-day AICTE-ATAL sponsored FDP on Generative AI in Engineering Education will be conducted from 19th October. Register with the CSE department office.", audience: "FACULTY", createdById: hod.id, departmentId: depts.get("CSE"), createdAt: new Date("2026-09-25T09:00:00Z") },
      { title: "NAAC peer team visit — documentation", body: "All HODs are requested to keep course files, attendance registers and CO-PO attainment reports ready for the NAAC peer team visit in December.", audience: "FACULTY", createdById: admin.id, createdAt: new Date("2026-09-20T09:00:00Z") },
      { title: "Smart India Hackathon 2026 — internal round", body: "Internal hackathon for SIH 2026 will be held on 24th October in the CSE seminar hall. Teams of 6 with at least one female member may register.", audience: "ALL", createdById: hod.id, createdAt: new Date("2026-09-15T09:00:00Z") },
    ],
  });

  // ── Placements ──
  const companies = await Promise.all(
    [["Tata Consultancy Services", "IT Services"], ["Infosys", "IT Services"], ["Zoho", "Product"], ["Bosch", "Automotive"], ["Larsen & Toubro", "Construction"], ["Accenture", "Consulting"]].map(([name, industry]) =>
      db.company.create({ data: { name, industry, website: `https://www.${name.split(" ")[0].toLowerCase()}.com` } }),
    ),
  );
  const drives = [
    { c: 0, role: "Assistant System Engineer", ctc: 3.6, date: "2026-08-20", minCgpa: 6, maxBacklogs: 1, levels: "UG,DIPLOMA", status: "COMPLETED" as const },
    { c: 1, role: "Systems Engineer", ctc: 3.6, date: "2026-10-22", minCgpa: 6.5, maxBacklogs: 0, levels: "UG", status: "OPEN" as const },
    { c: 2, role: "Member Technical Staff", ctc: 7.2, date: "2026-11-05", minCgpa: 7.5, maxBacklogs: 0, levels: "UG,PG", status: "OPEN" as const },
    { c: 3, role: "Graduate Engineer Trainee", ctc: 5, date: "2026-11-18", minCgpa: 6.5, maxBacklogs: 0, levels: "UG", status: "UPCOMING" as const },
    { c: 4, role: "Diploma Engineer Trainee (Civil)", ctc: 3.2, date: "2026-10-28", minCgpa: 6, maxBacklogs: 1, levels: "DIPLOMA", status: "OPEN" as const },
    { c: 5, role: "Associate Software Engineer", ctc: 4.5, date: "2026-12-02", minCgpa: 6.5, maxBacklogs: 0, levels: "UG,PG", status: "UPCOMING" as const },
  ];
  const seniors = batches.filter((b) => b.year === 2024 || b.level === "PG").flatMap((b) => b.students);
  for (const d of drives) {
    const drive = await db.placementDrive.create({
      data: { companyId: companies[d.c].id, role: d.role, ctcLpa: d.ctc, driveDate: day(d.date), minCgpa: d.minCgpa, maxBacklogs: d.maxBacklogs, eligibleLevels: d.levels, status: d.status, description: `${companies[d.c].name} is hiring ${d.role}s. Online assessment followed by technical and HR interviews.` },
    });
    if (d.status === "COMPLETED") {
      for (const st of seniors.filter(() => rand() < 0.3)) {
        await db.placementApplication.create({ data: { driveId: drive.id, studentId: st.id, status: st.ability > 0.7 ? "SELECTED" : st.ability > 0.55 ? "SHORTLISTED" : "REJECTED" } });
      }
    }
  }

  await seedModules();

  // ── Recent activity so the audit log and dashboards have history ──
  const hodUser = await db.user.findUniqueOrThrow({ where: { email: "hod.cse@edupilot.edu" } });
  const facUser = await db.user.findUniqueOrThrow({ where: { email: "faculty@edupilot.edu" } });
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3);
  await db.auditLog.createMany({
    data: [
      { userId: facUser.id, action: "MARK", entity: "Attendance", details: "BTCSE 2025-A · P2", createdAt: hoursAgo(1) },
      { userId: accountant.id, action: "COLLECT", entity: "Payment", details: "₹48,750 UPI", createdAt: hoursAgo(2) },
      { userId: hodUser.id, action: "ALLOCATE", entity: "CourseOffering", details: "Machine Learning → BTCSE 2024-B", createdAt: hoursAgo(5) },
      { userId: admin.id, action: "CREATE", entity: "Notice", details: "Mid Term 2 examinations from 3rd November", createdAt: hoursAgo(26) },
      { userId: facUser.id, action: "SAVE", entity: "Marks", details: "Mid Term 1 · 28 entries", createdAt: hoursAgo(30) },
      { userId: admin.id, action: "PUBLISH", entity: "Results", details: "2025-26 Even Semester", createdAt: hoursAgo(72) },
    ],
  });

  console.log("Seed complete. Login with any demo account using password: password123");
}

/** Demo data for the service modules (calendar, leave, materials, exams, library, hostel, transport…). */
async function seedModules() {
  const hash = await bcrypt.hash("password123", 10);
  const term = await db.term.findFirstOrThrow({ where: { isCurrent: true } });
  const demo = await db.student.findFirstOrThrow({ where: { user: { email: "student@edupilot.edu" } }, include: { batch: true } });
  const facultyUser = await db.user.findUniqueOrThrow({ where: { email: "faculty@edupilot.edu" }, include: { faculty: true } });
  const adminUser = await db.user.findUniqueOrThrow({ where: { email: "admin@edupilot.edu" } });
  const classmates = await db.student.findMany({ where: { batchId: demo.batchId }, orderBy: { rollNo: "asc" } });
  const everyone = await db.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, gender: true, rollNo: true, userId: true }, orderBy: { rollNo: "asc" } });

  await db.institution.upsert({
    where: { id: 1 }, update: {},
    create: { id: 1, address: "Knowledge Park, Kukatpally, Hyderabad 500085", phone: "040-2300 1234", email: "office@edupilot.edu", principalName: "Dr. Ramesh Babu", lateFinePerDay: 25, lateFineMax: 1000 },
  });
  // The row may already exist with blank defaults (the app creates it on first page load). Fill the demo
  // details in that case, but leave a college's own settings alone.
  await db.institution.updateMany({ where: { id: 1, address: "" }, data: { address: "Knowledge Park, Kukatpally, Hyderabad 500085", phone: "040-2300 1234", email: "office@edupilot.edu", principalName: "Dr. Ramesh Babu", lateFinePerDay: 25, lateFineMax: 1000 } });

  // Calendar
  await db.calendarEvent.createMany({
    data: [
      { title: "Independence Day", type: "HOLIDAY", date: day("2026-08-15") },
      { title: "Ganesh Chaturthi", type: "HOLIDAY", date: day("2026-08-27") },
      { title: "Gandhi Jayanti", type: "HOLIDAY", date: day("2026-10-02") },
      { title: "Dussehra vacation", type: "HOLIDAY", date: day("2026-10-19"), endDate: day("2026-10-21") },
      { title: "Diwali", type: "HOLIDAY", date: day("2026-11-09") },
      { title: "Christmas", type: "HOLIDAY", date: day("2026-12-25") },
      { title: "Mid Term 2 examinations", type: "EXAM", date: day("2026-11-03"), endDate: day("2026-11-07") },
      { title: "End-semester examinations", type: "EXAM", date: day("2026-12-01"), endDate: day("2026-12-15") },
      { title: "Smart India Hackathon — internal round", type: "EVENT", date: day("2026-10-24"), description: "CSE seminar hall" },
      { title: "Tech fest “Pragyan”", type: "EVENT", date: day("2026-11-20"), endDate: day("2026-11-21") },
    ],
  });

  // Leave & on-duty
  await db.leaveRequest.createMany({
    data: [
      { studentId: demo.id, type: "ON_DUTY", fromDate: day("2026-09-17"), toDate: day("2026-09-18"), reason: "Represented the college at the JNTU inter-college coding contest", status: "APPROVED", reviewedById: facultyUser.id },
      { studentId: demo.id, type: "LEAVE", fromDate: day("2026-10-15"), toDate: day("2026-10-16"), reason: "Sister's wedding at home town", status: "PENDING" },
      { studentId: classmates[3].id, type: "MEDICAL", fromDate: day("2026-10-05"), toDate: day("2026-10-08"), reason: "Viral fever — medical certificate attached at the department office", status: "PENDING" },
      { studentId: classmates[5].id, type: "ON_DUTY", fromDate: day("2026-10-07"), toDate: day("2026-10-07"), reason: "NSS blood donation camp volunteer", status: "PENDING" },
      { studentId: classmates[8].id, type: "LEAVE", fromDate: day("2026-09-22"), toDate: day("2026-09-23"), reason: "Family function", status: "REJECTED", reviewedById: facultyUser.id, reviewNote: "Mid-term week" },
    ],
  });

  // Study material, assignments, syllabus and outcomes for the demo student's courses
  const offerings = await db.courseOffering.findMany({ where: { batchId: demo.batchId, termId: term.id }, include: { subject: true, assessments: true } });
  const UNITS = ["Fundamentals and terminology", "Core models and architecture", "Algorithms and protocols", "Design techniques", "Performance and optimisation", "Case studies", "Tools and practice", "Advanced topics", "Applications", "Review and problem solving"];
  for (const o of offerings.filter((x) => x.subject.type !== "LAB")) {
    const topics = UNITS.map((t, i) => ({ subjectId: o.subjectId, unit: Math.floor(i / 2) + 1, title: `${t}`, position: i }));
    await db.syllabusTopic.createMany({ data: topics });
    const created = await db.syllabusTopic.findMany({ where: { subjectId: o.subjectId }, orderBy: { position: "asc" } });
    const done = 4 + Math.floor(rand() * 3);
    await db.topicCoverage.createMany({ data: created.slice(0, done).map((t, i) => ({ offeringId: o.id, topicId: t.id, coveredOn: day(`2026-0${8 + Math.floor(i / 3)}-${String(5 + i * 3).padStart(2, "0")}`) })) });
    await db.material.create({ data: { offeringId: o.id, kind: "NOTE", title: `${o.subject.name} — Unit 1 & 2 notes`, description: "Lecture slides and reference reading.", link: "https://nptel.ac.in/" } });
    const co = await Promise.all([["CO1", "Explain the fundamental concepts and terminology", { "1": 3, "2": 2 }], ["CO2", "Apply core techniques to solve standard problems", { "2": 3, "3": 2, "5": 1 }], ["CO3", "Analyse and compare alternative designs", { "2": 2, "4": 3 }]]
      .map(([code, description, poMap]) => db.courseOutcome.create({ data: { subjectId: o.subjectId, code: code as string, description: description as string, poMap: poMap as object } })));
    if (o.assessments[0]) await db.assessmentOutcome.createMany({ data: [{ assessmentId: o.assessments[0].id, outcomeId: co[0].id }, { assessmentId: o.assessments[0].id, outcomeId: co[1].id }] });
    // A second assessment mapped to CO2 and CO3, so every outcome shows an attainment level and the PO chart is filled in.
    const quiz = await db.assessment.create({ data: { offeringId: o.id, name: "Assignment 1", type: "ASSIGNMENT", maxMarks: 10, date: day("2026-09-22") } });
    await db.mark.createMany({ data: classmates.map((st) => ({ assessmentId: quiz.id, studentId: st.id, marks: 4 + Math.floor(rand() * 7) })) });
    await db.assessmentOutcome.createMany({ data: [{ assessmentId: quiz.id, outcomeId: co[1].id }, { assessmentId: quiz.id, outcomeId: co[2].id }] });
  }
  const mine = offerings.find((o) => o.facultyId === facultyUser.faculty!.id) ?? offerings[0];
  const assignment = await db.material.create({ data: { offeringId: mine.id, kind: "ASSIGNMENT", title: "Assignment 1 — Problem set", description: "Solve problems 1–10 from the unit 2 exercise sheet. Submit a PDF or a link.", dueDate: day("2026-10-14"), maxMarks: 10 } });
  await db.submission.createMany({
    data: classmates.slice(1, 9).map((st, i) => ({ materialId: assignment.id, studentId: st.id, note: "Solutions attached in the shared folder.", link: "https://drive.google.com/", marks: i < 4 ? 6 + (i % 4) : null, feedback: i < 4 ? "Good work" : null, submittedAt: new Date(`2026-10-0${1 + (i % 8)}T10:00:00Z`) })),
  });

  // Anonymous feedback for this batch's courses
  for (const o of offerings) {
    const n = 10 + Math.floor(rand() * 8);
    await db.feedbackResponse.createMany({ data: Array.from({ length: n }, () => ({ offeringId: o.id, ratings: [0, 1, 2, 3, 4].map(() => 3 + Math.floor(rand() * 3)), comment: rand() < 0.2 ? pick(["More solved examples please.", "Classes are clear and well paced.", "Lab sessions could be longer.", "Very approachable for doubts."]) : null })) });
    await db.feedbackMarker.createMany({ data: classmates.slice(1, n + 1).map((st) => ({ offeringId: o.id, studentId: st.id })), skipDuplicates: true });
  }

  // Exam halls and end-semester schedule for the demo batch
  await db.examRoom.createMany({ data: [{ name: "Block A – 101", capacity: 40 }, { name: "Block A – 102", capacity: 40 }, { name: "Block B – 201", capacity: 60 }, { name: "Seminar Hall", capacity: 120 }] });
  await db.examSchedule.createMany({ data: offerings.filter((o) => o.subject.type !== "LAB").map((o, i) => ({ termId: term.id, subjectId: o.subjectId, date: day(`2026-12-${String(1 + i * 2).padStart(2, "0")}`), session: "FN" })) });

  // Electives: sem-5 elective is running; sem-6 electives are open for choice
  const electives = await db.subject.findMany({ where: { type: "ELECTIVE", program: { code: "BTCSE" } } });
  for (const e of electives) await db.electiveOption.create({ data: { termId: term.id, subjectId: e.id, seatLimit: 40 } });

  // Parent login for the demo student
  await db.user.create({ data: { email: "parent@edupilot.edu", name: demo.guardianName ?? "Parent", role: "PARENT", passwordHash: hash, phone: demo.guardianPhone, children: { create: { studentId: demo.id } } } });

  // Certificates and helpdesk
  await db.certificateRequest.createMany({
    data: [
      { studentId: demo.id, type: "BONAFIDE", purpose: "Education loan application", status: "APPROVED", serialNo: "BON/2026/0001", issuedAt: new Date("2026-09-12T09:00:00Z") },
      { studentId: classmates[2].id, type: "BONAFIDE", purpose: "Passport application" },
      { studentId: classmates[6].id, type: "STUDY", purpose: "Scholarship renewal" },
    ],
  });
  const t1 = await db.ticket.create({ data: { userId: demo.userId, category: "Fees", subject: "Scholarship amount not reflected in my invoice", body: "My fee reimbursement was sanctioned in August but the invoice still shows the full balance.", status: "IN_PROGRESS" } });
  await db.ticketReply.create({ data: { ticketId: t1.id, userId: adminUser.id, body: "We have forwarded this to the accounts section. It will be credited once the funds are received from the government." } });
  await db.ticket.create({ data: { userId: classmates[4].userId, category: "Hostel", subject: "Water cooler on the 2nd floor is not working", body: "The water cooler near room 204 has been out of order for three days." } });
  await db.ticket.create({ data: { userId: facultyUser.id, category: "IT / login", subject: "Projector in CSE-104 needs replacement", body: "The projector lamp is very dim. Please arrange a replacement before mid-terms.", status: "RESOLVED" } });

  // Admissions pipeline
  const progs = await db.program.findMany();
  const STAGES = ["ENQUIRY", "ENQUIRY", "ENQUIRY", "APPLIED", "APPLIED", "DOCUMENTS", "ADMITTED", "ADMITTED", "LOST"] as const;
  await db.enquiry.createMany({
    data: Array.from({ length: 16 }, (_, i) => ({
      name: `${pick(rand() < 0.5 ? FIRST_M : FIRST_F)} ${pick(LAST)}`, phone: `9${String(Math.floor(rand() * 1e9)).padStart(9, "0")}`, programId: pick(progs).id,
      source: pick(["Walk-in", "Website", "Reference", "Counselling", "Advertisement"]), stage: STAGES[i % STAGES.length],
      followUpDate: day(`2026-10-${String(6 + (i % 14)).padStart(2, "0")}`), notes: pick(["Asked about hostel and transport.", "Interested in lateral entry.", "Comparing with two other colleges.", "Parents will visit the campus on Saturday.", null]), ownerId: adminUser.id,
    })),
  });

  // Scholarships
  const SCHEMES = ["State fee reimbursement (RTF)", "Post-matric scholarship", "National Scholarship Portal", "Merit scholarship"];
  await db.scholarship.createMany({
    data: everyone.filter((_, i) => i % 23 === 0).map((st, i) => ({ studentId: st.id, scheme: SCHEMES[i % 4], academicYear: "2026-27", amount: [35000, 20000, 50000, 15000][i % 4], status: (["APPLIED", "SANCTIONED", "APPLIED", "REJECTED"] as const)[i % 4], reference: `APP${100000 + i * 37}` })),
  });

  // Instalment plan on the demo student's invoice
  const inv = await db.feeInvoice.findFirst({ where: { studentId: demo.id } });
  if (inv) {
    // The demo student has paid the first of two instalments, leaving a balance to try online payment with.
    const half = Math.floor(inv.amount / 2);
    await db.payment.deleteMany({ where: { invoiceId: inv.id } });
    await db.instalment.createMany({ data: [{ invoiceId: inv.id, dueDate: day("2026-08-31"), amount: half }, { invoiceId: inv.id, dueDate: day("2026-12-15"), amount: inv.amount - half }] });
    await db.feeInvoice.update({ where: { id: inv.id }, data: { concession: 0, dueDate: day("2026-12-15") } });
    await db.payment.create({ data: { receiptNo: "RCPT-2026-90001", invoiceId: inv.id, amount: half, mode: "UPI", reference: "TXN7700123456", paidAt: day("2026-08-20") } });
  }

  // Library
  const BOOKS: [string, string, string][] = [
    ["Introduction to Algorithms", "Cormen, Leiserson, Rivest, Stein", "Computer Science"], ["Operating System Concepts", "Silberschatz, Galvin, Gagne", "Computer Science"],
    ["Computer Networking: A Top-Down Approach", "Kurose, Ross", "Computer Science"], ["Database System Concepts", "Korth, Sudarshan", "Computer Science"],
    ["Artificial Intelligence: A Modern Approach", "Russell, Norvig", "Computer Science"], ["Compilers: Principles, Techniques and Tools", "Aho, Lam, Sethi, Ullman", "Computer Science"],
    ["Signals and Systems", "Oppenheim, Willsky", "Electronics"], ["Microelectronic Circuits", "Sedra, Smith", "Electronics"], ["Electrical Machinery", "P. S. Bimbhra", "Electrical"],
    ["Engineering Thermodynamics", "P. K. Nag", "Mechanical"], ["Theory of Machines", "S. S. Rattan", "Mechanical"], ["Strength of Materials", "R. K. Bansal", "Civil"],
    ["Surveying Vol. 1", "B. C. Punmia", "Civil"], ["Higher Engineering Mathematics", "B. S. Grewal", "Mathematics"], ["Engineering Physics", "Gaur, Gupta", "Science"],
  ];
  await db.book.createMany({ data: BOOKS.map(([title, author, category], i) => ({ title, author, category, isbn: `97801${String(31000000 + i * 7919)}`, copies: 2 + (i % 3) })) });
  const books = await db.book.findMany({ orderBy: { title: "asc" } });
  await db.bookIssue.createMany({
    data: [
      { bookId: books[0].id, userId: demo.userId, issuedOn: day("2026-10-01"), dueOn: day("2026-10-15") },
      { bookId: books[2].id, userId: classmates[1].userId, issuedOn: day("2026-09-10"), dueOn: day("2026-09-24") },
      { bookId: books[3].id, userId: classmates[2].userId, issuedOn: day("2026-10-03"), dueOn: day("2026-10-17") },
      { bookId: books[5].id, userId: facultyUser.id, issuedOn: day("2026-09-28"), dueOn: day("2026-10-12") },
      { bookId: books[7].id, userId: classmates[7].userId, issuedOn: day("2026-09-01"), dueOn: day("2026-09-15"), returnedOn: day("2026-09-14") },
    ],
  });

  // Hostel
  for (const [name, kind, warden, gender] of [["Vivekananda Boys Hostel", "Boys", "Mr. K. Prasad", "MALE"], ["Sarojini Girls Hostel", "Girls", "Mrs. L. Devi", "FEMALE"]] as const) {
    const h = await db.hostel.create({ data: { name, kind, warden, messFee: 4500, rooms: { create: Array.from({ length: 6 }, (_, i) => ({ number: `${101 + i}`, capacity: 3 })) } }, include: { rooms: true } });
    const residents = everyone.filter((st) => st.gender === gender).filter((_, i) => i % 9 === 0).slice(0, 13);
    await db.hostelAllocation.createMany({ data: residents.map((st, i) => ({ roomId: h.rooms[Math.floor(i / 3)].id, studentId: st.id, fromDate: day("2026-07-15") })) });
  }

  // Transport
  const ROUTES: [string, string, [string, string][]][] = [
    ["Route 1 — Kukatpally", "TS09 UA 4521", [["Miyapur", "07:20"], ["Kukatpally", "07:40"], ["Moosapet", "07:55"], ["College", "08:40"]]],
    ["Route 2 — Secunderabad", "TS09 UB 1187", [["Secunderabad Stn", "07:10"], ["Begumpet", "07:30"], ["Ameerpet", "07:45"], ["College", "08:40"]]],
    ["Route 3 — LB Nagar", "TS08 UC 7734", [["LB Nagar", "06:50"], ["Dilsukhnagar", "07:05"], ["Koti", "07:30"], ["College", "08:40"]]],
  ];
  const stops: { id: string; routeId: string }[] = [];
  for (const [name, vehicleNo, list] of ROUTES) {
    const r = await db.transportRoute.create({ data: { name, vehicleNo, driver: `${pick(FIRST_M)} ${pick(LAST)}`, phone: `98480${String(Math.floor(rand() * 1e5)).padStart(5, "0")}`, fee: 18000, stops: { create: list.map(([n, pickup], position) => ({ name: n, pickup, position })) } }, include: { stops: true } });
    stops.push(...r.stops.slice(0, -1).map((st) => ({ id: st.id, routeId: r.id })));
  }
  const riders = [demo, ...everyone.filter((_, i) => i % 11 === 3)].slice(0, 30);
  await db.transportPass.createMany({ data: riders.map((st, i) => ({ studentId: st.id, routeId: stops[i % stops.length].routeId, stopId: stops[i % stops.length].id })), skipDuplicates: true });

  // Placement: interview rounds on every drive, résumé for the demo student
  for (const d of await db.placementDrive.findMany()) {
    await db.driveRound.createMany({ data: ["Online assessment", "Technical interview", "HR interview"].map((name, i) => ({ driveId: d.id, name, position: i + 1 })) });
    if (d.status === "COMPLETED") {
      await db.placementApplication.updateMany({ where: { driveId: d.id, status: "SELECTED" }, data: { roundNo: 3 } });
      await db.placementApplication.updateMany({ where: { driveId: d.id, status: "SHORTLISTED" }, data: { roundNo: 1 } });
    }
  }
  // ── Alumni: graduated batches get a profile; about two-thirds have current details ──
  const grads = await db.student.findMany({ where: { status: "GRADUATED" }, include: { batch: { include: { program: true } } } });
  const COMPANIES = ["Tata Consultancy Services", "Infosys", "Wipro", "Tech Mahindra", "Larsen & Toubro", "Bosch", "Cognizant", "HCL Technologies", "Mahindra & Mahindra", "Capgemini"];
  await db.alumniProfile.createMany({
    data: grads.map((g) => {
      const r = rand();
      return {
        studentId: g.id, graduationYear: g.batch.admissionYear + g.batch.program.durationYears,
        company: r < 0.5 ? pick(COMPANIES) : null, designation: r < 0.5 ? pick(["Junior Engineer", "Graduate Trainee", "Technician", "Associate", "Site Supervisor"]) : null,
        location: r < 0.7 ? pick(CITIES) : null, higherStudies: r >= 0.5 && r < 0.7 ? pick(["B.Tech (lateral entry), JNTU Hyderabad", "B.Tech (lateral entry), this institution", "B.E., Osmania University"]) : null,
      };
    }),
  });

  // ── Staff: a month of attendance, leave, appraisal records and a class swap ──
  const staff = await db.user.findMany({ where: { role: { in: ["HOD", "FACULTY", "ACCOUNTANT"] } }, include: { faculty: true } });
  const staffDays: { userId: string; date: Date; status: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" }[] = [];
  for (let d = day("2026-09-10"); d <= day("2026-10-09"); d = new Date(d.getTime() + 864e5)) {
    if (d.getUTCDay() === 0 || d.toISOString().slice(0, 10) === "2026-10-02") continue;
    for (const u of staff) { const r = rand(); staffDays.push({ userId: u.id, date: d, status: r < 0.93 ? "PRESENT" : r < 0.96 ? "ON_LEAVE" : r < 0.98 ? "HALF_DAY" : "ABSENT" }); }
  }
  await db.staffAttendance.createMany({ data: staffDays });
  const cseFaculty = staff.filter((u) => u.faculty && u.role === "FACULTY" && u.faculty.departmentId === facultyUser.faculty!.departmentId);
  const hodUser = await db.user.findUniqueOrThrow({ where: { email: "hod.cse@edupilot.edu" } });
  const colleague0 = cseFaculty.find((u) => u.id !== facultyUser.id)!;
  await db.staffLeave.createMany({
    data: [
      { userId: facultyUser.id, type: "CASUAL", fromDate: day("2026-10-14"), toDate: day("2026-10-15"), reason: "Family function out of station", status: "PENDING" },
      { userId: facultyUser.id, type: "ON_DUTY", fromDate: day("2026-09-21"), toDate: day("2026-09-22"), reason: "Resource person at AICTE workshop, JNTU", status: "APPROVED", reviewedById: hodUser.id },
      { userId: colleague0.id, type: "SICK", fromDate: day("2026-10-12"), toDate: day("2026-10-13"), reason: "Fever; medical certificate will be submitted", status: "PENDING" },
      { userId: hodUser.id, type: "EARNED", fromDate: day("2026-10-26"), toDate: day("2026-10-28"), reason: "Personal work", status: "PENDING" },
    ],
  });
  const RECORDS: ["PUBLICATION" | "CONFERENCE" | "WORKSHOP" | "FDP" | "PATENT" | "FUNDED_PROJECT" | "AWARD", string, string][] = [
    ["PUBLICATION", "A lightweight attention model for crop disease detection", "IEEE Access (SCI)"], ["CONFERENCE", "Energy-aware task scheduling in edge clusters", "IEEE INDICON 2025"],
    ["FDP", "Generative AI in engineering education", "AICTE-ATAL Academy"], ["WORKSHOP", "Outcome-based education and CO-PO mapping", "NITTTR Chandigarh"],
    ["PATENT", "IoT-based smart irrigation controller", "Indian Patent Office (published)"], ["FUNDED_PROJECT", "Low-cost air-quality monitoring network", "DST-SERB · Rs. 18 lakh"],
    ["AWARD", "Best Teacher Award", "State Technological University"], ["PUBLICATION", "Performance of recycled-aggregate concrete under cyclic loading", "Construction and Building Materials (Scopus)"],
  ];
  const teachers = staff.filter((u) => u.faculty);
  await db.achievement.createMany({
    data: Array.from({ length: 46 }, (_, i) => { const [kind, title, venue] = RECORDS[i % RECORDS.length]; const f = i < 6 ? facultyUser : pick(teachers); return { facultyId: f.faculty!.id, kind, title: i < RECORDS.length ? title : `${title} — part ${Math.floor(i / RECORDS.length) + 1}`, venue, date: day(`${2023 + (i % 4)}-${String(1 + (i * 5) % 12).padStart(2, "0")}-15`) }; }),
  });
  // A colleague's class at a time the demo teacher is free, on the next date that weekday falls on.
  const busy = new Set((await db.timetableSlot.findMany({ where: { offering: { facultyId: facultyUser.faculty!.id, termId: term.id } } })).map((x) => `${x.dayOfWeek}:${x.period}`));
  const colleague = cseFaculty.find((u) => u.id !== facultyUser.id)!;
  const mySlot = (await db.timetableSlot.findMany({ where: { offering: { facultyId: colleague.faculty!.id, termId: term.id } }, orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }] })).find((x) => !busy.has(`${x.dayOfWeek}:${x.period}`));
  if (mySlot) {
    let when = day("2026-10-12");
    while (when.getUTCDay() !== mySlot.dayOfWeek) when = new Date(when.getTime() + 864e5);
    await db.swapRequest.create({ data: { slotId: mySlot.id, date: when, fromId: colleague.faculty!.id, toId: facultyUser.faculty!.id, reason: "Attending a paper presentation" } });
  }

  // ── A second child for the demo parent, guardian email, notifications and a scheduled report ──
  const sibling = await db.student.findFirstOrThrow({ where: { batch: { program: { code: "DCSE" }, admissionYear: 2025 } }, orderBy: { rollNo: "asc" } });
  const parentUser = await db.user.findUniqueOrThrow({ where: { email: "parent@edupilot.edu" } });
  await db.parentLink.create({ data: { userId: parentUser.id, studentId: sibling.id } });
  await db.student.update({ where: { id: demo.id }, data: { guardianEmail: "parent@edupilot.edu" } });
  const ago = (h: number) => new Date(Date.now() - h * 3600e3);
  await db.notification.createMany({
    data: [
      { userId: demo.userId, title: "Result published: Operating Systems", body: "Your grade card has been updated.", href: "/results", createdAt: ago(30) },
      { userId: demo.userId, title: "New assignment in Computer Networks", body: "Assignment 1 — Problem set, due 14 Oct", href: "/materials", createdAt: ago(8) },
      { userId: demo.userId, title: "Leave request approved", body: "On-duty on 17–18 Sept was approved.", href: "/leave", createdAt: ago(50), readAt: ago(40) },
      { userId: parentUser.id, title: "Payment received: ₹48,750", body: "Thank you. A receipt is available in the portal.", href: "/fees", createdAt: ago(20) },
      { userId: facultyUser.id, title: "A colleague asks you to take a class", body: "Wednesday 14 Oct — see Class swaps.", href: "/staff/swaps", createdAt: ago(3) },
      { userId: hodUser.id, title: "Leave request from a faculty member", body: "2 day(s) of casual leave awaiting your approval.", href: "/staff/leave", createdAt: ago(5) },
      { userId: adminUser.id, title: "New helpdesk ticket: Water cooler not working", body: "Hostel", href: "/helpdesk", createdAt: ago(6) },
      { userId: adminUser.id, title: "Certificate requested", body: "Bonafide certificate for passport application", href: "/certificates", createdAt: ago(12) },
    ],
  });
  await db.reportSchedule.create({ data: { userId: adminUser.id, report: "attendance", frequency: "WEEKLY" } });
  await addDemoExtras(db);

  await db.student.update({ where: { id: demo.id }, data: { about: "Third-year CSE student interested in backend engineering and distributed systems. Built a college event portal used by 800+ students.", skills: "Java, Spring Boot, SQL, React, Git, Linux", linkedin: "https://www.linkedin.com/", github: "https://github.com/" } });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
