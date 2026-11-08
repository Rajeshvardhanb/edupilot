"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

export async function saveAlumni(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["ADMIN", "HOD"]);
  const studentId = String(fd.get("studentId"));
  const s = await db.student.findUnique({ where: { id: studentId }, include: { batch: { include: { program: true } } } });
  if (!s || s.status !== "GRADUATED") return { error: "Not a graduate." };
  const v = (k: string, max = 190) => String(fd.get(k) ?? "").trim().slice(0, max) || null;
  const linkedin = v("linkedin");
  if (linkedin && !/^https?:\/\//i.test(linkedin)) return { error: "LinkedIn link must start with http:// or https://" };
  const data = { company: v("company"), designation: v("designation"), location: v("location"), higherStudies: v("higherStudies"), personalEmail: v("personalEmail"), phone: v("phone", 20), linkedin };
  await db.alumniProfile.upsert({ where: { studentId }, create: { studentId, graduationYear: s.batch.admissionYear + s.batch.program.durationYears, ...data }, update: data });
  revalidatePath("/alumni");
  return { ok: true, message: "Alumni record updated." };
}
