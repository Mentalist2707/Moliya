import { getDb } from "./db";

/**
 * Narxlar: CoinGecko (USD + 24 soatlik o'zgarish), dollar kursi: O'zbekiston Markaziy banki (cbu.uz).
 * Natijalar prices_cache jadvalida 5 daqiqa saqlanadi — API cheklovlariga tushmaslik uchun.
 */

export const PRESETS = [
  { coin: "the-open-network", symbol: "GRAM", name: "Gram (Toncoin)" },
  { coin: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { coin: "tether-gold", symbol: "XAUT", name: "Tether Gold (oltin)" },
  { coin: "ethereum", symbol: "ETH", name: "Ethereum" },
  { coin: "tether", symbol: "USDT", name: "Tether" },
  { coin: "solana", symbol: "SOL", name: "Solana" },
];

export type Price = { usd: number; change24: number | null; updated_at: string };
const TTL_MS = 5 * 60 * 1000;

async function fetchCoinGecko(ids: string[]): Promise<Record<string, { usd: number; change24: number | null }>> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const j = (await r.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const out: Record<string, { usd: number; change24: number | null }> = {};
  for (const [id, v] of Object.entries(j)) if (typeof v?.usd === "number") out[id] = { usd: v.usd, change24: v.usd_24h_change ?? null };
  return out;
}

async function fetchUsdUzs(): Promise<number> {
  const r = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/", { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`CBU ${r.status}`);
  const j = (await r.json()) as { Ccy?: string; Rate?: string }[];
  const usd = (Array.isArray(j) ? j : []).find((x) => x.Ccy === "USD") ?? j?.[0];
  const rate = Number(String(usd?.Rate ?? "").replace(",", "."));
  if (!rate) throw new Error("CBU kursi topilmadi");
  return rate;
}

/** Narxlarni olish: yangi bo'lsa keshdan, eskirgan bo'lsa API'dan yangilab */
export async function getPrices(coins: string[], force = false): Promise<{ prices: Record<string, Price>; usd_uzs: number | null; stale: boolean }> {
  const db = await getDb();
  const want = [...new Set([...coins, "usd_uzs"])];
  const rows = (await db.query("SELECT coin, usd, change24, updated_at FROM prices_cache WHERE coin = ANY($1)", [want])).rows as (Price & { coin: string })[];
  const cache = new Map(rows.map((r) => [r.coin, r]));
  const old = (c: string) => force || !cache.has(c) || Date.now() - new Date(cache.get(c)!.updated_at).getTime() > TTL_MS;
  let stale = false;

  const needCoins = coins.filter(old);
  if (needCoins.length) {
    try {
      const fresh = await fetchCoinGecko(needCoins);
      for (const [coin, v] of Object.entries(fresh)) {
        await db.query(
          `INSERT INTO prices_cache (coin, usd, change24, updated_at) VALUES ($1,$2,$3,now())
           ON CONFLICT (coin) DO UPDATE SET usd=EXCLUDED.usd, change24=EXCLUDED.change24, updated_at=now()`,
          [coin, v.usd, v.change24]
        );
        cache.set(coin, { coin, usd: v.usd, change24: v.change24, updated_at: new Date().toISOString() });
      }
    } catch (e) {
      console.error("[market]", (e as Error).message);
      stale = true;
    }
  }
  // Dollar kursi kuniga bir marta yangilansa yetadi
  const fx = cache.get("usd_uzs");
  if (!fx || Date.now() - new Date(fx.updated_at).getTime() > 6 * 3600 * 1000) {
    try {
      const rate = await fetchUsdUzs();
      await db.query(
        `INSERT INTO prices_cache (coin, usd, change24, updated_at) VALUES ('usd_uzs',$1,NULL,now())
         ON CONFLICT (coin) DO UPDATE SET usd=EXCLUDED.usd, updated_at=now()`,
        [rate]
      );
      cache.set("usd_uzs", { coin: "usd_uzs", usd: rate, change24: null, updated_at: new Date().toISOString() });
    } catch (e) {
      console.error("[market] CBU:", (e as Error).message);
    }
  }
  const prices: Record<string, Price> = {};
  for (const c of coins) {
    const p = cache.get(c);
    if (p) prices[c] = { usd: Number(p.usd), change24: p.change24 === null ? null : Number(p.change24), updated_at: String(p.updated_at) };
  }
  return { prices, usd_uzs: cache.get("usd_uzs") ? Number(cache.get("usd_uzs")!.usd) : null, stale };
}

export type HoldingRow = { coin: string; symbol: string; amount: number; avg_price: number | null };

/** Portfel hisobi: qiymat, kechagidan (24 soat) o'zgarish, sotib olingandan beri foyda */
export function portfolio(holdings: HoldingRow[], prices: Record<string, Price>) {
  let value = 0,
    prev = 0,
    cost = 0,
    costKnown = 0;
  const items = holdings.map((h) => {
    const p = prices[h.coin];
    const v = p ? h.amount * p.usd : 0;
    const before = p && p.change24 !== null ? v / (1 + p.change24 / 100) : v;
    value += v;
    prev += before;
    if (h.avg_price) {
      cost += h.amount * h.avg_price;
      costKnown += v;
    }
    return { ...h, price: p?.usd ?? null, change24: p?.change24 ?? null, value: v, dayPnl: v - before, totalPnl: h.avg_price ? v - h.amount * h.avg_price : null };
  });
  return { items, value, dayPnl: value - prev, dayPct: prev ? ((value - prev) / prev) * 100 : 0, totalPnl: cost ? costKnown - cost : null, totalPct: cost ? ((costKnown - cost) / cost) * 100 : null };
}
