import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordAttendance } from "@/lib/attendance-core";

/** Receives attendance that was marked while the device was offline. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!["ADMIN", "HOD", "FACULTY"].includes(user.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: { offeringId?: string; date?: string; period?: number; topic?: string; marks?: Record<string, string> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.offeringId || !body.date || !body.marks || typeof body.marks !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const result = await recordAttendance(user, { offeringId: body.offeringId, date: body.date, period: Number(body.period), topic: body.topic, marks: body.marks });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
