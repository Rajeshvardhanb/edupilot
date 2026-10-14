import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentScope } from "@/lib/scope";
import { batchLabel } from "@/lib/format";

/** Quick student lookup for the command palette (scoped to what the user may see). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role === "STUDENT") return NextResponse.json([], { status: user ? 200 : 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 50);
  if (q.length < 2) return NextResponse.json([]);
  const rows = await db.student.findMany({
    where: { AND: [studentScope(user), { OR: [{ rollNo: { contains: q } }, { user: { name: { contains: q } } }] }] },
    include: { user: { select: { name: true } }, batch: { include: { program: true } } },
    orderBy: { rollNo: "asc" },
    take: 8,
  });
  return NextResponse.json(rows.map((s) => ({ id: s.id, name: s.user.name, rollNo: s.rollNo, batch: batchLabel(s.batch) })));
}
