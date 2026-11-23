import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, expectedToken, safeEqual } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value || "";
  if (token && safeEqual(token, await expectedToken())) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
