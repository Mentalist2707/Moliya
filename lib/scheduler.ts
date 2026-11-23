import { getDb } from "./db";
import { buildDigest } from "./digest";
import { getPrices, portfolio, type HoldingRow } from "./market";
import { getDayTimes, PRAYER_NAMES, toMin, type PrayerKey } from "./prayer";
import { setDigest, type User } from "./repo";
import { esc, som, tg } from "./telegram";

/**
 * Aniq vaqtli rejalashtiruvchi. /api/cron/tick har daqiqada chaqiriladi (cron-job.org).
 * Neon bepul tarifida baza 5 daqiqa ishlatilmasa uxlaydi va oyiga 100 CU-soat beriladi —
 * shuning uchun bazaga faqat "nomzod" daqiqalarda murojaat qilamiz: ertalabki xabar oynalari
 * va namoz vaqtlari atrofi. Qolgan daqiqalarda tick bazaga tegmaydi.
 */

const TZ_MIN = 5 * 60; // Toshkent UTC+5

export function tashkentNow(ms = Date.now()) {
  const d = new Date(ms + TZ_MIN * 60000);
  const date = d.toISOString().slice(0, 10);
  return { date, min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/**
 * Kunlik reja xotirada saqlanadi (cron har daqiqa chaqirgani uchun bitta server nusxasi doim "iliq" turadi).
 * Reja soatiga bir marta yoki sana o'zgarganda yangilanadi — shu payt bazaga bitta murojaat.
 * Shunda baza faqat xabar yuborish kerak bo'lgan daqiqalarda uyg'onadi.
 */
type Plan = { date: string; loadedAt: number; users: User[]; times: Map<string, Awaited<ReturnType<typeof getDayTimes>>> };
let PLAN: Plan | null = null;
const PLAN_TTL = 60 * 60 * 1000;

async function loadPlan(date: string): Promise<Plan> {
  const db = await getDb();
  const users = (
    await db.query(
      `SELECT id, first_name, daily_digest, morning_time, crypto_report, region, prayer_remind, prayer_offset, prayer_list, qaza_remind, qaza_goal
       FROM users WHERE daily_digest=1 OR prayer_remind=1`
    )
  ).rows as User[];
  const times = new Map<string, Awaited<ReturnType<typeof getDayTimes>>>();
  for (const r of new Set(users.filter((u) => u.prayer_remind).map((u) => u.region))) times.set(r, await getDayTimes(r, date));
  PLAN = { date, loadedAt: Date.now(), users, times };
  return PLAN;
}

/** Rejani yangilashni majburlash (sozlamalar o'zgarganda shu server nusxasida) */
export function invalidatePlan() {
  PLAN = null;
}

type Due = { morning: User[]; prayers: { u: User; p: PrayerKey; at: number }[] };

function dueAt(plan: Plan, min: number, morningTolerance: number): Due {
  const due: Due = { morning: [], prayers: [] };
  for (const u of plan.users) {
    if (u.daily_digest) {
      const mt = toMin(u.morning_time || "08:30");
      if (min >= mt && min <= mt + morningTolerance) due.morning.push(u);
    }
    if (u.prayer_remind) {
      const t = plan.times.get(u.region);
      if (!t) continue;
      for (const p of (u.prayer_list || "").split(",") as PrayerKey[]) {
        if (!t[p]) continue;
        const at = toMin(t[p]) - (u.prayer_offset || 0);
        if (min >= at && min <= at + 5) due.prayers.push({ u, p, at });
      }
    }
  }
  return due;
}

/** Xabarni bir marta yuborish uchun "band qilish" — parallel ticklar ikki marta yubormaydi */
async function claim(uid: number, key: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.query("INSERT INTO sent_log (user_id, key) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1", [uid, key]);
  return !!r.rowCount;
}

async function send(uid: number, text: string, extra: Record<string, unknown> = {}) {
  const r = await tg("sendMessage", { chat_id: uid, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
  if (!r.ok && /blocked|deactivated|chat not found/i.test(r.description || "")) {
    await setDigest(uid, false);
    const db = await getDb();
    await db.query("UPDATE users SET prayer_remind=0 WHERE id=$1", [uid]);
  }
  return r.ok;
}

export const usd = (n: number) => {
  const a = Math.abs(n);
  const s = a.toLocaleString("en-US", { minimumFractionDigits: a < 1 ? 4 : 2, maximumFractionDigits: a < 1 ? 4 : 2 });
  return (n < 0 ? "−$" : "$") + s;
};
const pct = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2) + "%";
const signUsd = (n: number) => (n > 0 ? "+" : "") + usd(n);
const mln = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? (a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(".0", "") + " mln" : som(a);
  return (n < 0 ? "−" : n > 0 ? "+" : "") + s;
};

/** Kripto bo'limi matni (ertalabki xabar va /kripto buyrug'i uchun) */
export async function cryptoSection(uid: number): Promise<string | null> {
  const db = await getDb();
  const holdings = (await db.query("SELECT coin, symbol, amount, avg_price FROM holdings WHERE user_id=$1 AND amount > 0 ORDER BY id", [uid])).rows as HoldingRow[];
  if (!holdings.length) return null;
  const { prices, usd_uzs, stale } = await getPrices(holdings.map((h) => h.coin));
  const p = portfolio(holdings, prices);
  const uzs = (x: number) => (usd_uzs ? ` (≈ ${mln(x * usd_uzs)} so'm)` : "");
  const emoji = p.dayPnl > 0 ? "🟢" : p.dayPnl < 0 ? "🔴" : "⚪";
  const L = [
    `<b>💰 Portfel: ${usd(p.value)}</b>${usd_uzs ? ` ≈ ${mln(p.value * usd_uzs).replace("+", "")} so'm` : ""}`,
    `${emoji} Kechagidan: <b>${signUsd(p.dayPnl)}</b> (${pct(p.dayPct)})${uzs(p.dayPnl)}`,
  ];
  if (p.totalPnl !== null) L.push(`📈 Sotib olingandan beri: ${signUsd(p.totalPnl)} (${pct(p.totalPct ?? 0)})`);
  for (const it of p.items) {
    if (it.price === null) {
      L.push(`• ${esc(it.symbol)}: narx topilmadi`);
      continue;
    }
    const ch = it.change24 === null ? "" : ` ${it.change24 >= 0 ? "▲" : "▼"}${Math.abs(it.change24).toFixed(1)}%`;
    L.push(`• ${esc(it.symbol)} ${Number(it.amount.toPrecision(8))} × ${usd(it.price)} = ${usd(it.value)}${ch}`);
  }
  if (stale) L.push("<i>⚠️ Narxlar yangilanmadi, oxirgi ma'lum narx ko'rsatildi</i>");
  return L.join("\n");
}

async function qazaSection(uid: number, goal: number): Promise<string | null> {
  const db = await getDb();
  const rows = (await db.query("SELECT prayer, count FROM qaza WHERE user_id=$1 AND count > 0", [uid])).rows as { prayer: string; count: number }[];
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.count, 0);
  const order = ["bomdod", "peshin", "asr", "shom", "xufton", "vitr"];
  rows.sort((a, b) => order.indexOf(a.prayer) - order.indexOf(b.prayer));
  const names: Record<string, string> = { ...PRAYER_NAMES, vitr: "Vitr" };
  return `<b>🕋 Qazo namozlar: ${total} ta</b>\n${rows.map((r) => `${names[r.prayer] ?? r.prayer}: ${r.count}`).join(" · ")}${goal ? `\nBugungi maqsad: ${goal} ta qazo o'qish` : ""}`;
}

export async function buildMorning(u: User, date: string): Promise<string | null> {
  const parts: string[] = [];
  const digest = await buildDigest(Number(u.id), u.first_name).catch(() => null);
  if (u.crypto_report) {
    const c = await cryptoSection(Number(u.id)).catch((e) => (console.error("[morning] kripto:", e), null));
    if (c) parts.push(c);
  }
  if (u.prayer_remind) {
    const t = await getDayTimes(u.region, date);
    parts.push(
      `<b>🕌 Namoz vaqtlari — ${esc(u.region)}</b>\nBomdod ${t.bomdod} · Quyosh ${t.quyosh} · Peshin ${t.peshin}\nAsr ${t.asr} · Shom ${t.shom} · Xufton ${t.xufton}`
    );
  }
  if (u.qaza_remind) {
    const q = await qazaSection(Number(u.id), u.qaza_goal);
    if (q) parts.push(q);
  }
  if (!digest && !parts.length) return null;
  const head = digest ?? `☀️ <b>Xayrli tong${u.first_name ? ", " + esc(u.first_name) : ""}!</b> Bugun ${date.split("-").reverse().join(".")}`;
  return [head, ...parts].join("\n\n");
}

export const prayButton = (date: string, prayer: string, appUrl: string) => ({
  inline_keyboard: [
    [
      { text: "✅ O'qidim", callback_data: `pr:${date}:${prayer}` },
      { text: "📱 Ilova", web_app: { url: appUrl + "/#namoz" } },
    ],
  ],
});

type TickResult = { skipped?: boolean; planLoaded?: boolean; morning: number; prayer: number; date: string; time: string; preview?: { uid: number; kind: string; text: string }[] };

/**
 * @param fallback  Vercel Cron'ning kunlik zaxira chaqiruvi: ertalabki xabarni 3 soatgacha kechikib bo'lsa ham yuboradi
 */
export async function tick(appUrl: string, opts: { now?: number; fallback?: boolean } = {}): Promise<TickResult> {
  const { date, min } = tashkentNow(opts.now);
  const time = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const res: TickResult = { morning: 0, prayer: 0, date, time };

  let plan = PLAN;
  if (opts.fallback || !plan || plan.date !== date || (opts.now ?? Date.now()) - plan.loadedAt > PLAN_TTL || Date.now() < plan.loadedAt) {
    plan = await loadPlan(date);
    res.planLoaded = true;
  }
  const due = dueAt(plan, min, opts.fallback ? 180 : 5);
  if (!due.morning.length && !due.prayers.length) return { ...res, skipped: !res.planLoaded };

  const db = await getDb();
  if (opts.now !== undefined) res.preview = []; // lokal sinov: yuboriladigan matnlarni qaytarish
  const release = (uid: number, key: string) => db.query("DELETE FROM sent_log WHERE user_id=$1 AND key=$2", [uid, key]);

  // 1) Ertalabki xabar
  for (const u of due.morning) {
    const key = `m:${date}`;
    if (!(await claim(Number(u.id), key))) continue;
    const text = await buildMorning(u, date).catch((e) => (console.error("[tick] morning:", e), null));
    if (!text) continue;
    res.preview?.push({ uid: Number(u.id), kind: "morning", text });
    const ok = await send(Number(u.id), text, { reply_markup: { inline_keyboard: [[{ text: "📱 Ilovani ochish", web_app: { url: appUrl } }]] } });
    if (ok) res.morning++;
    else await release(Number(u.id), key); // keyingi daqiqada qayta urinadi
  }
  if (due.morning.length) await db.query("DELETE FROM sent_log WHERE created_at < now() - interval '4 days'");

  // 2) Namoz eslatmalari
  for (const { u, p } of due.prayers) {
    const key = `p:${date}:${p}`;
    if (!(await claim(Number(u.id), key))) continue;
    const t = plan.times.get(u.region)!;
    const head = u.prayer_offset ? `⏰ ${u.prayer_offset} daqiqadan keyin <b>${PRAYER_NAMES[p]}</b> vaqti` : `🕌 <b>${PRAYER_NAMES[p]}</b> vaqti kirdi`;
    const text = `${head} — ${t[p]}\n<i>${esc(u.region)}${t.source === "hisob" ? "" : ""}</i>`;
    res.preview?.push({ uid: Number(u.id), kind: `prayer:${p}`, text });
    const ok = await send(Number(u.id), text, { reply_markup: prayButton(date, p, appUrl) });
    if (ok) res.prayer++;
    else await release(Number(u.id), key);
  }
  return res;
}
