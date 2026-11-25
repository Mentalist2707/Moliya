import { NextResponse } from "next/server";
import { deleteAccount, getUser, updateSettings } from "@/lib/repo";
import { invalidatePlan } from "@/lib/scheduler";
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
    morning_time: u?.morning_time ?? "08:30",
    crypto_report: u?.crypto_report ?? 1,
    region: u?.region ?? "Toshkent",
    prayer_remind: u?.prayer_remind ?? 0,
    prayer_offset: u?.prayer_offset ?? 0,
    prayer_list: u?.prayer_list ?? "bomdod,peshin,asr,shom,xufton",
    qaza_remind: u?.qaza_remind ?? 1,
    qaza_goal: u?.qaza_goal ?? 0,
    fast_remind: u?.fast_remind ?? 1,
    sahar_offset: u?.sahar_offset ?? 30,
    quran_goal: u?.quran_goal ?? 0,
    read_goal: u?.read_goal ?? 0,
    read_year_goal: u?.read_year_goal ?? 0,
    read_remind: u?.read_remind ?? 1,
    read_remind_time: u?.read_remind_time ?? "21:00",
    quote_morning: u?.quote_morning ?? 1,
    ru_enabled: u?.ru_enabled ?? 0,
    ru_remind: u?.ru_remind ?? 1,
    ru_remind_time: u?.ru_remind_time ?? "20:00",
    local: !authEnabled(),
  });
});

// PATCH { daily_digest?, morning_time?, crypto_report?, region?, prayer_remind?, prayer_offset?, prayer_list?, qaza_remind?, qaza_goal? }
export const PATCH = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  if (b && typeof b === "object") await updateSettings(uid, b);
  invalidatePlan();
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
