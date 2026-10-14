"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csvRecords } from "@/lib/csv";
import { SETUP_KINDS, type SetupKind } from "@/lib/setup";
import type { ActionState } from "@/lib/action-state";

const num = (v: string) => (v === "" ? NaN : Number(v));
const int = (v: string, lo: number, hi: number) => { const n = num(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

/**
 * Bulk set-up from a spreadsheet saved as CSV. Rows that already exist (same code / employee ID)
 * are updated, so a corrected file can be uploaded again. Bad rows are skipped and listed.
 */
export async function importSetup(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const kind = String(fd.get("kind")) as SetupKind;
  const spec = SETUP_KINDS[kind];
  if (!spec) return { error: "Unknown import." };
  const file = fd.get("file");
  const pasted = String(fd.get("text") ?? "").trim();
  if (!(file instanceof File && file.size > 0) && !pasted) return { error: "Choose a CSV file, or paste the rows." };
  if (file instanceof File && file.size > 1_000_000) return { error: "File too large (max 1 MB)." };
  const { header, records } = csvRecords(file instanceof File && file.size > 0 ? await file.text() : pasted);
  const missing = spec.required.filter((c) => !header.includes(c));
  if (missing.length) return { error: `The header row is missing: ${missing.join(", ")}. Expected columns: ${spec.columns.join(", ")}` };
  if (!records.length) return { error: "The file has a header but no rows." };
  if (records.length > 2000) return { error: "Too many rows (max 2,000 per upload)." };

  const [depts, programs] = await Promise.all([db.department.findMany({ select: { id: true, code: true } }), db.program.findMany({ select: { id: true, code: true } })]);
  const deptId = new Map(depts.map((d) => [d.code.toUpperCase(), d.id])), programId = new Map(programs.map((p) => [p.code.toUpperCase(), p.id]));
  const errors: string[] = [];
  let saved = 0;
  const skip = (line: number, why: string) => { errors.push(`Row ${line}: ${why}`); };
  const feeGroups = new Map<string, { programId: string; code: string; year: number; ay: string; items: { head: string; amount: number }[] }>();

  for (const { line, data: r } of records) {
    const blank = spec.required.find((c) => !r[c]);
    if (blank) { skip(line, `${blank} is empty`); continue; }
    try {
      if (kind === "departments") {
        const code = r.code.toUpperCase();
        if (code.length < 2 || code.length > 10) { skip(line, "code must be 2 to 10 characters"); continue; }
        const d = await db.department.upsert({ where: { code }, create: { code, name: r.name }, update: { name: r.name } });
        deptId.set(code, d.id);
      } else if (kind === "programs") {
        const level = r.level.toUpperCase(), years = int(r.durationYears, 1, 6), intake = r.intake ? int(r.intake, 1, 1000) : 60, dept = deptId.get(r.department.toUpperCase());
        if (!["DIPLOMA", "UG", "PG"].includes(level)) { skip(line, "level must be DIPLOMA, UG or PG"); continue; }
        if (!years || !intake) { skip(line, "durationYears must be 1–6 and intake 1–1000"); continue; }
        if (!dept) { skip(line, `department "${r.department}" does not exist — import departments first`); continue; }
        const row = { name: r.name, level: level as "UG", durationYears: years, totalSemesters: years * 2, intake, departmentId: dept };
        const p = await db.program.upsert({ where: { code: r.code.toUpperCase() }, create: { code: r.code.toUpperCase(), ...row }, update: row });
        programId.set(p.code.toUpperCase(), p.id);
      } else if (kind === "batches") {
        const pid = programId.get(r.program.toUpperCase()), year = int(r.admissionYear, 2000, 2100), sem = r.currentSemester ? int(r.currentSemester, 1, 12) : 1, section = (r.section || "A").toUpperCase().slice(0, 3);
        if (!pid) { skip(line, `programme "${r.program}" does not exist — import programmes first`); continue; }
        if (!year || !sem) { skip(line, "admissionYear must be a year and currentSemester 1–12"); continue; }
        const existing = await db.batch.findFirst({ where: { programId: pid, admissionYear: year, section } });
        if (existing) await db.batch.update({ where: { id: existing.id }, data: { currentSemester: sem } });
        else await db.batch.create({ data: { programId: pid, admissionYear: year, section, currentSemester: sem } });
      } else if (kind === "subjects") {
        const pid = programId.get(r.program.toUpperCase()), sem = int(r.semester, 1, 12), credits = num(r.credits), type = (r.type || "THEORY").toUpperCase();
        if (!pid) { skip(line, `programme "${r.program}" does not exist — import programmes first`); continue; }
        if (!sem || !(credits >= 0 && credits <= 30)) { skip(line, "semester must be 1–12 and credits a number"); continue; }
        if (!["THEORY", "LAB", "PROJECT", "ELECTIVE", "AUDIT"].includes(type)) { skip(line, "type must be THEORY, LAB, PROJECT, ELECTIVE or AUDIT"); continue; }
        const hrs = (v: string, d: number) => (v ? int(v, 0, 20) : d), marks = (v: string, d: number) => (v ? int(v, 0, 200) : d);
        const row = { name: r.name, programId: pid, semester: sem, credits, type: type as "THEORY", lectureHrs: hrs(r.lectureHrs, 3), tutorialHrs: hrs(r.tutorialHrs, 0), practicalHrs: hrs(r.practicalHrs, 0), internalMax: marks(r.internalMax, 40), externalMax: marks(r.externalMax, 60) };
        if ([row.lectureHrs, row.tutorialHrs, row.practicalHrs, row.internalMax, row.externalMax].some((x) => x === null)) { skip(line, "hours and marks must be whole numbers"); continue; }
        if (row.internalMax! + row.externalMax! === 0) { skip(line, "internalMax and externalMax can't both be 0"); continue; }
        const clean = row as { [K in keyof typeof row]: NonNullable<(typeof row)[K]> };
        await db.subject.upsert({ where: { code: r.code.toUpperCase() }, create: { code: r.code.toUpperCase(), ...clean }, update: clean });
      } else if (kind === "faculty") {
        const dept = deptId.get(r.department.toUpperCase()), email = r.email.toLowerCase(), employeeId = r.employeeId.toUpperCase();
        if (!dept) { skip(line, `department "${r.department}" does not exist — import departments first`); continue; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skip(line, "email is not valid"); continue; }
        if (r.joiningDate && !/^\d{4}-\d{2}-\d{2}$/.test(r.joiningDate)) { skip(line, "joiningDate must be YYYY-MM-DD"); continue; }
        const data = { departmentId: dept, designation: r.designation, qualification: r.qualification || null, specialization: r.specialization || null, joiningDate: r.joiningDate ? new Date(`${r.joiningDate}T00:00:00Z`) : null };
        const existing = await db.faculty.findUnique({ where: { employeeId } });
        if (existing) {
          await db.faculty.update({ where: { id: existing.id }, data });
          await db.user.update({ where: { id: existing.userId }, data: { name: r.name, phone: r.phone || null } });
        } else {
          if (await db.user.findUnique({ where: { email }, select: { id: true } })) { skip(line, `email ${email} is already used by another account`); continue; }
          await db.user.create({ data: { name: r.name, email, phone: r.phone || null, role: "FACULTY", mustChangePassword: true, passwordHash: await bcrypt.hash(employeeId.toLowerCase(), 10), faculty: { create: { employeeId, ...data } } } });
        }
      } else if (kind === "fees") {
        const pid = programId.get(r.program.toUpperCase()), year = int(r.yearOfStudy, 1, 6), amount = num(r.amount.replace(/[₹,\s]/g, ""));
        if (!pid) { skip(line, `programme "${r.program}" does not exist — import programmes first`); continue; }
        if (!year) { skip(line, "yearOfStudy must be 1–6"); continue; }
        if (!/^\d{4}-\d{2}$/.test(r.academicYear)) { skip(line, "academicYear must look like 2026-27"); continue; }
        if (!(amount > 0)) { skip(line, "amount must be a positive number"); continue; }
        const key = `${pid}|${year}|${r.academicYear}`;
        const g = feeGroups.get(key) ?? { programId: pid, code: r.program.toUpperCase(), year, ay: r.academicYear, items: [] };
        g.items.push({ head: r.head, amount }); feeGroups.set(key, g);
        continue; // counted when the structure is written below
      }
      saved++;
    } catch (e) {
      console.error(e);
      skip(line, "could not be saved (duplicate or invalid value)");
    }
  }

  // Fee heads are grouped into one structure per programme, year and academic year.
  for (const g of feeGroups.values()) {
    const existing = await db.feeStructure.findFirst({ where: { programId: g.programId, yearOfStudy: g.year, academicYear: g.ay }, include: { _count: { select: { invoices: true } } } });
    if (existing?._count.invoices) { errors.push(`${g.code} year ${g.year} (${g.ay}): invoices were already raised from this structure, so it was left unchanged`); continue; }
    if (existing) await db.feeStructure.update({ where: { id: existing.id }, data: { items: { deleteMany: {}, create: g.items } } });
    else await db.feeStructure.create({ data: { name: `${g.code} — Year ${g.year} (${g.ay})`, programId: g.programId, yearOfStudy: g.year, academicYear: g.ay, items: { create: g.items } } });
    saved++;
  }

  await audit(me.id, "IMPORT", spec.label, undefined, `${saved} saved, ${errors.length} skipped`);
  revalidatePath("/admin/setup");
  const what = kind === "fees" ? "fee structure(s)" : "row(s)";
  if (errors.length) return { ok: saved > 0, message: saved ? `${saved} ${what} saved.` : undefined, error: `${errors.length} skipped — ${errors.slice(0, 6).join(" | ")}${errors.length > 6 ? " …" : ""}` };
  return { ok: true, message: `${saved} ${what} saved.` };
}
