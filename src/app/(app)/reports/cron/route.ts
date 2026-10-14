import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { runDailyJobs, runDueSchedules } from "@/lib/scheduler";

/** For an external scheduler (cron job, uptime pinger): GET /reports/cron?key=<CRON_SECRET>. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.nextUrl.searchParams.get("key") ?? "";
  if (!secret || secret.length !== given.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(given))) return new Response("Forbidden", { status: 403 });
  return Response.json({ daily: await runDailyJobs(), sent: await runDueSchedules() });
}
