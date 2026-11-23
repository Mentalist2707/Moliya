import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, verifySession } from "@/lib/auth";

// O'z tekshiruviga ega yoki ochiq bo'lishi kerak bo'lgan manzillar
const PUBLIC = ["/login", "/api/tg-auth", "/api/auth/telegram", "/api/auth/logout", "/api/telegram/webhook", "/api/telegram/setup", "/api/cron/tick"];

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  if (await verifySession(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
