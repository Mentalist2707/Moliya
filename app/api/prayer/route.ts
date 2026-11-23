import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getUser, setPrayed } from "@/lib/repo";
import { getDayTimes, REGIONS } from "@/lib/prayer";

export const dynamic = "force-dynamic";

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// GET ?date=YYYY-MM-DD&region=…  → namoz vaqtlari
export const GET = withUser(async (req, uid) => {
  const u = new URL(req.url);
  const date = u.searchParams.get("date");
  if (!isDate(date)) return NextResponse.json({ error: "date kerak" }, { status: 400 });
  const me = await getUser(uid);
  const regionParam = u.searchParams.get("region");
  const region = regionParam && REGIONS.some((r) => r.name === regionParam) ? regionParam : me?.region || "Toshkent";
  const times = await getDayTimes(region, date);
  return NextResponse.json({ region, date, times, regions: REGIONS.map((r) => r.name) });
});

// POST { date, prayer, on } → o'qildi belgisi
export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  if (!isDate(b.date)) return NextResponse.json({ error: "date kerak" }, { status: 400 });
  await setPrayed(uid, b.date, String(b.prayer), !!b.on);
  return NextResponse.json({ ok: true });
});
