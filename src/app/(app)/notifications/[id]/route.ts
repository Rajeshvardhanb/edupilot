import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Opening a notification marks it read and goes to what it is about. */
export async function GET(req: NextRequest, ctx: RouteContext<"/notifications/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { id } = await ctx.params;
  const n = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (n && !n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  // Only ever redirect to a path inside this app.
  const href = n?.href && n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/notifications";
  return NextResponse.redirect(new URL(href, req.url));
}
