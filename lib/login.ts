import { NextResponse } from "next/server";
import { AUTH_COOKIE, COOKIE_OPTS, isAllowed, signSession } from "./auth";
import { upsertUser } from "./repo";
import type { TgUser } from "./telegram";

/** Tasdiqlangan Telegram foydalanuvchisi uchun sessiya ochish */
export async function startSession(user: TgUser | null) {
  if (!user?.id) return NextResponse.json({ error: "Telegram ma'lumoti tasdiqlanmadi" }, { status: 401 });
  if (!isAllowed(user.id)) {
    return NextResponse.json({ error: "Bu ilovaga kirish cheklangan", your_id: user.id }, { status: 403 });
  }
  const u = await upsertUser(user);
  const res = NextResponse.json({ ok: true, name: u.first_name });
  res.cookies.set(AUTH_COOKIE, await signSession(user.id), COOKIE_OPTS);
  return res;
}
