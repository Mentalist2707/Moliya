import { NextResponse } from "next/server";
import { deleteAccount, getUser, setDigest } from "@/lib/repo";
import { withUser } from "@/lib/api";
import { AUTH_COOKIE, COOKIE_OPTS, authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withUser(async (_req, uid) => {
  const u = await getUser(uid);
  return NextResponse.json({
    id: uid,
    first_name: u?.first_name ?? null,
    username: u?.username ?? null,
    photo_url: u?.photo_url ?? null,
    daily_digest: u?.daily_digest ?? 1,
    local: !authEnabled(),
  });
});

// PATCH { daily_digest: boolean }
export const PATCH = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  if (typeof b.daily_digest === "boolean") await setDigest(uid, b.daily_digest);
  return NextResponse.json({ ok: true });
});

// Hisobni va barcha ma'lumotlarni o'chirish. Body: { confirm: "O'CHIRISH" }
export const DELETE = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  if (String(b.confirm || "").replace(/['’ʻ‘`ʼ]/g, "").toUpperCase() !== "OCHIRISH") return NextResponse.json({ error: "Tasdiqlash kerak" }, { status: 400 });
  await deleteAccount(uid);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
});
