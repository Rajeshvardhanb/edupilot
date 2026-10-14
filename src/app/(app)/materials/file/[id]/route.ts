import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { offeringScope } from "@/lib/scope";

/** Downloads a study-material file (?kind=material) or a student's submission (?kind=submission). */
export async function GET(req: NextRequest, ctx: RouteContext<"/materials/file/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const staff = ["ADMIN", "HOD", "FACULTY"].includes(user.role);
  let row: { file: Uint8Array | null; fileName: string | null; fileType: string | null } | null = null;

  if (req.nextUrl.searchParams.get("kind") === "submission") {
    // The submitting student, or staff who manage that course.
    row = await db.submission.findFirst({
      where: { id, ...(staff ? { material: { offering: offeringScope(user) } } : { studentId: user.studentId ?? "-" }) },
      select: { file: true, fileName: true, fileType: true },
    });
  } else {
    const student = user.studentId ? await db.student.findUnique({ where: { id: user.studentId }, select: { batchId: true } }) : null;
    row = await db.material.findFirst({
      where: { id, offering: staff ? offeringScope(user) : { batchId: student?.batchId ?? "-" } },
      select: { file: true, fileName: true, fileType: true },
    });
  }
  if (!row?.file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(row.file), {
    headers: {
      // Always download: uploaded files are never rendered inline in the app's origin.
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(row.fileName ?? "file").replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
