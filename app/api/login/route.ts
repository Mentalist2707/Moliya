import { NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken, safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const real = process.env.APP_PASSWORD || "";
  if (!real || !safeEqual(String(password || ""), real)) {
    // Parol terish hujumlarini sekinlashtirish
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Parol noto'g'ri" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 kun
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
