import { getDb } from "./db";
import { buildDigest } from "./digest";
import { getPrices, portfolio, type HoldingRow } from "./market";
import { getDayTimes, PRAYER_NAMES, toMin, type PrayerKey } from "./prayer";
import { setDigest, type User } from "./repo";
import { esc, som, tg } from "./telegram";
import { billStatus, hijri, isRamadan, nextBirthday } from "./calendar";

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
type Plan = {
  date: string;
  loadedAt: number;
  users: User[];
  times: Map<string, Awaited<ReturnType<typeof getDayTimes>>>;
  fasting: Set<number>; // bugun ro'za eslatmasi oladiganlar
};
let PLAN: Plan | null = null;
const PLAN_TTL = 60 * 60 * 1000;

async function loadPlan(date: string): Promise<Plan> {
  const db = await getDb();
  const users = (
    await db.query(
      `SELECT id, first_name, daily_digest, morning_time, crypto_report, region, prayer_remind, prayer_offset, prayer_list,
              qaza_remind, qaza_goal, fast_remind, sahar_offset, quran_goal
       FROM users WHERE daily_digest=1 OR prayer_remind=1 OR fast_remind=1`
    )
  ).rows as User[];
  // Ro'za: Ramazonda — "qoldi" belgilamaganlar; boshqa kunlari — "niyat" qilganlar
  const logs = (await db.query("SELECT user_id, status FROM fast_log WHERE date=$1", [date])).rows as { user_id: number; status: string }[];
  const st = new Map(logs.map((l) => [Number(l.user_id), l.status]));
  const ramadan = isRamadan(date);
  const fasting = new Set<number>();
  for (const u of users) {
    if (!u.fast_remind) continue;
    const s = st.get(Number(u.id));
    if ((ramadan && s !== "qoldi") || s === "niyat" || (s === "tutdim" && !ramadan)) fasting.add(Number(u.id));
  }
  const times = new Map<string, Awaited<ReturnType<typeof getDayTimes>>>();
  const regions = new Set(users.filter((u) => u.prayer_remind || fasting.has(Number(u.id))).map((u) => u.region));
  for (const r of regions) times.set(r, await getDayTimes(r, date));
  PLAN = { date, loadedAt: Date.now(), users, times, fasting };
  return PLAN;
}

/** Rejani yangilashni majburlash (sozlamalar o'zgarganda shu server nusxasida) */
export function invalidatePlan() {
  PLAN = null;
}

type Due = { morning: User[]; prayers: { u: User; p: PrayerKey; at: number }[]; fasts: { u: User; kind: "sahar" | "iftor" }[] };

function dueAt(plan: Plan, min: number, morningTolerance: number): Due {
  const due: Due = { morning: [], prayers: [], fasts: [] };
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
    if (plan.fasting.has(Number(u.id))) {
      const t = plan.times.get(u.region);
      if (!t) continue;
      const sahar = toMin(t.bomdod) - (u.sahar_offset || 30);
      const iftor = toMin(t.shom);
      if (min >= sahar && min <= sahar + 5) due.fasts.push({ u, kind: "sahar" });
      if (min >= iftor && min <= iftor + 5) due.fasts.push({ u, kind: "iftor" });
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

async function qazaSection(uid: number, goal: number, date?: string): Promise<string | null> {
  const db = await getDb();
  // Kecha belgilanmay qolgan namozlar (foydalanuvchi belgilashdan foydalanayotgan bo'lsa)
  let missedLine = "";
  if (date) {
    const used = (await db.query("SELECT 1 FROM prayer_log WHERE user_id=$1 AND date >= $2::date - 7 LIMIT 1", [uid, date])).rowCount;
    if (used) {
      const marked = new Set(
        (await db.query("SELECT prayer FROM prayer_log WHERE user_id=$1 AND date = $2::date - 1", [uid, date])).rows.map((r) => r.prayer as string)
      );
      const missed = ["bomdod", "peshin", "asr", "shom", "xufton"].filter((p) => !marked.has(p));
      if (missed.length) missedLine = `\n⚠️ Kecha belgilanmagan: ${missed.map((p) => PRAYER_NAMES[p as PrayerKey]).join(", ")} — ilovada «o'qidim» yoki «qazo» deb belgilang`;
    }
  }
  const rows = (await db.query("SELECT prayer, count FROM qaza WHERE user_id=$1 AND count > 0", [uid])).rows as { prayer: string; count: number }[];
  if (!rows.length) return missedLine ? `<b>🕋 Namozlar</b>${missedLine}` : null;
  const total = rows.reduce((a, r) => a + r.count, 0);
  const order = ["bomdod", "peshin", "asr", "shom", "xufton", "vitr"];
  rows.sort((a, b) => order.indexOf(a.prayer) - order.indexOf(b.prayer));
  const names: Record<string, string> = { ...PRAYER_NAMES, vitr: "Vitr", roza: "Ro'za" };
  return `<b>🕋 Qazo namozlar: ${total} ta</b>\n${rows.map((r) => `${names[r.prayer] ?? r.prayer}: ${r.count}`).join(" · ")}${goal ? `\nBugungi maqsad: ${goal} ta qazo o'qish` : ""}${missedLine}`;
}

/** To'lovlar, tug'ilgan kunlar, Qur'on, ro'za */
async function extrasSection(u: User, date: string): Promise<string | null> {
  const db = await getDb();
  const uid = Number(u.id);
  const [bills, bdays, quran, todayQ, fast] = await Promise.all([
    db.query("SELECT name, amount, day, remind_days, last_paid FROM bills WHERE user_id=$1 AND active=1", [uid]).then((r) => r.rows),
    db.query("SELECT name, month, day, year FROM birthdays WHERE user_id=$1", [uid]).then((r) => r.rows),
    db.query("SELECT page, khatm FROM quran WHERE user_id=$1", [uid]).then((r) => r.rows[0]),
    db.query("SELECT COALESCE(SUM(pages),0)::int AS p FROM quran_log WHERE user_id=$1 AND date >= $2::date - 6", [uid, date]).then((r) => r.rows[0]),
    db.query("SELECT status FROM fast_log WHERE user_id=$1 AND date=$2", [uid, date]).then((r) => r.rows[0]),
  ]);
  const L: string[] = [];
  const when = (n: number) => (n === 0 ? "bugun" : n === 1 ? "ertaga" : n < 0 ? `${-n} kun o'tdi ⚠️` : `${n} kundan keyin`);

  const dueBills = bills
    .map((b) => ({ b, s: billStatus({ day: b.day, last_paid: b.last_paid }, date) }))
    .filter(({ b, s }) => s.left <= Math.max(0, Number(b.remind_days)))
    .sort((a, b) => a.s.left - b.s.left);
  if (dueBills.length) {
    L.push("<b>📅 To'lovlar</b>");
    for (const { b, s } of dueBills) L.push(`• ${esc(b.name)}${Number(b.amount) ? ` — ${som(Number(b.amount))} so'm` : ""} (${when(s.left)})`);
  }

  const near = bdays.map((b) => ({ b, n: nextBirthday({ month: b.month, day: b.day, year: b.year }, date) })).filter(({ n }) => n.left <= 1);
  if (near.length) {
    if (L.length) L.push("");
    L.push("<b>🎂 Tug'ilgan kunlar</b>");
    for (const { b, n } of near) L.push(`• ${esc(b.name)} — ${n.left === 0 ? "<b>bugun</b>" : "ertaga"}${n.age ? ` (${n.age} yosh)` : ""}`);
  }

  const h = hijri(date);
  if (u.fast_remind && (h.month === 9 || fast?.status === "niyat")) {
    if (L.length) L.push("");
    L.push(h.month === 9 ? `<b>🌙 Ramazonning ${h.day}-kuni</b>` : "<b>🌙 Bugun ro'za niyatingiz bor</b>");
  }

  if (u.quran_goal) {
    if (L.length) L.push("");
    const page = Number(quran?.page || 0);
    L.push(`<b>📖 Qur'on</b>: bugungi maqsad ${u.quran_goal} sahifa · xatm ${Math.round((page / 604) * 100)}% (${page}/604) · 7 kunda ${todayQ?.p ?? 0} sahifa`);
  }
  return L.length ? L.join("\n") : null;
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
    const q = await qazaSection(Number(u.id), u.qaza_goal, date);
    if (q) parts.push(q);
  }
  const extra = await extrasSection(u, date).catch((e) => (console.error("[morning] extras:", e), null));
  if (extra) parts.push(extra);
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
  if (!due.morning.length && !due.prayers.length && !due.fasts.length) return { ...res, skipped: !res.planLoaded };

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
  // 3) Saharlik va iftorlik
  for (const { u, kind } of due.fasts) {
    const key = `f:${date}:${kind}`;
    if (!(await claim(Number(u.id), key))) continue;
    const t = plan.times.get(u.region)!;
    const h = hijri(date);
    const day = h.month === 9 ? ` · Ramazonning ${h.day}-kuni` : "";
    const text =
      kind === "sahar"
        ? `🌙 <b>Saharlik</b> — og'iz yopishga ${u.sahar_offset || 30} daqiqa qoldi (${t.bomdod})${day}\n<i>${esc(u.region)}</i>`
        : `🌇 <b>Iftorlik vaqti</b> — ${t.shom}${day}\nRo'zangiz qabul bo'lsin! 🤲\n<i>${esc(u.region)}</i>`;
    const extra =
      kind === "iftor"
        ? { reply_markup: { inline_keyboard: [[{ text: "✅ Ro'za tutdim", callback_data: `fs:${date}:tutdim` }, { text: "Tutmadim", callback_data: `fs:${date}:qoldi` }]] } }
        : {};
    res.preview?.push({ uid: Number(u.id), kind: `fast:${kind}`, text });
    const ok = await send(Number(u.id), text, extra);
    if (ok) res.prayer++;
    else await release(Number(u.id), key);
  }
  return res;
}
