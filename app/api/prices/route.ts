import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getPrices, portfolio, PRESETS, type HoldingRow } from "@/lib/market";

export const dynamic = "force-dynamic";

// GET ?force=1 → foydalanuvchi aktivlari narxi va portfel hisobi
export const GET = withUser(async (req, uid) => {
  const db = await getDb();
  const holdings = (await db.query("SELECT id, coin, symbol, name, amount, avg_price FROM holdings WHERE user_id=$1 ORDER BY id", [uid])).rows as (HoldingRow & { id: number })[];
  const force = new URL(req.url).searchParams.has("force");
  // Oltin narxi (XAUt = 1 troy unsiya) zakot kalkulyatori uchun har doim kerak
  const coins = [...new Set([...holdings.map((h) => h.coin), "tether-gold"])];
  const { prices, usd_uzs, stale } = await getPrices(coins, force);
  return NextResponse.json({ prices, usd_uzs, stale, presets: PRESETS, gold_usd_oz: prices["tether-gold"]?.usd ?? null, ...portfolio(holdings, prices) });
});
