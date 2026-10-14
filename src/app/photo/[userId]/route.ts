import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_: Request, ctx: RouteContext<"/photo/[userId]">) {
  if (!(await getCurrentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const { userId } = await ctx.params;
  const u = await db.user.findUnique({ where: { id: userId }, select: { photo: true, photoType: true, updatedAt: true } });
  if (!u?.photo || !u.photoType) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(u.photo), {
    headers: { "Content-Type": u.photoType, "Cache-Control": "private, max-age=300", ETag: `"${u.updatedAt.getTime()}"` },
  });
}
