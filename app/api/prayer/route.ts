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
  // ?days=N — sanadan boshlab N kunlik jadval (Ramazon taqvimi uchun, ko'pi bilan 31)
  const days = Math.min(31, Number(u.searchParams.get("days") || 0));
  if (days > 0) {
    const list = [];
    const start = Date.parse(date + "T00:00:00Z");
    for (let i = 0; i < days; i++) {
      const dd = new Date(start + i * 86400000).toISOString().slice(0, 10);
      list.push({ date: dd, ...(await getDayTimes(region, dd)) });
    }
    return NextResponse.json({ region, list });
  }
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
