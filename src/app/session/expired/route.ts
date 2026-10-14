import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Clears a session whose user no longer exists or was disabled, then shows the login page.
 * Without this, the proxy (which only checks the cookie's signature) and the pages (which
 * check the database) would bounce such a visitor between /login and /dashboard forever.
 */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login?expired=1", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
