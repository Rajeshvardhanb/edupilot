import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentStandings } from "@/lib/results";
import { CERT_TITLE, certificateText } from "@/lib/certificates";
import { fmtDate } from "@/lib/format";
import { Doc, pdfResponse } from "@/lib/pdf";

export async function GET(_: Request, ctx: RouteContext<"/certificates/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "STUDENT"].includes(user.role)) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const c = await db.certificateRequest.findFirst({
    where: { id, status: "APPROVED", ...(user.role === "STUDENT" && { studentId: user.studentId ?? "-" }) },
    include: { student: { include: { user: { select: { name: true } }, batch: { include: { program: { include: { department: true } } } } } } },
  });
  if (!c) return new Response("Not found", { status: 404 });
  const cgpa = (await studentStandings([c.studentId])).get(c.studentId)!.cgpa;
  const doc = await Doc.create();
  const inst = await doc.letterhead(`Date: ${fmtDate(c.issuedAt)}`, c.serialNo ?? undefined);
  doc.space(30);
  doc.text(CERT_TITLE[c.type].toUpperCase(), { size: 16, bold: true, align: "center" });
  doc.space(50);
  doc.paragraph(certificateText(c, cgpa), { size: 12, leading: 24 });
  doc.space(90);
  doc.text(`Date: ${fmtDate(c.issuedAt)}`, { size: 10 });
  doc.text(inst.principalName || "Principal", { size: 11, bold: true, align: "right" });
  doc.space(15);
  doc.text(`Principal, ${inst.name}`, { size: 9, align: "right" });
  doc.space(13);
  doc.text("(Seal & signature)", { size: 8, align: "right" });
  return pdfResponse(await doc.finish(`Certificate ${c.serialNo ?? ""}`), `${(c.serialNo ?? "certificate").replace(/\//g, "-")}.pdf`);
}
