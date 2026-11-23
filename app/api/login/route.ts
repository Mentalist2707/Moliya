import { NextResponse } from "next/server";
import { AUTH_COOKIE, COOKIE_OPTS, expectedToken, safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const real = process.env.APP_PASSWORD || "";
  if (!real || !safeEqual(String(password || ""), real)) {
    // Parol terish hujumlarini sekinlashtirish
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: real ? "Parol noto'g'ri" : "Parol bilan kirish o'chirilgan" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), COOKIE_OPTS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}
