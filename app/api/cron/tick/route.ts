import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { tick } from "@/lib/scheduler";
import { appUrl } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Har daqiqada chaqiriladi (cron-job.org):  GET /api/cron/tick?key=CRON_SECRET
 * Vercel Cron (kunlik zaxira) Authorization: Bearer CRON_SECRET va ?fallback=1 bilan chaqiradi.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const u = new URL(req.url);
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const key = u.searchParams.get("key") || bearer;
  if (!secret || !safeEqual(key, secret)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    // Faqat lokal sinov uchun: TICK_TEST_TIME=1 bo'lsa ?at=ISO bilan vaqtni almashtirish
    const at = process.env.TICK_TEST_TIME === "1" && u.searchParams.get("at") ? Date.parse(u.searchParams.get("at")!) : undefined;
    const r = await tick(appUrl(req), { fallback: u.searchParams.has("fallback"), now: at });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[tick]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
