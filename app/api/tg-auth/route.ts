import { NextResponse } from "next/server";
import { AUTH_COOKIE, COOKIE_OPTS, expectedToken } from "@/lib/auth";
import { OWNER_ID, verifyInitData } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Telegram Mini App ichidan avtomatik kirish: POST { initData }
export async function POST(req: Request) {
  const { initData } = await req.json().catch(() => ({ initData: "" }));
  const user = verifyInitData(String(initData || ""));
  if (!user) return NextResponse.json({ error: "Telegram ma'lumoti tasdiqlanmadi" }, { status: 401 });
  if (!OWNER_ID() || user.id !== OWNER_ID()) {
    return NextResponse.json({ error: "Bu shaxsiy ilova", your_id: user.id }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true, name: user.first_name });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), COOKIE_OPTS);
  return res;
}
