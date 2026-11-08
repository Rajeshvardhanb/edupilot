"use server";
import { notifyAcademic } from "@/lib/academic-email";

import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ineligibility } from "@/lib/placements";
import { studentStandings } from "@/lib/results";
import { getRules } from "@/lib/rules";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const DriveSchema = z.object({
  company: z.string().trim().min(2, "Company is required"),
  industry: z.string().trim().optional(),
  role: z.string().trim().min(2),
  ctcLpa: z.coerce.number().positive().max(200),
  driveDate: z.iso.date(),
  minCgpa: z.coerce.number().min(0).max(10),
  maxBacklogs: z.coerce.number().int().min(0).max(20),
  description: z.string().trim().optional(),
});

export async function createDrive(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const p = DriveSchema.safeParse(Object.fromEntries(fd));
  const levels = fd.getAll("levels").map(String).filter((l) => ["DIPLOMA", "UG", "PG"].includes(l));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!levels.length) return { error: "Select at least one eligible programme level." };
  const { company, industry, driveDate, ...data } = p.data;
  const c = await db.company.upsert({ where: { name: company }, create: { name: company, industry }, update: industry ? { industry } : {} });
  const d = await db.placementDrive.create({ data: { ...data, companyId: c.id, driveDate: new Date(`${driveDate}T00:00:00Z`), eligibleLevels: levels.join(","), status: "OPEN" } });
  await audit(me.id, "CREATE", "PlacementDrive", d.id, `${company} ${data.role}`);
  notifyAcademic({ type: "placement-open", id: d.id });
  revalidatePath("/placements");
  return { ok: true, message: "Drive published. Eligible students can now apply." };
}

export async function setDriveStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const id = String(fd.get("id"));
  const status = z.enum(["UPCOMING", "OPEN", "CLOSED", "COMPLETED"]).parse(fd.get("status"));
  await db.placementDrive.update({ where: { id }, data: { status } });
  await audit(me.id, "STATUS", "PlacementDrive", id, status);
  if (status === "OPEN") notifyAcademic({ type: "placement-open", id });
  revalidatePath(`/placements/${id}`);
  return { ok: true };
}

export async function applyToDrive(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const drive = await db.placementDrive.findUniqueOrThrow({ where: { id: String(fd.get("driveId")) } });
  if (drive.status !== "OPEN") return { error: "Applications are closed for this drive." };
  const s = await db.student.findUniqueOrThrow({ where: { id: me.studentId! }, include: { batch: { include: { program: true } } } });
  const st = (await studentStandings([s.id])).get(s.id)!;
  const reason = ineligibility(drive, s, st, (await getRules()).placementSemestersLeft);
  if (reason) return { error: `Not eligible: ${reason}.` };
  const application = await db.placementApplication.upsert({ where: { driveId_studentId: { driveId: drive.id, studentId: s.id } }, create: { driveId: drive.id, studentId: s.id }, update: {} });
  await audit(me.id, "APPLY", "PlacementDrive", drive.id);
  notifyAcademic({ type: "placement-application", id: application.id });
  revalidatePath("/placements");
  return { ok: true, message: "Applied successfully." };
}

export async function withdrawApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["STUDENT"]);
  const driveId = String(fd.get("driveId"));
  const app = await db.placementApplication.findUnique({ where: { driveId_studentId: { driveId, studentId: me.studentId! } } });
  if (!app || app.status !== "APPLIED") return { error: "Only pending applications can be withdrawn." };
  await db.placementApplication.delete({ where: { id: app.id } });
  revalidatePath("/placements");
  return { ok: true };
}

export async function setApplicationStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "HOD"]);
  const id = String(fd.get("id"));
  const status = z.enum(["APPLIED", "SHORTLISTED", "SELECTED", "REJECTED"]).parse(fd.get("status"));
  const a = await db.placementApplication.update({ where: { id }, data: { status } });
  await audit(me.id, "STATUS", "PlacementApplication", id, status);
  notifyAcademic({ type: "placement-status", id: a.id });
  revalidatePath(`/placements/${a.driveId}`);
  return { ok: true };
}
