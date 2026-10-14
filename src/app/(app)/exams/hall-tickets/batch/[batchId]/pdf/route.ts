import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, programScope } from "@/lib/scope";
import { hallTicketStatus } from "@/lib/eligibility";
import { drawHallTicket } from "@/lib/hall-ticket";
import { batchLabel } from "@/lib/format";
import { Doc, pdfResponse } from "@/lib/pdf";

/** Every eligible student's hall ticket for a batch, one per page, as a single PDF to print in one go. */
export async function GET(_: Request, ctx: RouteContext<"/exams/hall-tickets/batch/[batchId]/pdf">) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "HOD"].includes(user.role)) return new Response("Forbidden", { status: 403 });
  const { batchId } = await ctx.params;
  const batch = await db.batch.findFirst({ where: { id: batchId, program: programScope(user) }, include: { program: true } });
  if (!batch) return new Response("Not found", { status: 404 });
  const term = await currentTerm();
  const students = await db.student.findMany({ where: { batchId, status: "ACTIVE" }, include: { user: { select: { name: true } }, batch: { include: { program: true } } }, orderBy: { rollNo: "asc" } });
  const status = await hallTicketStatus(students.map((s) => s.id), term?.id);
  const eligible = students.filter((s) => status.get(s.id)?.eligible);
  if (!eligible.length) return new Response("No student in this batch is eligible for a hall ticket yet.", { status: 409 });
  const doc = await Doc.create();
  for (const [i, s] of eligible.entries()) {
    if (i > 0) doc.addPage();
    await drawHallTicket(doc, s, status.get(s.id)!, term);
  }
  return pdfResponse(await doc.finish(), `hall-tickets-${batchLabel(batch).replace(/\s+/g, "-")}.pdf`);
}
