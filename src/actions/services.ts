"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isOffice, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notifyRoles, notifyStudents, notifyUsers } from "@/lib/notify";
import type { ActionState } from "@/lib/action-state";

// ───────── Parent accounts ─────────
export async function createParentLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const studentId = String(fd.get("studentId"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId } });
  if (!z.email().safeParse(email).success) return { error: "Enter the parent's email address." };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.role !== "PARENT") return { error: "That email belongs to a staff or student account." };
  const temp = `Parent@${Math.random().toString(36).slice(2, 8)}`;
  const parent = existing ?? (await db.user.create({ data: { email, name: student.guardianName || "Parent", role: "PARENT", mustChangePassword: true, phone: student.guardianPhone, passwordHash: await bcrypt.hash(temp, 10) } }));
  await db.parentLink.upsert({ where: { userId_studentId: { userId: parent.id, studentId } }, create: { userId: parent.id, studentId }, update: {} });
  await audit(me.id, "CREATE", "ParentLogin", studentId, email);
  revalidatePath(`/students/${studentId}`);
  return { ok: true, message: existing ? `Linked existing parent account ${email}.` : `Parent login created: ${email} · temporary password ${temp}` };
}

// ───────── Certificates ─────────
export async function requestCertificate(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const type = z.enum(["BONAFIDE", "STUDY", "CONDUCT", "TRANSFER"]).safeParse(fd.get("type"));
  const purpose = String(fd.get("purpose") ?? "").trim();
  if (!type.success || purpose.length < 3) return { error: "Choose a certificate and state its purpose." };
  if (await db.certificateRequest.findFirst({ where: { studentId: me.studentId!, type: type.data, status: "PENDING" } })) return { error: "You already have a pending request for this certificate." };
  await db.certificateRequest.create({ data: { studentId: me.studentId!, type: type.data, purpose } });
  await notifyRoles(["ADMIN", "OFFICE"], { title: `Certificate requested by ${me.name}`, body: `${type.data.toLowerCase()} certificate: ${purpose}`, href: "/certificates" });
  revalidatePath("/certificates");
  return { ok: true, message: "Request sent to the office." };
}

export async function reviewCertificate(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const id = String(fd.get("id"));
  const decision = z.enum(["APPROVED", "REJECTED"]).parse(fd.get("decision"));
  const req = await db.certificateRequest.findUniqueOrThrow({ where: { id } });
  if (req.status !== "PENDING") return { error: "Already reviewed." };
  if (decision === "REJECTED") {
    await db.certificateRequest.update({ where: { id }, data: { status: "REJECTED", remarks: String(fd.get("remarks") ?? "") || null } });
  } else {
    const year = new Date().getFullYear(), prefix = `${req.type.slice(0, 3)}/${year}/`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const last = await db.certificateRequest.findFirst({ where: { serialNo: { startsWith: prefix } }, orderBy: { serialNo: "desc" } });
        await db.certificateRequest.update({ where: { id }, data: { status: "APPROVED", issuedAt: new Date(), serialNo: `${prefix}${String((last ? Number(last.serialNo!.split("/")[2]) : 0) + 1).padStart(4, "0")}` } });
        break;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") || attempt === 2) throw e;
      }
    }
  }
  await audit(me.id, decision, "Certificate", id, req.type);
  await notifyStudents([req.studentId], { title: decision === "APPROVED" ? "Your certificate is ready" : "Certificate request rejected", body: decision === "APPROVED" ? `Your ${req.type.toLowerCase()} certificate has been issued. You can view and print it from the portal.` : "Please contact the office for details.", href: decision === "APPROVED" ? `/certificates/${id}` : "/certificates", email: true });
  revalidatePath("/certificates");
  return { ok: true, message: decision === "APPROVED" ? "Certificate issued." : "Request rejected." };
}

/**
 * Issues the same certificate to every active student of a batch in one go (for example bonafide
 * certificates for a scholarship round), each with its own serial number, then opens them for printing.
 * A student who already holds this certificate for this purpose is not issued a second one.
 */
export async function issueBatchCertificates(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const batchId = String(fd.get("batchId")), purpose = String(fd.get("purpose") ?? "").trim().slice(0, 190);
  const type = z.enum(["BONAFIDE", "STUDY"]).parse(fd.get("type"));
  if (purpose.length < 3) return { error: "State the purpose, as it should appear on the certificate." };
  const students = await db.student.findMany({ where: { batchId, status: "ACTIVE", certificates: { none: { type, purpose, status: "APPROVED" } } }, select: { id: true }, orderBy: { rollNo: "asc" } });
  if (!students.length && !(await db.certificateRequest.count({ where: { type, purpose, status: "APPROVED", student: { batchId } } }))) return { error: "There are no active students in that batch." };
  const year = new Date().getFullYear(), prefix = `${type.slice(0, 3)}/${year}/`;
  const last = await db.certificateRequest.findFirst({ where: { serialNo: { startsWith: prefix } }, orderBy: { serialNo: "desc" } });
  let n = last ? Number(last.serialNo!.split("/")[2]) : 0;
  const now = new Date();
  await db.certificateRequest.createMany({ data: students.map((s) => ({ studentId: s.id, type, purpose, status: "APPROVED" as const, issuedAt: now, serialNo: `${prefix}${String(++n).padStart(4, "0")}` })) });
  await audit(me.id, "ISSUE_BATCH", "Certificate", batchId, `${students.length} × ${type}: ${purpose}`);
  redirect(`/certificates/batch/${batchId}?type=${type}&purpose=${encodeURIComponent(purpose)}`);
}

// ───────── Helpdesk ─────────
export async function openTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const subject = String(fd.get("subject") ?? "").trim(), body = String(fd.get("body") ?? "").trim(), category = String(fd.get("category") ?? "General");
  if (subject.length < 4 || body.length < 10) return { error: "Add a subject and describe the issue (at least 10 characters)." };
  await db.ticket.create({ data: { userId: me.id, subject: subject.slice(0, 150), body, category: category.slice(0, 40) } });
  await notifyRoles(["ADMIN", "OFFICE"], { title: `New helpdesk ticket: ${subject.slice(0, 80)}`, body: `${me.name} · ${category}`, href: "/helpdesk" });
  revalidatePath("/helpdesk");
  return { ok: true, message: "Ticket raised. You'll see replies here." };
}

export async function replyTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: String(fd.get("ticketId")) } });
  const staff = isOffice(me);
  if (!staff && ticket.userId !== me.id) return { error: "Not allowed." };
  const body = String(fd.get("body") ?? "").trim();
  const status = staff ? z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).safeParse(fd.get("status")) : null;
  if (!body && !status?.success) return { error: "Write a reply." };
  await db.$transaction([
    ...(body ? [db.ticketReply.create({ data: { ticketId: ticket.id, userId: me.id, body } })] : []),
    db.ticket.update({ where: { id: ticket.id }, data: { status: status?.success ? status.data : ticket.status === "RESOLVED" && !staff ? "OPEN" : ticket.status } }),
  ]);
  if (staff && ticket.userId !== me.id) await notifyUsers([ticket.userId], { title: `Update on your ticket: ${ticket.subject.slice(0, 80)}`, body: body || `Status changed to ${status?.success ? status.data.toLowerCase().replace("_", " ") : ticket.status.toLowerCase()}.`, href: `/helpdesk/${ticket.id}`, email: true });
  else if (!staff && body) await notifyRoles(["ADMIN", "OFFICE"], { title: `Reply on ticket: ${ticket.subject.slice(0, 80)}`, body, href: `/helpdesk/${ticket.id}` });
  revalidatePath(`/helpdesk/${ticket.id}`);
  return { ok: true, message: "Updated." };
}

// ───────── Student résumé profile ─────────
export async function saveResume(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const url = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v && /^https?:\/\//i.test(v) ? v.slice(0, 190) : v ? null : ""; };
  const linkedin = url("linkedin"), github = url("github");
  if (linkedin === null || github === null) return { error: "Links must start with http:// or https://" };
  await db.student.update({ where: { id: me.studentId! }, data: { about: String(fd.get("about") ?? "").trim().slice(0, 1500) || null, skills: String(fd.get("skills") ?? "").trim().slice(0, 500) || null, linkedin: linkedin || null, github: github || null } });
  revalidatePath("/placements");
  return { ok: true, message: "Profile saved. Recruiters see this with your application." };
}
