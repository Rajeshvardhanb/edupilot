"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CHILD_COOKIE,requireUser } from "@/lib/auth";

export async function setChild(fd: FormData) {
  const me = await requireUser(["PARENT"]);
  const id = String(fd.get("child"));
  if (me.children.some((c) => c.id === id)) (await cookies()).set(CHILD_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}
