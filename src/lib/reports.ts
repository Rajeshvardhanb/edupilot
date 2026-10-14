import "server-only";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { currentTerm, programScope } from "./scope";
import { attendanceSummary } from "./attendance";
import { studentStandings } from "./results";
import { invoiceStatus } from "./fees";
import { batchLabel, isoDate, pct, titleCase } from "./format";

export type Filters = { program?: string; batch?: string; from?: string; to?: string };
type Row = Record<string, string | number>;
export type Dataset = {
  label: string; description: string; roles: CurrentUser["role"][];
  columns: { key: string; label: string; default?: boolean }[];
  filters: ("program" | "batch" | "dates")[];
  rows: (user: CurrentUser, f: Filters) => Promise<Row[]>;
};

/** Students the user may report on, narrowed by the chosen programme / batch. */
function studentWhere(user: CurrentUser, f: Filters) {
  return { batch: { ...(f.batch && { id: f.batch }), program: { ...programScope(user), ...(f.program && { id: f.program }) } } };
}

export const DATASETS: Record<string, Dataset> = {
  students: {
    label: "Students", description: "Master list with attendance, CGPA, backlogs and fee dues", roles: ["ADMIN", "HOD"], filters: ["program", "batch"],
    columns: [
      { key: "rollNo", label: "Roll no", default: true }, { key: "name", label: "Name", default: true }, { key: "programme", label: "Programme", default: true }, { key: "batch", label: "Batch", default: true },
      { key: "semester", label: "Semester", default: true }, { key: "status", label: "Status", default: true }, { key: "attendance", label: "Attendance %", default: true }, { key: "cgpa", label: "CGPA", default: true },
      { key: "backlogs", label: "Backlogs", default: true }, { key: "feeDue", label: "Fee due (Rs.)" }, { key: "gender", label: "Gender" }, { key: "category", label: "Category" }, { key: "admission", label: "Admission type" },
      { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "guardian", label: "Guardian" }, { key: "guardianPhone", label: "Guardian phone" },
    ],
    async rows(user, f) {
      const students = await db.student.findMany({ where: studentWhere(user, f), include: { user: { select: { name: true, email: true, phone: true } }, batch: { include: { program: true } }, invoices: { include: { payments: { select: { amount: true } }, instalments: true } } }, orderBy: { rollNo: "asc" } });
      const term = await currentTerm();
      const offerings = await db.courseOffering.findMany({ where: { termId: term?.id, batchId: { in: [...new Set(students.map((s) => s.batchId))] } }, select: { id: true } });
      const att = await attendanceSummary({ studentIds: students.map((s) => s.id), offeringIds: offerings.map((o) => o.id) });
      const totals = new Map<string, { a: number; t: number }>();
      for (const [k, v] of att) { const id = k.split(":")[0]; const x = totals.get(id) ?? { a: 0, t: 0 }; x.a += v.attended; x.t += v.total; totals.set(id, x); }
      const st = await studentStandings(students.map((s) => s.id));
      return students.map((s) => ({
        rollNo: s.rollNo, name: s.user.name, programme: s.batch.program.code, batch: batchLabel(s.batch), semester: s.batch.currentSemester, status: titleCase(s.status),
        attendance: totals.get(s.id) ? pct(totals.get(s.id)!.a, totals.get(s.id)!.t) : "", cgpa: st.get(s.id)!.cgpa, backlogs: st.get(s.id)!.backlogs,
        feeDue: s.invoices.reduce((sum, i) => sum + invoiceStatus(i).balance, 0), gender: s.gender ? titleCase(s.gender) : "", category: s.category, admission: titleCase(s.admissionType),
        email: s.user.email, phone: s.user.phone ?? "", guardian: s.guardianName ?? "", guardianPhone: s.guardianPhone ?? "",
      }));
    },
  },
  faculty: {
    label: "Faculty", description: "Staff list with qualification, experience and workload", roles: ["ADMIN", "HOD"], filters: [],
    columns: [{ key: "employeeId", label: "Emp. ID", default: true }, { key: "name", label: "Name", default: true }, { key: "department", label: "Department", default: true }, { key: "designation", label: "Designation", default: true }, { key: "qualification", label: "Qualification", default: true }, { key: "joined", label: "Date of joining", default: true }, { key: "experience", label: "Experience (years)", default: true }, { key: "courses", label: "Courses this term", default: true }, { key: "records", label: "Appraisal records" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }],
    async rows(user) {
      const term = await currentTerm();
      const list = await db.faculty.findMany({ where: user.role === "HOD" ? { departmentId: user.departmentId ?? "-" } : {}, include: { user: { select: { name: true, email: true, phone: true } }, department: true, _count: { select: { achievements: true, offerings: { where: { termId: term?.id } } } } }, orderBy: [{ department: { code: "asc" } }, { employeeId: "asc" }] });
      return list.map((f) => ({ employeeId: f.employeeId, name: f.user.name, department: f.department.code, designation: f.designation, qualification: f.qualification ?? "", joined: isoDate(f.joiningDate), experience: f.joiningDate ? Math.floor((Date.now() - f.joiningDate.getTime()) / (365.25 * 864e5)) : "", courses: f._count.offerings, records: f._count.achievements, email: f.user.email, phone: f.user.phone ?? "" }));
    },
  },
  fees: {
    label: "Fee dues", description: "Every invoice with payable, paid, balance and status", roles: ["ADMIN", "ACCOUNTANT"], filters: ["program", "batch"],
    columns: [{ key: "invoiceNo", label: "Invoice", default: true }, { key: "rollNo", label: "Roll no", default: true }, { key: "name", label: "Student", default: true }, { key: "batch", label: "Batch", default: true }, { key: "title", label: "Fee" }, { key: "payable", label: "Payable", default: true }, { key: "paid", label: "Paid", default: true }, { key: "balance", label: "Balance", default: true }, { key: "fine", label: "Late fine" }, { key: "status", label: "Status", default: true }, { key: "due", label: "Next due", default: true }, { key: "guardianPhone", label: "Guardian phone" }],
    async rows(user, f) {
      const list = await db.feeInvoice.findMany({ where: { student: studentWhere(user, f) }, include: { payments: { select: { amount: true } }, instalments: true, student: { include: { user: { select: { name: true } }, batch: { include: { program: true } } } } }, orderBy: { invoiceNo: "asc" } });
      return list.map((i) => { const s = invoiceStatus(i); return { invoiceNo: i.invoiceNo, rollNo: i.student.rollNo, name: i.student.user.name, batch: batchLabel(i.student.batch), title: i.title, payable: s.payable, paid: s.paid, balance: s.balance, fine: s.fine, status: titleCase(s.status), due: isoDate(s.nextDue), guardianPhone: i.student.guardianPhone ?? "" }; });
    },
  },
  payments: {
    label: "Collections", description: "Receipts in a date range", roles: ["ADMIN", "ACCOUNTANT"], filters: ["dates"],
    columns: [{ key: "receiptNo", label: "Receipt", default: true }, { key: "date", label: "Date", default: true }, { key: "rollNo", label: "Roll no", default: true }, { key: "name", label: "Student", default: true }, { key: "invoiceNo", label: "Invoice" }, { key: "mode", label: "Mode", default: true }, { key: "reference", label: "Reference" }, { key: "amount", label: "Amount", default: true }, { key: "by", label: "Collected by" }],
    async rows(_user, f) {
      const list = await db.payment.findMany({ where: { paidAt: { gte: new Date(`${f.from || "2000-01-01"}T00:00:00Z`), lte: new Date(`${f.to || "2100-01-01"}T23:59:59Z`) } }, include: { collectedBy: { select: { name: true } }, invoice: { include: { student: { include: { user: { select: { name: true } } } } } } }, orderBy: { paidAt: "asc" } });
      return list.map((p) => ({ receiptNo: p.receiptNo, date: isoDate(p.paidAt), rollNo: p.invoice.student.rollNo, name: p.invoice.student.user.name, invoiceNo: p.invoice.invoiceNo, mode: titleCase(p.mode), reference: p.reference ?? "", amount: p.amount, by: p.collectedBy?.name ?? "" }));
    },
  },
  results: {
    label: "Results", description: "Published subject results with grades", roles: ["ADMIN", "HOD"], filters: ["program", "batch"],
    columns: [{ key: "rollNo", label: "Roll no", default: true }, { key: "name", label: "Name", default: true }, { key: "term", label: "Term", default: true }, { key: "code", label: "Subject code", default: true }, { key: "subject", label: "Subject", default: true }, { key: "credits", label: "Credits" }, { key: "internal", label: "Internal", default: true }, { key: "external", label: "External", default: true }, { key: "total", label: "Total", default: true }, { key: "grade", label: "Grade", default: true }, { key: "result", label: "Result", default: true }],
    async rows(user, f) {
      const list = await db.subjectResult.findMany({ where: { student: studentWhere(user, f) }, include: { student: { include: { user: { select: { name: true } } } }, offering: { include: { subject: true, term: true } } }, orderBy: [{ student: { rollNo: "asc" } }, { offering: { term: { startDate: "asc" } } }], take: 20000 });
      return list.map((r) => ({ rollNo: r.student.rollNo, name: r.student.user.name, term: r.offering.term.name, code: r.offering.subject.code, subject: r.offering.subject.name, credits: r.credits, internal: r.internal, external: r.external, total: r.total, grade: r.grade, result: r.passed ? "Pass" : "Fail" }));
    },
  },
  placements: {
    label: "Placements", description: "Applications and offers", roles: ["ADMIN", "HOD"], filters: ["program"],
    columns: [{ key: "rollNo", label: "Roll no", default: true }, { key: "name", label: "Student", default: true }, { key: "programme", label: "Programme", default: true }, { key: "company", label: "Company", default: true }, { key: "role", label: "Role", default: true }, { key: "ctc", label: "CTC (LPA)", default: true }, { key: "status", label: "Status", default: true }, { key: "date", label: "Drive date" }],
    async rows(user, f) {
      const list = await db.placementApplication.findMany({ where: { student: studentWhere(user, f) }, include: { drive: { include: { company: true } }, student: { include: { user: { select: { name: true } }, batch: { include: { program: true } } } } }, orderBy: [{ drive: { driveDate: "desc" } }, { student: { rollNo: "asc" } }] });
      return list.map((a) => ({ rollNo: a.student.rollNo, name: a.student.user.name, programme: a.student.batch.program.code, company: a.drive.company.name, role: a.drive.role, ctc: a.drive.ctcLpa, status: titleCase(a.status), date: isoDate(a.drive.driveDate) }));
    },
  },
  alumni: {
    label: "Alumni", description: "Graduates and their current position", roles: ["ADMIN", "HOD"], filters: ["program"],
    columns: [{ key: "rollNo", label: "Roll no", default: true }, { key: "name", label: "Name", default: true }, { key: "programme", label: "Programme", default: true }, { key: "year", label: "Graduated", default: true }, { key: "company", label: "Company", default: true }, { key: "designation", label: "Designation", default: true }, { key: "location", label: "Location" }, { key: "higher", label: "Higher studies" }, { key: "email", label: "Personal email" }, { key: "phone", label: "Phone" }],
    async rows(user, f) {
      const list = await db.student.findMany({ where: { status: "GRADUATED", ...studentWhere(user, f) }, include: { user: { select: { name: true, phone: true } }, alumni: true, batch: { include: { program: true } } }, orderBy: { rollNo: "asc" } });
      return list.map((s) => ({ rollNo: s.rollNo, name: s.user.name, programme: s.batch.program.code, year: s.alumni?.graduationYear ?? s.batch.admissionYear + s.batch.program.durationYears, company: s.alumni?.company ?? "", designation: s.alumni?.designation ?? "", location: s.alumni?.location ?? "", higher: s.alumni?.higherStudies ?? "", email: s.alumni?.personalEmail ?? "", phone: s.alumni?.phone ?? s.user.phone ?? "" }));
    },
  },
};

export const allowedDatasets = (user: CurrentUser) => Object.entries(DATASETS).filter(([, d]) => d.roles.includes(user.role));

export function toCsv(headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s) && typeof v !== "number") s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // The BOM makes Excel read UTF-8 (names, rupee sign) correctly.
  return "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
