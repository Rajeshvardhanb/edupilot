"use server";
import { notifyAcademic } from "@/lib/academic-email";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { forgetInstitution,getInstitution } from "@/lib/institution";
import type { ActionState } from "@/lib/action-state";

const str = (fd: FormData, key: string, max = 190) => String(fd.get(key) ?? "").trim().slice(0, max);

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
  }
  notifyAcademic({ type: "placement-status", id: app.id });
  revalidatePath(`/placements/${app.driveId}`);
  return { ok: true };
}

export async function saveInstitution(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const name = str(fd, "name"), shortName = str(fd, "shortName", 30), brandColor = str(fd, "brandColor", 7);
  if (name.length < 3 || !shortName) return { error: "College name and short name are required." };
  if (!/^#[0-9a-f]{6}$/i.test(brandColor)) return { error: "Pick a brand colour." };
  const data: Prisma.InstitutionUpdateInput = {
    name, shortName, brandColor, tagline: str(fd, "tagline"), affiliation: str(fd, "affiliation"), address: str(fd, "address"), phone: str(fd, "phone", 30),
    email: str(fd, "email"), principalName: str(fd, "principalName"),
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
  return { ok: true, message: "Settings saved. Academic documents now use these details." };
}
