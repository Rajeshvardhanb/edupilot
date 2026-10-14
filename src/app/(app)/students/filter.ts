import type { Prisma, StudentStatus } from "@prisma/client";
import type { Tone } from "@/components/ui";

export const STATUS_TONE: Record<StudentStatus, Tone> = { ACTIVE: "success", DETAINED: "danger", SUSPENDED: "warning", DROPPED: "neutral", GRADUATED: "info" };

export function studentFilter(sp: Record<string, string | string[] | undefined>): Prisma.StudentWhereInput {
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  return {
    ...(q && { OR: [{ rollNo: { contains: q } }, { user: { name: { contains: q } } }, { user: { email: { contains: q } } }, { user: { phone: { contains: q } } }] }),
    ...(typeof sp.program === "string" && sp.program && { batch: { programId: sp.program } }),
    ...(typeof sp.dept === "string" && sp.dept && !sp.program && { batch: { program: { departmentId: sp.dept } } }),
    ...(typeof sp.batch === "string" && sp.batch && { batchId: sp.batch }),
    // The list opens on current students; "ALL" shows every status (graduated, dropped out…).
    ...(sp.status === undefined ? { status: "ACTIVE" as StudentStatus } : typeof sp.status === "string" && sp.status && sp.status !== "ALL" && { status: sp.status as StudentStatus }),
    ...(typeof sp.type === "string" && sp.type && { admissionType: sp.type as Prisma.EnumAdmissionTypeFilter["equals"] }),
  };
}
