import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Optimistic auth check: real authorization happens in the Data Access Layer (lib/auth.ts).
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  // Reachable without signing in.
  if (pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/login/verify" || pathname === "/session/expired" || pathname === "/reports/cron") return NextResponse.next();

  if (!session && !isLogin) {
    const url = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session && isLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline|brand/logo|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
