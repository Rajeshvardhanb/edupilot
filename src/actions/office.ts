"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isOffice, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notifyRoles, notifyStudents } from "@/lib/notify";
import { PROFILE_FIELDS, type ProfileField } from "@/lib/profile-fields";
import type { ActionState } from "@/lib/action-state";

const text = (fd: FormData, k: string, max = 190) => String(fd.get(k) ?? "").trim().slice(0, max);

// ───────── Inventory ─────────
const CONDITIONS = ["GOOD", "NEEDS_REPAIR", "CONDEMNED"];

export async function saveAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "OFFICE"]);
  const id = text(fd, "id"), tag = text(fd, "tag", 60).toUpperCase(), name = text(fd, "name"), category = text(fd, "category", 60), location = text(fd, "location", 80);
  const quantity = Math.round(Number(fd.get("quantity")) || 1), condition = CONDITIONS.includes(text(fd, "condition")) ? text(fd, "condition") : "GOOD";
  if (!tag || !name || !category || !location) return { error: "Tag, name, category and location are required." };
  if (quantity < 1 || quantity > 100000) return { error: "Quantity must be at least 1." };
  // An HOD records assets of their own department only.
  const departmentId = me.role === "HOD" ? me.departmentId : text(fd, "departmentId") || null;
  const cost = Number(fd.get("cost")), bought = text(fd, "purchaseDate");
  const data = { tag, name, category, location, quantity, condition, departmentId, cost: cost > 0 ? cost : null, purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(bought) ? new Date(`${bought}T00:00:00Z`) : null, notes: text(fd, "notes", 500) || null };
  try {
    if (id) {
      const existing = await db.asset.findUnique({ where: { id }, include: { issues: { where: { returnedAt: null } } } });
      if (!existing || (me.role === "HOD" && existing.departmentId !== me.departmentId)) return { error: "Asset not found." };
      const out = existing.issues.reduce((t, i) => t + i.quantity, 0);
      if (quantity < out) return { error: `${out} of these are issued at the moment; the quantity can't be less than that.` };
      await db.asset.update({ where: { id }, data });
    } else await db.asset.create({ data });
  } catch {
    return { error: `The tag ${tag} is already used.`, fieldErrors: { tag: [`The tag ${tag} is already used.`] } };
  }
  await audit(me.id, id ? "UPDATE" : "CREATE", "Asset", id || tag, name);
  revalidatePath("/inventory");
  return { ok: true, message: id ? "Asset updated." : `${name} added.` };
}

export async function issueAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "OFFICE"]);
  const asset = await db.asset.findUnique({ where: { tag: text(fd, "tag", 60).toUpperCase() }, include: { issues: { where: { returnedAt: null } } } });
  if (!asset || (me.role === "HOD" && asset.departmentId !== me.departmentId)) return { error: "No asset has that tag.", fieldErrors: { tag: ["No asset has that tag."] } };
  if (asset.condition === "CONDEMNED") return { error: "This asset is condemned and can't be issued." };
  const quantity = Math.round(Number(fd.get("quantity")) || 1), issuedTo = text(fd, "issuedTo"), due = text(fd, "dueBack");
  const free = asset.quantity - asset.issues.reduce((t, i) => t + i.quantity, 0);
  if (!issuedTo) return { error: "Say who it is issued to." };
  if (quantity < 1 || quantity > free) return { error: free ? `Only ${free} available.` : "None are available: all are issued." };
  await db.assetIssue.create({ data: { assetId: asset.id, issuedTo, quantity, dueBack: /^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T00:00:00Z`) : null, byId: me.id } });
  await audit(me.id, "ISSUE", "Asset", asset.id, `${quantity} × ${asset.tag} to ${issuedTo}`);
  revalidatePath("/inventory");
  return { ok: true, message: `${quantity} × ${asset.name} issued to ${issuedTo}.` };
}

export async function returnAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD", "OFFICE"]);
  const issue = await db.assetIssue.findUnique({ where: { id: text(fd, "id") }, include: { asset: true } });
  if (!issue || issue.returnedAt || (me.role === "HOD" && issue.asset.departmentId !== me.departmentId)) return { error: "That issue was not found." };
  await db.assetIssue.update({ where: { id: issue.id }, data: { returnedAt: new Date() } });
  await audit(me.id, "RETURN", "Asset", issue.assetId, `${issue.quantity} × ${issue.asset.tag} from ${issue.issuedTo}`);
  revalidatePath("/inventory");
  return { ok: true, message: "Marked as returned." };
}

// ───────── Visitors ─────────
export async function signInVisitor(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const name = text(fd, "name"), phone = text(fd, "phone", 20), purpose = text(fd, "purpose"), toMeet = text(fd, "toMeet");
  if (!name || !purpose || !toMeet) return { error: "Name, purpose and who they are meeting are required." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter a 10-digit phone number.", fieldErrors: { phone: ["Enter a 10-digit phone number."] } };
  await db.visitor.create({ data: { name, phone, purpose, toMeet, idProof: text(fd, "idProof", 60) || null, byId: me.id } });
  revalidatePath("/gate");
  return { ok: true, message: `${name} signed in.` };
}

export async function signOutVisitor(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "OFFICE"]);
  await db.visitor.updateMany({ where: { id: text(fd, "id"), outAt: null }, data: { outAt: new Date() } });
  revalidatePath("/gate");
  return { ok: true };
}

// ───────── Gate passes ─────────
export async function requestGatePass(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const reason = text(fd, "reason"), out = text(fd, "outAt", 20), back = text(fd, "expectedBack", 20);
  const outAt = new Date(out), expectedBack = new Date(back);
  if (reason.length < 5) return { error: "Give a reason." };
  if (isNaN(outAt.getTime()) || isNaN(expectedBack.getTime())) return { error: "Choose when you will leave and when you will be back." };
  if (expectedBack <= outAt) return { error: "Must be after the time you leave.", fieldErrors: { expectedBack: ["Must be after the time you leave."] } };
  if (outAt.getTime() < Date.now() - 3600_000) return { error: "That time has passed.", fieldErrors: { outAt: ["That time has passed."] } };
  if (await db.gatePass.count({ where: { studentId: me.studentId!, status: { in: ["PENDING", "APPROVED", "OUT"] } } })) return { error: "You already have a gate pass that is waiting, approved or in use." };
  await db.gatePass.create({ data: { studentId: me.studentId!, reason, outAt, expectedBack } });
  await notifyRoles(["ADMIN", "OFFICE"], { title: `Gate pass requested by ${me.name}`, body: reason, href: "/gate" });
  revalidatePath("/gate");
  return { ok: true, message: "Request sent to the office." };
}

/** Office decisions and gate movements: approve or reject a request, mark the student out, mark them back. */
export async function updateGatePass(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const pass = await db.gatePass.findUnique({ where: { id: text(fd, "id") } });
  const to = text(fd, "to");
  const allowed: Record<string, string[]> = { PENDING: ["APPROVED", "REJECTED"], APPROVED: ["OUT", "REJECTED"], OUT: ["RETURNED"] };
  if (!pass || !allowed[pass.status]?.includes(to)) return { error: "That gate pass can't be changed that way." };
  await db.gatePass.update({ where: { id: pass.id }, data: { status: to, ...(to === "APPROVED" || to === "REJECTED" ? { decidedById: me.id } : {}), ...(to === "OUT" && { leftAt: new Date() }), ...(to === "RETURNED" && { returnedAt: new Date() }) } });
  if (to === "APPROVED" || to === "REJECTED") await notifyStudents([pass.studentId], { title: `Gate pass ${to === "APPROVED" ? "approved" : "not approved"}`, body: pass.reason, href: "/gate" });
  await audit(me.id, `GATE_${to}`, "GatePass", pass.id);
  revalidatePath("/gate");
  return { ok: true };
}

// ───────── Profile corrections ─────────

/** A student or parent asks for a contact detail to be corrected. Nothing changes until the office approves. */
export async function requestProfileChange(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT", "PARENT"]);
  if (!me.studentId) return { error: "No student record is linked to this account." };
  const field = text(fd, "field") as ProfileField, newValue = text(fd, "newValue", 300);
  if (!(field in PROFILE_FIELDS)) return { error: "Choose what should be corrected." };
  if (!newValue) return { error: "Enter the correct value." };
  if ((field === "phone" || field === "guardianPhone") && newValue.replace(/\D/g, "").length < 10) return { error: "Enter a 10-digit phone number.", fieldErrors: { newValue: ["Enter a 10-digit phone number."] } };
  if (field === "guardianEmail" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newValue)) return { error: "Enter a full email address.", fieldErrors: { newValue: ["Enter a full email address."] } };
  const s = await db.student.findUniqueOrThrow({ where: { id: me.studentId }, include: { user: { select: { phone: true } } } });
  const oldValue = field === "phone" ? s.user.phone : s[field];
  if ((oldValue ?? "") === newValue) return { error: "That is already what is on record." };
  if (await db.profileChange.count({ where: { studentId: s.id, field, status: "PENDING" } })) return { error: `A correction to the ${PROFILE_FIELDS[field].toLowerCase()} is already waiting for the office.` };
  await db.profileChange.create({ data: { studentId: s.id, field, oldValue, newValue, requestedById: me.id } });
  await notifyRoles(["ADMIN", "OFFICE"], { title: `Profile correction requested: ${s.rollNo}`, body: `${PROFILE_FIELDS[field]} → ${newValue}`, href: "/students/changes" });
  revalidatePath("/profile");
  return { ok: true, message: "Sent to the office. The record changes once they approve it." };
}

export async function decideProfileChange(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const c = await db.profileChange.findUnique({ where: { id: text(fd, "id") }, include: { student: { select: { userId: true } } } });
  if (!c || c.status !== "PENDING" || !isOffice(me)) return { error: "That request is no longer waiting." };
  const approve = fd.get("decision") === "approve";
  await db.$transaction([
    ...(approve ? [c.field === "phone" ? db.user.update({ where: { id: c.student.userId }, data: { phone: c.newValue } }) : db.student.update({ where: { id: c.studentId }, data: { [c.field]: c.newValue } })] : []),
    db.profileChange.update({ where: { id: c.id }, data: { status: approve ? "APPROVED" : "REJECTED", decidedById: me.id, decidedAt: new Date() } }),
  ]);
  await audit(me.id, approve ? "APPROVE" : "REJECT", "ProfileChange", c.id, `${c.field}: ${c.newValue}`);
  await notifyStudents([c.studentId], { title: `Profile correction ${approve ? "applied" : "not accepted"}`, body: `${PROFILE_FIELDS[c.field as ProfileField] ?? c.field}: ${c.newValue}`, href: "/profile" });
  revalidatePath("/students/changes");
  return { ok: true, message: approve ? "Applied to the student's record." : "Request rejected." };
}
