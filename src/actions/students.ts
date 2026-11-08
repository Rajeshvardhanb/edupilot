"use server";
import { notifyAcademic } from "@/lib/academic-email";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";

const opt = z.string().trim().optional().transform((v) => (v ? v : undefined));
const optDate = opt.pipe(z.iso.date().optional()).transform(v => v ? new Date(`${v}T00:00:00.000Z`) : undefined);

const StudentSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.email("Valid email required").transform((v) => v.toLowerCase()),
  phone: opt,
  rollNo: z.string().trim().min(3, "Roll number is required").transform((v) => v.toUpperCase()),
  batchId: z.string().min(1, "Select a batch"),
  admissionType: z.enum(["REGULAR", "LATERAL", "MANAGEMENT", "SPOT"]),
  admissionDate: z.iso.date("Enter a valid admission date").transform((v) => new Date(`${v}T00:00:00.000Z`)),
  dob: optDate,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().or(z.literal("").transform(() => undefined)),
  category: z.enum(["GENERAL", "OBC", "SC", "ST", "EWS"]),
  bloodGroup: opt,
  address: opt,
  guardianName: opt,
  guardianPhone: opt,
  guardianEmail: opt.pipe(z.email("Enter a valid guardian email").optional()),
  previousSchool: opt,
  previousScore: opt.transform((v) => (v ? Number(v) : undefined)).pipe(z.number().min(0).max(100).optional()),
  about: opt.pipe(z.string().max(1500).optional()), skills: opt.pipe(z.string().max(500).optional()),
  linkedin: opt.pipe(z.url().refine(v => /^https?:\/\//i.test(v), "Use an http:// or https:// link").optional()),
  github: opt.pipe(z.url().refine(v => /^https?:\/\//i.test(v), "Use an http:// or https:// link").optional()),
  status: z.enum(["ACTIVE", "DETAINED", "SUSPENDED", "DROPPED", "GRADUATED"]).default("ACTIVE"),
});

function uniqueError(e: unknown): ActionState | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = String((e.meta?.target as string[] | string) ?? "");
    if (target.includes("email")) return { fieldErrors: { email: ["This email is already registered"] } };
    if (target.includes("rollNo")) return { fieldErrors: { rollNo: ["This roll number already exists"] } };
    return { error: "A record with these details already exists." };
  }
  return null;
}

export async function createStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const parsed = StudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  const { name, email, phone, ...data } = parsed.data;
  const entrySemester = data.admissionType === "LATERAL" ? 3 : 1;
  let id: string;
  try {
    const user = await db.user.create({
      data: {
        name, email, phone, role: "STUDENT",
        passwordHash: await bcrypt.hash(data.rollNo.toLowerCase(), 10), mustChangePassword: true,
        student: { create: { ...data, entrySemester } },
      },
      include: { student: true },
    });
    id = user.student!.id;
  } catch (e) {
    return uniqueError(e) ?? { error: "Could not save the student." };
  }
  await audit(me.id, "CREATE", "Student", id, data.rollNo);
  notifyAcademic({ type: "account", id: (await db.student.findUniqueOrThrow({ where: { id }, select: { userId: true } })).userId });
  redirect(`/students/${id}?created=1`);
}

export async function updateStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const id = String(formData.get("id"));
  const parsed = StudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  const { name, email, phone, ...data } = parsed.data;
  if (!(await db.student.findUnique({ where: { id }, select: { id: true } }))) return { error: "Student not found." };
  try {
    await db.$transaction(async (tx) => {
      const st = await tx.student.update({ where: { id }, data: { ...data, dob: data.dob ?? null, gender: data.gender ?? null, bloodGroup: data.bloodGroup ?? null, address: data.address ?? null, guardianName: data.guardianName ?? null, guardianPhone: data.guardianPhone ?? null, guardianEmail: data.guardianEmail ?? null, previousSchool: data.previousSchool ?? null, previousScore: data.previousScore ?? null, about: data.about ?? null, skills: data.skills ?? null, linkedin: data.linkedin ?? null, github: data.github ?? null, entrySemester: data.admissionType === "LATERAL" ? 3 : 1 } });
      await tx.user.update({ where: { id: st.userId }, data: { name, email, phone: phone ?? null, isActive: data.status !== "DROPPED" } });
    });
  } catch (e) {
    return uniqueError(e) ?? { error: "Could not update the student." };
  }
  await audit(me.id, "UPDATE", "Student", id, data.rollNo);
  redirect(`/students/${id}`);
}

const CSV_HEADER = ["rollNo", "name", "email", "phone", "gender", "dob", "category", "admissionType", "guardianName", "guardianPhone"] as const;

export async function importStudents(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const batchId = String(formData.get("batchId") ?? "");
  const admissionDate = String(formData.get("admissionDate") ?? "");
  const file = formData.get("file");
  if (!batchId || !admissionDate) return { error: "Choose a batch and admission date." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to upload." };
  if (file.size > 2_000_000) return { error: "File too large (max 2 MB)." };

  const rows = parseCsv(await file.text());
  const header = rows.shift()?.map((h) => h.trim());
  if (!header || !["rollNo", "name", "email"].every((h) => header.includes(h)))
    return { error: `Header row must include rollNo, name, email. Expected: ${CSV_HEADER.join(",")}` };

  const errors: string[] = [];
  let created = 0;
  for (const [i, cells] of rows.entries()) {
    const rec = Object.fromEntries(header.map((h, j) => [h, cells[j]?.trim() ?? ""]));
    const parsed = StudentSchema.safeParse({
      ...rec, batchId, admissionDate, category: rec.category?.toUpperCase() || "GENERAL",
      admissionType: rec.admissionType?.toUpperCase() || "REGULAR", gender: rec.gender?.toUpperCase() || "",
    });
    if (!parsed.success) {
      errors.push(`Row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
      continue;
    }
    const { name, email, phone, ...data } = parsed.data;
    try {
      const imported = await db.user.create({
        data: {
          name, email, phone, role: "STUDENT", passwordHash: await bcrypt.hash(data.rollNo.toLowerCase(), 10), mustChangePassword: true,
          student: { create: { ...data, entrySemester: data.admissionType === "LATERAL" ? 3 : 1 } },
        },
      });
      notifyAcademic({ type: "account", id: imported.id });
      created++;
    } catch (e) {
      errors.push(`Row ${i + 2} (${data.rollNo}): ${uniqueError(e)?.fieldErrors ? "duplicate roll number or email" : "could not be saved"}`);
    }
  }
  await audit(me.id, "IMPORT", "Student", undefined, `${created} created, ${errors.length} failed`);
  revalidatePath("/students");
  if (errors.length) return { ok: created > 0, message: `${created} students imported.`, error: `${errors.length} rows skipped — ${errors.slice(0, 5).join(" | ")}${errors.length > 5 ? " …" : ""}` };
  return { ok: true, message: `${created} students imported. Initial password is each student's roll number in lowercase.` };
}

/** Bulk change from the student list: status or batch for many students at once. */
export async function bulkUpdateStudents(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean).slice(0, 500);
  const op = String(formData.get("op"));
  const value = String(formData.get("value") ?? "");
  if (!ids.length) return { error: "Select at least one student." };
  let n = 0;
  if (op === "status") {
    const status = z.enum(["ACTIVE", "DETAINED", "SUSPENDED", "DROPPED", "GRADUATED"]).safeParse(value);
    if (!status.success) return { error: "Choose a status." };
    n = (await db.student.updateMany({ where: { id: { in: ids } }, data: { status: status.data } })).count;
    await db.user.updateMany({ where: { student: { id: { in: ids } } }, data: { isActive: status.data !== "DROPPED" } });
  } else if (op === "batch") {
    if (!(await db.batch.findUnique({ where: { id: value } }))) return { error: "Choose a batch." };
    n = (await db.student.updateMany({ where: { id: { in: ids } }, data: { batchId: value } })).count;
  } else return { error: "Unknown action." };
  await audit(me.id, "BULK_UPDATE", "Student", undefined, `${op} → ${value} (${n} students)`);
  revalidatePath("/students");
  return { ok: true, message: `${n} student${n === 1 ? "" : "s"} updated.` };
}

/** Edit-in-place for contact details on the student profile. */
export async function updateStudentContact(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "OFFICE"]);
  const id = String(formData.get("studentId")), field = String(formData.get("field")), value = String(formData.get("value") ?? "").trim();
  const student = await db.student.findUnique({ where: { id } });
  if (!student) return { error: "Student not found." };
  if (field === "phone" || field === "guardianPhone") {
    if (value && !/^[\d+\- ]{7,15}$/.test(value)) return { error: "Enter a valid phone number." };
    if (field === "phone") await db.user.update({ where: { id: student.userId }, data: { phone: value || null } });
    else await db.student.update({ where: { id }, data: { guardianPhone: value || null } });
  } else if (field === "guardianEmail") {
    if (value && !z.email().safeParse(value).success) return { error: "Enter a valid email address." };
    await db.student.update({ where: { id }, data: { guardianEmail: value || null } });
  } else if (field === "guardianName" || field === "address") {
    await db.student.update({ where: { id }, data: { [field]: value.slice(0, 300) || null } });
  } else return { error: "This field cannot be edited here." };
  await audit(me.id, "UPDATE", "Student", id, field);
  revalidatePath(`/students/${id}`);
  return { ok: true };
}


/** Remove a student from the application while retaining academic and audit history. */
export async function deleteStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const student = await db.student.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!student) return { error: "Student not found." };
  await db.$transaction(async tx => {
    await tx.student.update({ where: { id }, data: { archivedAt: new Date() } });
    await tx.user.update({ where: { id: student.userId }, data: { isActive: false } });
    await tx.auditLog.create({ data: { userId: me.id, action: "DELETE", entity: "Student", entityId: id, details: `Archived ${student.rollNo}; academic history retained.` } });
  });
  revalidatePath("/", "layout");
  redirect("/students?deleted=1");
}
