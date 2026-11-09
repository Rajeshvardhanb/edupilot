import { SESSION_COOKIE,verifySession } from "@/lib/session";
import { NextResponse,type NextRequest } from "next/server";

// Optimistic auth check: real authorization happens in the Data Access Layer (lib/auth.ts).
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  // Photo responses enforce their own authenticated record scope and return 401 for signed-out requests.
  if (pathname.startsWith("/photo/")) return NextResponse.next();
  // Reachable without signing in.
  if (pathname === "/setup-password" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/login/verify" || pathname === "/session/expired") return NextResponse.next();

  if (!session && !isLogin) {
    const url = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session && isLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand/logo|.*\\.(?:png|svg|jpg|webp|ico)$).*)"],
};
