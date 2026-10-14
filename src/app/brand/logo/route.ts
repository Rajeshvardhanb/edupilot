import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** College logo (public: it is shown on the login page). */
export async function GET() {
  const inst = await db.institution.findUnique({ where: { id: 1 }, select: { logo: true, logoType: true } });
  if (!inst?.logo || !inst.logoType) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(inst.logo), { headers: { "Content-Type": inst.logoType, "Cache-Control": "public, max-age=300" } });
}
