import type { PrismaClient } from "@prisma/client";
import { computePay, workingDaysIn } from "../src/lib/payroll";

/**
 * Demo records for the office features: a parent contact log, one refund and three day closings.
 * Used by the seed, and safe to run against an existing demo database (it does nothing if they are already there).
 */
export async function addDemoExtras(db: PrismaClient) {
  const added = await addOfficeDemo(db);
  const more = await addCampusDemo(db);
  return added || more;
}

async function addOfficeDemo(db: PrismaClient) {
  if (await db.parentContact.count()) return false;
  const demo = await db.student.findFirstOrThrow({ where: { user: { email: "student@edupilot.edu" } }, include: { user: true } });
  const mates = await db.student.findMany({ where: { batchId: demo.batchId, id: { not: demo.id } }, include: { user: true }, orderBy: { rollNo: "asc" }, take: 4 });
  const who = async (email: string) => (await db.user.findUnique({ where: { email } }))?.id ?? null;
  const [office, accounts, faculty, hod] = await Promise.all([who("office@edupilot.edu"), who("accounts@edupilot.edu"), who("faculty@edupilot.edu"), who("hod.cse@edupilot.edu")]);
  const ago = (days: number, hour = 11) => { const d = new Date(Date.now() - days * 864e5); d.setUTCHours(hour - 5, 30, 0, 0); return d; };

  const [m1, m2, m3, m4] = mates;
  await db.parentContact.createMany({
    data: [
      { studentId: m3.id, channel: "WHATSAPP", purpose: "ATTENDANCE", byId: faculty, createdAt: ago(1, 10), message: `Dear Parent, ${m3.user.name} (${m3.rollNo}) has 62.4% attendance this term. A minimum of 75% is required to appear for the end-semester exams. Kindly ensure regular attendance.` },
      { studentId: m3.id, channel: "PHONE", purpose: "ATTENDANCE", byId: hod, createdAt: ago(0, 15), message: "Spoke to the father. He was not aware of the absences and will meet the class teacher on Monday with the medical records." },
      { studentId: m1.id, channel: "EMAIL", purpose: "FEES", byId: accounts, createdAt: ago(3, 12), message: "Fee reminder: ₹1,00,750 overdue on the first-year invoice, including the late fine." },
      { studentId: m1.id, channel: "WHATSAPP", purpose: "FEES", byId: accounts, createdAt: ago(2, 16), message: `Dear Parent, a fee balance is pending for ${m1.user.name} (${m1.rollNo}). Kindly pay at the earliest. — Accounts` },
      { studentId: demo.id, channel: "IN_PERSON", purpose: "GENERAL", byId: office, createdAt: ago(6, 11), message: "Mother visited the office to collect the bonafide certificate for the education loan. Updated the guardian's phone number." },
      { studentId: m2.id, channel: "PHONE", purpose: "RESULTS", byId: faculty, createdAt: ago(8, 14), message: "Called about the backlog in Operating Systems. Explained supplementary registration and the last date." },
      { studentId: m4.id, channel: "IN_PERSON", purpose: "CONDUCT", byId: hod, createdAt: ago(12, 10), message: "Met both parents about repeated late arrival to the first period. Agreed to review in two weeks." },
    ],
  });

  // One refund: ₹1,000 returned against a classmate's receipt.
  const receipt = await db.payment.findFirst({ where: { amount: { gt: 5000 }, refundOfId: null, invoice: { studentId: m2.id } }, orderBy: { paidAt: "asc" } });
  if (receipt && accounts) {
    const year = new Date().getFullYear();
    await db.payment.create({ data: { invoiceId: receipt.invoiceId, amount: -1000, mode: "BANK_TRANSFER", reference: "NEFT2610040012", note: "Library deposit collected twice", refundOfId: receipt.id, receiptNo: `RFND-${year}-00001`, collectedById: accounts, paidAt: ago(4, 13) } });
  }

  // The three most recent days with cash receipts are closed: two tally, one is short with an explanation.
  const cash = await db.payment.findMany({ where: { mode: "CASH" }, orderBy: { paidAt: "desc" }, select: { paidAt: true, amount: true } });
  const byDay = new Map<string, number>();
  for (const p of cash) { const k = p.paidAt.toISOString().slice(0, 10); byDay.set(k, (byDay.get(k) ?? 0) + p.amount); }
  const days = [...byDay].slice(0, 3);
  for (const [i, [day, expected]] of days.entries()) {
    const short = i === 1 ? 500 : 0;
    await db.cashClosing.create({ data: { date: new Date(`${day}T00:00:00Z`), expectedCash: expected, countedCash: expected - short, note: short ? "₹500 short: change given without a receipt entry; to be recovered from the counter float." : null, closedById: accounts, closedAt: new Date(`${day}T12:10:00Z`) } });
  }
  return true;
}

/** Demo records for inventory, visitors, gate passes, payroll, revaluation and profile corrections. */
async function addCampusDemo(db: PrismaClient) {
  if (await db.asset.count()) return false;
  const depts = new Map((await db.department.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
  const demo = await db.student.findFirstOrThrow({ where: { user: { email: "student@edupilot.edu" } } });
  const mates = await db.student.findMany({ where: { batchId: demo.batchId, id: { not: demo.id } }, include: { user: true }, orderBy: { rollNo: "asc" }, take: 6 });
  const office = (await db.user.findUnique({ where: { email: "office@edupilot.edu" } }))?.id ?? null;
  const day = (s: string) => new Date(`${s}T00:00:00Z`);
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3);

  // Inventory
  const assets: [string, string, string, string, string, number, number, string][] = [
    ["CSE-LAB1-PC", "Desktop computer, i5 / 16 GB", "Computer", "CSE Lab 1", "CSE", 36, 52000, "GOOD"],
    ["CSE-LAB2-PC", "Desktop computer, i7 / 32 GB", "Computer", "CSE Lab 2", "CSE", 30, 78000, "GOOD"],
    ["CSE-LAB2-SW", "24-port network switch", "Network", "CSE Lab 2", "CSE", 2, 18500, "GOOD"],
    ["ECE-DSO", "Digital storage oscilloscope, 100 MHz", "Lab equipment", "ECE Electronics Lab", "ECE", 12, 34000, "GOOD"],
    ["ECE-FG", "Function generator, 3 MHz", "Lab equipment", "ECE Electronics Lab", "ECE", 12, 9800, "NEEDS_REPAIR"],
    ["EEE-MOTOR", "DC shunt motor-generator set", "Lab equipment", "EEE Machines Lab", "EEE", 6, 145000, "GOOD"],
    ["ME-LATHE", "Centre lathe, 1.5 m bed", "Lab equipment", "ME Workshop", "ME", 8, 210000, "GOOD"],
    ["ME-VERNIER", "Vernier caliper, 150 mm", "Tools", "ME Metrology Lab", "ME", 40, 1200, "GOOD"],
    ["CE-TS", "Total station", "Lab equipment", "CE Survey Lab", "CE", 4, 385000, "GOOD"],
    ["AV-PROJ", "Ceiling projector, 4000 lumens", "Projector / AV", "Seminar Hall", "", 9, 62000, "GOOD"],
    ["AV-PROJ-OLD", "Projector, 2200 lumens", "Projector / AV", "Store room", "", 3, 28000, "CONDEMNED"],
    ["FUR-BENCH", "Dual-seat classroom bench", "Furniture", "Academic Block A", "", 420, 4200, "GOOD"],
  ];
  await db.asset.createMany({ data: assets.map(([tag, name, category, location, dept, quantity, cost, condition], i) => ({ tag, name, category, location, departmentId: depts.get(dept) ?? null, quantity, cost, condition, purchaseDate: day(`${2019 + (i % 6)}-0${1 + (i % 9)}-15`) })) });
  const tag = async (t: string) => (await db.asset.findUniqueOrThrow({ where: { tag: t } })).id;
  await db.assetIssue.createMany({ data: [
    { assetId: await tag("ME-VERNIER"), issuedTo: "DME 2025-A · Metrology practical", quantity: 20, issuedAt: hoursAgo(3), dueBack: day(new Date().toISOString().slice(0, 10)), byId: office },
    { assetId: await tag("AV-PROJ"), issuedTo: "Dr. Vivaan Patel · Guest lecture", quantity: 1, issuedAt: hoursAgo(50), dueBack: day(new Date(Date.now() - 864e5).toISOString().slice(0, 10)), byId: office },
    { assetId: await tag("ECE-DSO"), issuedTo: "Smart India Hackathon team", quantity: 2, issuedAt: hoursAgo(120), dueBack: day(new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)), byId: office },
  ] });

  // Visitors and gate passes
  await db.visitor.createMany({ data: [
    { name: "Suresh Reddy", phone: "9848012345", purpose: "Parent meeting about attendance", toMeet: "HOD, CSE", inAt: hoursAgo(1), byId: office },
    { name: "Anita Sharma", phone: "9966554433", purpose: "Projector service", toMeet: "Office (store)", idProof: "Company ID 4471", inAt: hoursAgo(2), byId: office },
    { name: "Ramana Rao", phone: "9000112233", purpose: "Admission enquiry", toMeet: "Admissions desk", inAt: hoursAgo(5), outAt: hoursAgo(4), byId: office },
  ] });
  const [m1, m2, m3, m4, m5] = mates;
  await db.gatePass.createMany({ data: [
    { studentId: m1.id, reason: "Going home for the weekend", outAt: new Date(Date.now() + 20 * 3600e3), expectedBack: new Date(Date.now() + 68 * 3600e3), status: "PENDING" },
    { studentId: m2.id, reason: "Doctor's appointment in the city", outAt: hoursAgo(3), expectedBack: new Date(Date.now() + 2 * 3600e3), status: "OUT", leftAt: hoursAgo(3), decidedById: office },
    { studentId: m3.id, reason: "Collecting passport from the regional office", outAt: hoursAgo(9), expectedBack: hoursAgo(2), status: "OUT", leftAt: hoursAgo(9), decidedById: office },
    { studentId: m4.id, reason: "Family function", outAt: hoursAgo(60), expectedBack: hoursAgo(20), status: "RETURNED", leftAt: hoursAgo(60), returnedAt: hoursAgo(22), decidedById: office },
  ] });
  await db.profileChange.create({ data: { studentId: m5.id, field: "guardianPhone", oldValue: m5.guardianPhone, newValue: "9440098765", requestedById: m5.userId } });

  // Payroll: a salary for every member of staff, and last month's payslips
  const staff = await db.user.findMany({ where: { role: { in: ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"] } }, include: { faculty: { select: { designation: true } } } });
  const BASIC: Record<string, number> = { Professor: 144200, "Associate Professor": 131400, "Assistant Professor": 57700, Lecturer: 44900 };
  const structures = staff.map((u) => {
    const basic = u.role === "ADMIN" ? 159100 : u.faculty ? BASIC[u.faculty.designation] ?? 57700 : u.role === "ACCOUNTANT" ? 47600 : 35400;
    return { userId: u.id, basic, hra: Math.round(basic * 0.16), da: Math.round(basic * 0.42), allowances: 3600, pfPercent: 12, otherDeductions: 200 };
  });
  await db.salaryStructure.createMany({ data: structures });
  const now = new Date(), prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), month = prev.toISOString().slice(0, 7);
  const wd = workingDaysIn(month);
  await db.payslip.createMany({ data: structures.map((s, i) => { const p = computePay(s, wd, i % 9 === 4 ? 1 : i % 13 === 7 ? 0.5 : 0); return { userId: s.userId, month, workingDays: wd, paidDays: p.paidDays, lopDays: p.lopDays, basic: s.basic, hra: s.hra, da: s.da, allowances: s.allowances, gross: p.gross, pf: p.pf, otherDeductions: p.otherDeductions, lopDeduction: p.lopDeduction, net: p.net }; }) });

  // One revaluation request waiting, on a classmate's weakest published subject
  const weakest = await db.subjectResult.findFirst({ where: { studentId: m1.id, offering: { resultsPublished: true, subject: { externalMax: { gt: 0 } } } }, orderBy: [{ offering: { term: { startDate: "desc" } } }, { total: "asc" }] });
  if (weakest) await db.revaluationRequest.create({ data: { studentId: m1.id, offeringId: weakest.offeringId, reason: "Question 6(b) was answered on the last page of the booklet and seems not to have been marked.", oldExternal: weakest.external, oldTotal: weakest.total, oldGrade: weakest.grade } });
  return true;
}
