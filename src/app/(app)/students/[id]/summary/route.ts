import { attendanceSummary } from "@/lib/attendance";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { batchLabel,pct } from "@/lib/format";
import { studentStandings } from "@/lib/results";
import { getRules } from "@/lib/rules";
import { currentTerm,studentScope } from "@/lib/scope";
import { NextResponse } from "next/server";

/** Compact student snapshot for the quick-view panel. */
export async function GET(_: Request, ctx: RouteContext<"/students/[id]/summary">) {
  const user = await getCurrentUser();
  if (!user || user.role === "STUDENT" || user.role === "PARENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const s = await db.student.findFirst({
    where: { AND: [{ id }, studentScope(user)] },
    include: { user: { select: { id: true, name: true, email: true, phone: true, photoType: true, updatedAt: true } }, batch: { include: { program: true } } },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const term = await currentTerm();
  const offerings = await db.courseOffering.findMany({ where: { batchId: s.batchId, termId: term?.id }, select: { id: true } });
  const att = await attendanceSummary({ studentIds: [s.id], offeringIds: offerings.map((o) => o.id) });
  const t = [...att.values()].reduce((x, v) => ({ a: x.a + v.attended, t: x.t + v.total }), { a: 0, t: 0 });
  const st = (await studentStandings([s.id])).get(s.id)!;
  return NextResponse.json({
    id: s.id, userId: s.user.id, hasPhoto: !!s.user.photoType, photoVersion: String(s.user.updatedAt.getTime()), name: s.user.name, email: s.user.email, phone: s.user.phone, rollNo: s.rollNo,
    program: s.batch.program.name, batch: batchLabel(s.batch), semester: s.batch.currentSemester, status: s.status, admissionType: s.admissionType,
    guardian: s.guardianName, guardianPhone: s.guardianPhone,
    attendance: t.t ? pct(t.a, t.t) : null, attendanceRequired: (await getRules()).attendanceRequired, cgpa: st.cgpa, backlogs: st.backlogs,
  });
}
