"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { forgetInstitution, getInstitution } from "@/lib/institution";
import { invoiceStatus } from "@/lib/fees";
import { recalculateLateFines } from "@/lib/fines";
import { notifyStudents } from "@/lib/notify";
import type { ActionState } from "@/lib/action-state";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const today = () => day(new Date().toISOString().slice(0, 10));
const isoRe = /^\d{4}-\d{2}-\d{2}$/;
const str = (fd: FormData, k: string, max = 190) => String(fd.get(k) ?? "").trim().slice(0, max);

// ───────── Admissions pipeline ─────────
export async function saveEnquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const name = str(fd, "name"), phone = str(fd, "phone", 20), follow = str(fd, "followUpDate");
  if (name.length < 2 || !/^[\d+\- ]{7,15}$/.test(phone)) return { error: "Enter the applicant's name and a valid phone number." };
  await db.enquiry.create({ data: { name, phone, email: str(fd, "email") || null, programId: str(fd, "programId") || null, source: str(fd, "source") || null, notes: str(fd, "notes", 1000) || null, followUpDate: isoRe.test(follow) ? day(follow) : null, ownerId: me.id } });
  revalidatePath("/admissions");
  return { ok: true, message: "Enquiry added." };
}

export async function moveEnquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const stage = z.enum(["ENQUIRY", "APPLIED", "DOCUMENTS", "ADMITTED", "LOST"]).parse(fd.get("stage"));
  const id = String(fd.get("id")), follow = str(fd, "followUpDate");
  await db.enquiry.update({ where: { id }, data: { stage, ...(fd.has("followUpDate") && { followUpDate: isoRe.test(follow) ? day(follow) : null }), ...(fd.has("notes") && { notes: str(fd, "notes", 1000) || null }) } });
  await audit(me.id, "STAGE", "Enquiry", id, stage);
  revalidatePath("/admissions");
  return { ok: true };
}

// ───────── Scholarships ─────────
export async function saveScholarship(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const student = await db.student.findUnique({ where: { rollNo: str(fd, "rollNo").toUpperCase() } });
  const amount = Number(fd.get("amount")), scheme = str(fd, "scheme"), academicYear = str(fd, "academicYear", 9);
  if (!student) return { error: "No student with that roll number." };
  if (!scheme || !(amount > 0) || !/^\d{4}-\d{2}$/.test(academicYear)) return { error: "Enter the scheme, amount and academic year (e.g. 2026-27)." };
  const s = await db.scholarship.create({ data: { studentId: student.id, scheme, academicYear, amount, reference: str(fd, "reference") || null } });
  await audit(me.id, "CREATE", "Scholarship", s.id, `${student.rollNo} ₹${amount}`);
  revalidatePath("/scholarships");
  return { ok: true, message: "Scholarship claim recorded." };
}

/** Moving a claim to RECEIVED credits the amount to the student's oldest unpaid invoice as a SCHOLARSHIP payment. */
export async function setScholarshipStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const status = z.enum(["APPLIED", "SANCTIONED", "RECEIVED", "REJECTED"]).parse(fd.get("status"));
  const s = await db.scholarship.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  if (s.status === "RECEIVED") return { error: "This claim is already received and credited." };
  let note = "";
  if (status === "RECEIVED") {
    const invoices = await db.feeInvoice.findMany({ where: { studentId: s.studentId }, include: { payments: true, instalments: true }, orderBy: { dueDate: "asc" } });
    const target = invoices.find((i) => invoiceStatus(i).balance > 0);
    if (target) {
      const credit = Math.min(s.amount, invoiceStatus(target).balance);
      const year = new Date().getFullYear();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const last = await db.payment.findFirst({ where: { receiptNo: { startsWith: `RCPT-${year}-` } }, orderBy: { receiptNo: "desc" } });
          await db.payment.create({ data: { receiptNo: `RCPT-${year}-${String((last ? Number(last.receiptNo.slice(-5)) : 0) + 1).padStart(5, "0")}`, invoiceId: target.id, amount: credit, mode: "SCHOLARSHIP", reference: s.reference ?? s.scheme, collectedById: me.id } });
          note = ` ₹${credit} credited to invoice ${target.invoiceNo}.`;
          break;
        } catch (e) {
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") || attempt === 2) throw e;
        }
      }
    } else note = " No unpaid invoice to credit.";
  }
  await db.scholarship.update({ where: { id: s.id }, data: { status } });
  await audit(me.id, status, "Scholarship", s.id);
  revalidatePath("/scholarships");
  return { ok: true, message: `Marked ${status.toLowerCase()}.${note}` };
}

// ───────── Instalments & late fines ─────────
export async function setInstalments(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const inv = await db.feeInvoice.findUniqueOrThrow({ where: { id: String(fd.get("invoiceId")) } });
  const n = Number(fd.get("count")), first = str(fd, "firstDue"), gap = Number(fd.get("gapDays")) || 30;
  if (n === 0) {
    await db.instalment.deleteMany({ where: { invoiceId: inv.id } });
    revalidatePath(`/fees/${inv.id}`);
    return { ok: true, message: "Instalment plan removed." };
  }
  if (!(n >= 2 && n <= 12) || !isoRe.test(first)) return { error: "Choose 2–12 instalments and the first due date." };
  const total = inv.amount - inv.concession;
  const each = Math.floor(total / n);
  const rows = Array.from({ length: n }, (_, i) => ({ invoiceId: inv.id, dueDate: new Date(day(first).getTime() + i * gap * 864e5), amount: i === n - 1 ? total - each * (n - 1) : each }));
  await db.$transaction([db.instalment.deleteMany({ where: { invoiceId: inv.id } }), db.instalment.createMany({ data: rows }), db.feeInvoice.update({ where: { id: inv.id }, data: { dueDate: rows.at(-1)!.dueDate } })]);
  await audit(me.id, "INSTALMENTS", "FeeInvoice", inv.id, `${n} instalments`);
  revalidatePath(`/fees/${inv.id}`);
  return { ok: true, message: `Split into ${n} instalments.` };
}

/** Recalculates late fines now (they are also brought up to date automatically once a day). */
export async function applyLateFines(): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "ACCOUNTANT"]);
  const touched = await recalculateLateFines();
  if (touched === null) return { error: "Set a late fine per day under Administration → Settings first." };
  await audit(me.id, "LATE_FINES", "FeeInvoice", undefined, `${touched} invoices`);
  revalidatePath("/fees");
  return { ok: true, message: `Late fines updated on ${touched} overdue invoice(s).` };
}
export async function applyLateFinesAction(...args: [ActionState, FormData]): Promise<ActionState> {
  void args;
  return applyLateFines();
}

export async function waiveFine(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const id = String(fd.get("invoiceId"));
  await db.feeInvoice.update({ where: { id }, data: { fineWaived: true } });
  await audit(me.id, "WAIVE_FINE", "FeeInvoice", id);
  revalidatePath(`/fees/${id}`);
  return { ok: true, message: "Late fine waived." };
}

// ───────── Library ─────────
export async function saveBook(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "OFFICE"]);
  const title = str(fd, "title"), author = str(fd, "author"), copies = Number(fd.get("copies")) || 1;
  if (!title || !author) return { error: "Title and author are required." };
  try { await db.book.create({ data: { title, author, isbn: str(fd, "isbn", 20) || null, category: str(fd, "category", 60) || null, copies } }); }
  catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "A book with this ISBN already exists." }; throw e; }
  revalidatePath("/library");
  return { ok: true, message: "Book added to the catalogue." };
}

export async function issueBook(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const book = await db.book.findUniqueOrThrow({ where: { id: String(fd.get("bookId")) }, include: { _count: { select: { issues: { where: { returnedOn: null } } } } } });
  if (book._count.issues >= book.copies) return { error: "No copies available." };
  const key = str(fd, "member");
  const member = await db.user.findFirst({ where: { OR: [{ email: key.toLowerCase() }, { student: { rollNo: key.toUpperCase() } }, { faculty: { employeeId: key.toUpperCase() } }] } });
  if (!member) return { error: "No member with that roll number, employee ID or email." };
  if ((await db.bookIssue.count({ where: { userId: member.id, returnedOn: null } })) >= 3) return { error: `${member.name} already has 3 books.` };
  const t = today();
  await db.bookIssue.create({ data: { bookId: book.id, userId: member.id, issuedOn: t, dueOn: new Date(t.getTime() + 14 * 864e5) } });
  await audit(me.id, "ISSUE", "Book", book.id, member.email);
  revalidatePath("/library");
  return { ok: true, message: `Issued to ${member.name}. Due in 14 days.` };
}

export async function returnBook(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const issue = await db.bookIssue.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
  const t = today();
  const lateDays = Math.max(0, Math.floor((t.getTime() - issue.dueOn.getTime()) / 864e5));
  await db.bookIssue.update({ where: { id: issue.id }, data: { returnedOn: t, fine: lateDays * 2 } });
  await audit(me.id, "RETURN", "Book", issue.bookId);
  revalidatePath("/library");
  return { ok: true, message: lateDays ? `Returned ${lateDays} day(s) late. Fine ₹${lateDays * 2}.` : "Returned on time." };
}

// ───────── Hostel ─────────
export async function saveHostelRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "OFFICE"]);
  const hostelName = str(fd, "hostel"), number = str(fd, "number", 10), capacity = Number(fd.get("capacity")) || 3;
  if (!hostelName || !number) return { error: "Enter hostel and room number." };
  const hostel = await db.hostel.upsert({ where: { name: hostelName }, create: { name: hostelName, kind: str(fd, "kind", 10) || "Boys", messFee: Number(fd.get("messFee")) || 0 }, update: {} });
  await db.hostelRoom.upsert({ where: { hostelId_number: { hostelId: hostel.id, number } }, create: { hostelId: hostel.id, number, capacity }, update: { capacity } });
  revalidatePath("/hostel");
  return { ok: true, message: "Room saved." };
}

export async function allotRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const student = await db.student.findUnique({ where: { rollNo: str(fd, "rollNo").toUpperCase() } });
  if (!student) return { error: "No student with that roll number." };
  const room = await db.hostelRoom.findUniqueOrThrow({ where: { id: String(fd.get("roomId")) }, include: { hostel: true, _count: { select: { allocations: { where: { vacatedOn: null } } } } } });
  if (room._count.allocations >= room.capacity) return { error: "That room is full." };
  if (student.gender && ((room.hostel.kind === "Girls") !== (student.gender === "FEMALE"))) return { error: `${room.hostel.name} is a ${room.hostel.kind.toLowerCase()} hostel.` };
  if (await db.hostelAllocation.findFirst({ where: { studentId: student.id, vacatedOn: null } })) return { error: "This student already has a room. Vacate it first." };
  await db.hostelAllocation.create({ data: { roomId: room.id, studentId: student.id, fromDate: today() } });
  await audit(me.id, "ALLOT", "HostelRoom", room.id, student.rollNo);
  revalidatePath("/hostel");
  return { ok: true, message: `Allotted ${room.hostel.name} · ${room.number}.` };
}

export async function vacateRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "OFFICE"]);
  await db.hostelAllocation.update({ where: { id: String(fd.get("id")) }, data: { vacatedOn: today() } });
  revalidatePath("/hostel");
  return { ok: true, message: "Room vacated." };
}

// ───────── Transport ─────────
export async function saveRoute(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "OFFICE"]);
  const name = str(fd, "name");
  if (!name) return { error: "Route name is required." };
  // Stops: one per line, "Stop name, 07:45"
  const stops = String(fd.get("stops") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const m = /^(.+?)[,\-–]\s*(\d{1,2}:\d{2})$/.exec(l);
    return m ? { name: m[1].trim(), pickup: m[2].padStart(5, "0"), position: i } : null;
  });
  if (stops.some((s) => !s)) return { error: "Each stop must look like “Kukatpally, 07:45”." };
  const data = { vehicleNo: str(fd, "vehicleNo", 20) || null, driver: str(fd, "driver") || null, phone: str(fd, "phone", 20) || null, fee: Number(fd.get("fee")) || 0 };
  const route = await db.transportRoute.upsert({ where: { name }, create: { name, ...data }, update: data });
  if (stops.length) await db.$transaction([db.transportStop.deleteMany({ where: { routeId: route.id } }), db.transportStop.createMany({ data: (stops as { name: string; pickup: string; position: number }[]).map((s) => ({ ...s, routeId: route.id })) })]);
  revalidatePath("/transport");
  return { ok: true, message: "Route saved." };
}

export async function assignPass(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const student = await db.student.findUnique({ where: { rollNo: str(fd, "rollNo").toUpperCase() } });
  if (!student) return { error: "No student with that roll number." };
  const stop = await db.transportStop.findUnique({ where: { id: String(fd.get("stopId")) } });
  if (!stop) return { error: "Choose a stop." };
  await db.transportPass.upsert({ where: { studentId: student.id }, create: { studentId: student.id, routeId: stop.routeId, stopId: stop.id }, update: { routeId: stop.routeId, stopId: stop.id } });
  await audit(me.id, "PASS", "Transport", stop.routeId, student.rollNo);
  revalidatePath("/transport");
  return { ok: true, message: "Bus pass issued." };
}

export async function cancelPass(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "OFFICE"]);
  await db.transportPass.delete({ where: { studentId: String(fd.get("studentId")) } });
  revalidatePath("/transport");
  return { ok: true, message: "Pass cancelled." };
}

// ───────── Placement rounds ─────────
export async function saveRounds(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  const driveId = String(fd.get("driveId"));
  const names = String(fd.get("rounds") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8);
  if (!names.length) return { error: "List at least one round." };
  await db.$transaction([db.driveRound.deleteMany({ where: { driveId } }), db.driveRound.createMany({ data: names.map((name, i) => ({ driveId, name, position: i + 1 })) })]);
  revalidatePath(`/placements/${driveId}`);
  return { ok: true, message: "Interview rounds saved." };
}

export async function advanceRound(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  const app = await db.placementApplication.findUniqueOrThrow({ where: { id: String(fd.get("id")) }, include: { drive: { include: { _count: { select: { rounds: true } } } } } });
  const total = app.drive._count.rounds;
  if (fd.get("result") === "fail") await db.placementApplication.update({ where: { id: app.id }, data: { status: "REJECTED" } });
  else {
    const roundNo = Math.min(total, app.roundNo + 1);
    await db.placementApplication.update({ where: { id: app.id }, data: { roundNo, status: roundNo >= total ? "SELECTED" : "SHORTLISTED" } });
    if (roundNo >= total) {
      const drive = await db.placementDrive.findUniqueOrThrow({ where: { id: app.driveId }, include: { company: true } });
      await notifyStudents([app.studentId], { title: `Congratulations! Selected by ${drive.company.name}`, body: `${drive.role} · ${drive.ctcLpa} LPA`, href: "/placements", email: true });
    }
  }
  revalidatePath(`/placements/${app.driveId}`);
  return { ok: true };
}

// ───────── Institution settings & branding ─────────
export async function saveInstitution(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const name = str(fd, "name"), shortName = str(fd, "shortName", 30), brandColor = str(fd, "brandColor", 7);
  if (name.length < 3 || !shortName) return { error: "College name and short name are required." };
  if (!/^#[0-9a-f]{6}$/i.test(brandColor)) return { error: "Pick a brand colour." };
  const data: Prisma.InstitutionUpdateInput = {
    name, shortName, brandColor, tagline: str(fd, "tagline"), affiliation: str(fd, "affiliation"), address: str(fd, "address"), phone: str(fd, "phone", 30),
    email: str(fd, "email"), principalName: str(fd, "principalName"),
    lateFinePerDay: Math.max(0, Number(fd.get("lateFinePerDay")) || 0), lateFineMax: Math.max(0, Number(fd.get("lateFineMax")) || 0),
    supplementaryFee: Math.max(0, Number(fd.get("supplementaryFee")) || 0),
  };
  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 500_000) return { error: "Logo must be under 500 KB." };
    const b = new Uint8Array(await logo.arrayBuffer());
    const type = b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b[0] === 0x52 && b[8] === 0x57 ? "image/webp" : null;
    if (!type) return { error: "Logo must be a PNG, JPEG or WebP image." };
    data.logo = b; data.logoType = type;
  }
  if (fd.get("removeLogo") === "on") { data.logo = null; data.logoType = null; }
  await getInstitution();
  await db.institution.update({ where: { id: 1 }, data });
  forgetInstitution();
  await audit(me.id, "UPDATE", "Institution", "1", name);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. Receipts, hall tickets and certificates now use these details." };
}
