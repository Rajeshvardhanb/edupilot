"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { CHILD_COOKIE, requireUser } from "@/lib/auth";
import { LANG_COOKIE, LANGS } from "@/lib/i18n";
import { ALERT_KINDS } from "@/lib/notify";
import type { ActionState } from "@/lib/action-state";

/** A parent with more than one child chooses whose records to view. */
export async function setChild(fd: FormData) {
  const me = await requireUser(["PARENT"]);
  const id = String(fd.get("child"));
  if (me.children.some((c) => c.id === id)) (await cookies()).set(CHILD_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}

export async function setLanguage(fd: FormData) {
  const lang = String(fd.get("lang"));
  if (lang in LANGS) (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Which dashboard sections a user has chosen to hide. */
export async function saveDashboardPrefs(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const all = String(fd.get("all") ?? "").split(",").filter(Boolean);
  const shown = new Set(fd.getAll("show").map(String));
  const hidden = all.filter((k) => !shown.has(k));
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { prefs: true } });
  const prefs = { ...((user.prefs as Record<string, unknown> | null) ?? {}), hiddenCards: hidden };
  await db.user.update({ where: { id: me.id }, data: { prefs } });
  revalidatePath("/dashboard");
  return { ok: true, message: "Dashboard updated." };
}

/** Which kinds of alert are also sent by email. Unticked kinds are stored as muted. */
export async function saveNotificationPrefs(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const on = new Set(fd.getAll("email").map(String));
  const mutedEmail = Object.keys(ALERT_KINDS).filter((k) => !on.has(k));
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { prefs: true } });
  await db.user.update({ where: { id: me.id }, data: { prefs: { ...((user.prefs as Record<string, unknown> | null) ?? {}), mutedEmail } } });
  revalidatePath("/profile");
  return { ok: true, message: mutedEmail.length ? `Saved. Email is off for ${mutedEmail.length} kind${mutedEmail.length === 1 ? "" : "s"} of alert; they still appear under the bell.` : "Saved. Every kind of alert is also emailed." };
}
