import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentTerm, studentScope } from "@/lib/scope";
import { hallTicketStatus } from "@/lib/eligibility";
import { drawHallTicket } from "@/lib/hall-ticket";
import { Doc, pdfResponse } from "@/lib/pdf";

export async function GET(_: Request, ctx: RouteContext<"/exams/hall-tickets/[studentId]/pdf">) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "HOD", "STUDENT"].includes(user.role)) return new Response("Forbidden", { status: 403 });
  const { studentId } = await ctx.params;
  const s = await db.student.findFirst({ where: { AND: [{ id: studentId }, studentScope(user)] }, include: { user: { select: { name: true } }, batch: { include: { program: true } } } });
  if (!s) return new Response("Not found", { status: 404 });
  const term = await currentTerm();
  const st = (await hallTicketStatus([s.id], term?.id)).get(s.id)!;
  if (!st.eligible) return new Response(`Hall ticket withheld: ${st.reasons.join("; ")}`, { status: 409 });
  const doc = await Doc.create();
  await drawHallTicket(doc, s, st, term);
  return pdfResponse(await doc.finish(), `hall-ticket-${s.rollNo}.pdf`);
}
