import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return Response.json({ unread }, { headers: { "Cache-Control": "private, no-store" } });
}
