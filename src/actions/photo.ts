"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isOffice, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";

const MAX = 1_000_000;

/** Sniff the real image type from magic bytes instead of trusting the browser. */
function imageType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Users update their own photo; admins may set anyone's (e.g. from the admission desk). */
export async function uploadPhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const userId = String(fd.get("userId") || me.id);
  if (userId !== me.id && !isOffice(me)) return { error: "Not allowed." };
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  if (file.size > MAX) return { error: "Image must be under 1 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return { error: "Only JPEG, PNG or WebP images are allowed." };
  await db.user.update({ where: { id: userId }, data: { photo: bytes, photoType: type } });
  await audit(me.id, "UPLOAD_PHOTO", "User", userId);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo updated." };
}

export async function removePhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const userId = String(fd.get("userId") || me.id);
  if (userId !== me.id && !isOffice(me)) return { error: "Not allowed." };
  await db.user.update({ where: { id: userId }, data: { photo: null, photoType: null } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo removed." };
}
