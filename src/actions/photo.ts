"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManagePhoto } from "@/lib/photo-policy";
import { MAX_PHOTO_BYTES, normalizeProfilePhoto } from "@/lib/profile-image";
import type { ActionState } from "@/lib/action-state";
async function photoTarget(id: string) {
  return db.user.findUnique({ where: { id }, select: { id: true, role: true, student: { select: { id: true, batch: { select: { program: { select: { departmentId: true } } } } } } } });
}
export async function uploadPhoto(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser(), id = String(form.get("userId") || me.id), target = await photoTarget(id);
  if (!target || !canManagePhoto(me, target)) return { error: "You cannot change this user's photo." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo must be 1 MB or smaller." };
  let photo: Uint8Array<ArrayBuffer>;
  try { photo = await normalizeProfilePhoto(new Uint8Array(await file.arrayBuffer())); }
  catch { return { error: "Choose a valid, still JPEG, PNG or WebP photo up to 1 MB (maximum 16 megapixels)." }; }
  try { await db.$transaction(async tx => {
    await tx.user.update({ where: { id }, data: { photo, photoType: "image/webp" } });
    await tx.auditLog.create({ data: { userId: me.id, action: "UPLOAD_PHOTO", entity: "User", entityId: id, details: "Profile photo uploaded/replaced." } });
  }); } catch { return { error: "Could not save your photo. Please refresh and try again." }; }
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo saved." };
}
export async function removePhoto(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser(), id = String(form.get("userId") || me.id), target = await photoTarget(id);
  if (!target || !canManagePhoto(me, target)) return { error: "You cannot remove this user's photo." };
  try { await db.$transaction(async tx => {
    await tx.user.update({ where: { id }, data: { photo: null, photoType: null } });
    await tx.auditLog.create({ data: { userId: me.id, action: "REMOVE_PHOTO", entity: "User", entityId: id, details: "Profile photo removed; other account and student records unchanged." } });
  }); } catch { return { error: "Could not remove your photo. Please refresh and try again." }; }
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo removed. Your initials will be displayed." };
}
