import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewPhoto } from "@/lib/photo-policy";
export async function GET(_: Request, ctx: RouteContext<"/photo/[userId]">) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { userId } = await ctx.params;
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, student: { select: { id: true, batch: { select: { program: { select: { departmentId: true } } } } } } } });
  if (!target || !canViewPhoto(me, target)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const user = await db.user.findUnique({ where: { id: userId }, select: { photo: true, photoType: true } });
  if (!user?.photo || !["image/jpeg", "image/png", "image/webp"].includes(user.photoType ?? "")) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(new Uint8Array(user.photo), { headers: { "Content-Type": user.photoType!, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
}
