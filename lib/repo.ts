import { getDb } from "./db";
import type { AllData } from "./types";

// Har bir jadval uchun ruxsat etilgan ustunlar (SQL injection'dan himoya).
// user_id bu yerda YO'Q — uni foydalanuvchi o'zgartira olmaydi, faqat sessiyadan olinadi.
export const TABLES = {
  goals: ["name", "target", "saved", "deadline", "note"],
  debts: ["direction", "person", "amount", "paid", "taken_date", "due_date", "note"],
  purchases: ["name", "price", "planned_date", "priority", "bought", "note"],
  transactions: ["type", "amount", "category", "date", "note"],
  tasks: ["title", "note", "due_date", "priority", "done"],
  habits: ["name", "kind", "emoji", "archived"],
  notes: ["title", "body", "pinned", "color"],
  books: ["title", "author", "genre", "status", "total_pages", "current_page", "rating", "started", "finished", "note", "learned", "apply", "recommend"],
  quotes: ["book_id", "text", "page"],
  holdings: ["coin", "symbol", "name", "amount", "avg_price"],
  bills: ["name", "amount", "day", "category", "remind_days", "last_paid", "active", "note"],
  birthdays: ["name", "month", "day", "year", "note"],
} as const;

export type TableName = keyof typeof TABLES;

export function isTable(t: string): t is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, t);
}

const NUM = new Set(["target", "saved", "amount", "paid", "price", "total_pages", "current_page", "rating", "avg_price", "day", "month", "year", "remind_days", "active", "book_id", "page"]);

function pick(table: TableName, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const col of TABLES[table]) {
    if (col in body) {
      let v = body[col];
      if (v === "") v = null;
      if (typeof v === "boolean") v = v ? 1 : 0;
      if (NUM.has(col) && v !== null) {
        // Kripto miqdori va narxi kasr bo'ladi — yaxlitlamaymiz
        v = table === "holdings" ? Number(v) || 0 : Math.round(Number(v) || 0);
        if (table === "holdings" && (!Number.isFinite(v as number) || (v as number) < 0)) throw new Error("Noto'g'ri miqdor");
      }
      out[col] = v;
    }
  }
  return out;
}

// Javobdan user_id ni olib tashlash (ichki maydon)
function clean<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(({ user_id: _u, ...r }) => r as T);
}

export async function getAll(uid: number): Promise<AllData> {
  const db = await getDb();
  const q = (sql: string) => db.query(sql, [uid]).then((r) => clean(r.rows));
  const [goals, debts, purchases, payments, transactions, tasks, habits, habit_logs, notes, books, holdings, qaza, prayer_log, bills, budgets, birthdays, fast_log, quranRows, quran_log, zakatRows, qaza_log, since, reading_days, speedRows, quotes] = await Promise.all([
    q(`SELECT * FROM goals WHERE user_id=$1 ORDER BY deadline NULLS LAST, id DESC`),
    q(`SELECT * FROM debts WHERE user_id=$1 ORDER BY due_date NULLS LAST, id DESC`),
    q(`SELECT * FROM purchases WHERE user_id=$1 ORDER BY bought, planned_date NULLS LAST, id DESC`),
    q(`SELECT * FROM payments WHERE user_id=$1 ORDER BY date DESC, id DESC`),
    q(`SELECT * FROM transactions WHERE user_id=$1 ORDER BY date DESC, id DESC`),
    q(`SELECT * FROM tasks WHERE user_id=$1 ORDER BY done, due_date NULLS LAST, id DESC`),
    q(`SELECT * FROM habits WHERE user_id=$1 ORDER BY id`),
    q(`SELECT * FROM habit_logs WHERE user_id=$1 AND date >= CURRENT_DATE - 400`),
    q(`SELECT * FROM notes WHERE user_id=$1 ORDER BY pinned DESC, updated_at DESC`),
    q(`SELECT * FROM books WHERE user_id=$1 ORDER BY CASE status WHEN 'oqiyapman' THEN 0 WHEN 'reja' THEN 1 ELSE 2 END, finished DESC NULLS LAST, id DESC`),
    q(`SELECT * FROM holdings WHERE user_id=$1 ORDER BY id`),
    q(`SELECT prayer, count, done_total FROM qaza WHERE user_id=$1`),
    q(`SELECT date, prayer, status FROM prayer_log WHERE user_id=$1 AND date >= CURRENT_DATE - 45`),
    q(`SELECT * FROM bills WHERE user_id=$1 ORDER BY active DESC, day, id`),
    q(`SELECT category, amount FROM budgets WHERE user_id=$1`),
    q(`SELECT * FROM birthdays WHERE user_id=$1 ORDER BY month, day`),
    q(`SELECT date, status FROM fast_log WHERE user_id=$1 AND date >= CURRENT_DATE - 400 ORDER BY date`),
    q(`SELECT page, khatm FROM quran WHERE user_id=$1`),
    q(`SELECT date, pages FROM quran_log WHERE user_id=$1 AND date >= CURRENT_DATE - 60 ORDER BY date`),
    q(`SELECT * FROM zakat WHERE user_id=$1`),
    q(`SELECT date, prayer, delta, kind, to_char(created_at AT TIME ZONE 'Asia/Tashkent','HH24:MI') AS time FROM qaza_log WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200`),
    q(`SELECT LEAST((SELECT (created_at AT TIME ZONE 'Asia/Tashkent')::date FROM users WHERE id=$1), (SELECT MIN(date) FROM prayer_log WHERE user_id=$1)) AS d`),
    q(`SELECT date, SUM(pages)::int AS pages, SUM(minutes)::int AS minutes FROM reading_log WHERE user_id=$1 AND date >= CURRENT_DATE - 400 GROUP BY date ORDER BY date`),
    q(`SELECT COALESCE(SUM(pages),0)::int AS pages, COALESCE(SUM(minutes),0)::int AS minutes FROM reading_log WHERE user_id=$1 AND minutes > 0 AND pages > 0 AND date >= CURRENT_DATE - 120`),
    q(`SELECT * FROM quotes WHERE user_id=$1 ORDER BY id DESC`),
  ]);
  return {
    goals, debts, purchases, payments, transactions, tasks, habits, habit_logs, notes, books, holdings, qaza, prayer_log,
    bills, budgets, birthdays, fast_log, quran_log,
    quran: quranRows[0] ?? { page: 0, khatm: 0 },
    zakat: zakatRows[0] ?? null,
    qaza_log,
    tracking_since: since[0]?.d ? String(since[0].d).slice(0, 10) : null,
    reading_days,
    reading_speed: speedRows[0] ?? { pages: 0, minutes: 0 },
    quotes,
  } as unknown as AllData;
}

export async function insert(uid: number, table: TableName, body: Record<string, unknown>) {
  const data = { ...pick(table, body), user_id: uid };
  const cols = Object.keys(data) as (keyof typeof data)[];
  if (cols.length < 2) throw new Error("Ma'lumot bo'sh");
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`;
  const db = await getDb();
  const r = await db.query(sql, cols.map((c) => data[c]));
  return clean(r.rows)[0];
}

export async function update(uid: number, table: TableName, id: number, body: Record<string, unknown>) {
  const data = pick(table, body);
  const cols = Object.keys(data);
  const db = await getDb();
  if (cols.length) {
    const extra: string[] = [];
    if (table === "notes") extra.push("updated_at=now()");
    if (table === "tasks" && "done" in data) extra.push(Number(data.done) ? "done_at=now()" : "done_at=NULL");
    const sets = [...cols.map((c, i) => `${c}=$${i + 1}`), ...extra].join(",");
    const n = cols.length;
    await db.query(`UPDATE ${table} SET ${sets} WHERE id=$${n + 1} AND user_id=$${n + 2}`, [...cols.map((c) => data[c]), id, uid]);
  }
  const r = await db.query(`SELECT * FROM ${table} WHERE id=$1 AND user_id=$2`, [id, uid]);
  if (!r.rows[0]) throw new Error("Topilmadi");
  return clean(r.rows)[0];
}

// Bir nechta so'rovni bitta tranzaksiyada bajarish
type Q = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
async function tx(fn: (q: Q) => Promise<void>) {
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await fn((sql, params) => client.query(sql, params));
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function remove(uid: number, table: TableName, id: number) {
  await tx(async (q) => {
    const r = await q(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`, [id, uid]);
    if (!r.rowCount) return;
    if (table === "goals") await q("DELETE FROM payments WHERE kind='goal' AND ref_id=$1 AND user_id=$2", [id, uid]);
    if (table === "debts") await q("DELETE FROM payments WHERE kind='debt' AND ref_id=$1 AND user_id=$2", [id, uid]);
  });
}

// Maqsadga pul qo'shish yoki qarzni to'lash (qisman bo'lishi mumkin)
export async function addPayment(uid: number, kind: "goal" | "debt", refId: number, amount: number, date: string, note?: string) {
  const amt = Math.round(amount);
  const table = kind === "goal" ? "goals" : "debts";
  const col = kind === "goal" ? "saved" : "paid";
  await tx(async (q) => {
    // Avval yozuv shu foydalanuvchiga tegishli ekanini tekshiramiz
    const own = await q(`UPDATE ${table} SET ${col} = GREATEST(0, ${col} + $1) WHERE id=$2 AND user_id=$3`, [amt, refId, uid]);
    if (!own.rowCount) throw new Error("Topilmadi");
    await q("INSERT INTO payments (kind, ref_id, amount, date, note, user_id) VALUES ($1,$2,$3,$4,$5,$6)", [kind, refId, amt, date, note || null, uid]);
  });
}

export async function removePayment(uid: number, id: number) {
  await tx(async (q) => {
    const r = await q("SELECT * FROM payments WHERE id=$1 AND user_id=$2 FOR UPDATE", [id, uid]);
    const p = r.rows[0] as { kind: "goal" | "debt"; ref_id: number; amount: number } | undefined;
    if (!p) return;
    if (p.kind === "goal") await q("UPDATE goals SET saved = GREATEST(0, saved - $1) WHERE id=$2 AND user_id=$3", [p.amount, p.ref_id, uid]);
    else await q("UPDATE debts SET paid = GREATEST(0, paid - $1) WHERE id=$2 AND user_id=$3", [p.amount, p.ref_id, uid]);
    await q("DELETE FROM payments WHERE id=$1 AND user_id=$2", [id, uid]);
  });
}

// Odat / kunlik vazifani shu kun uchun belgilash yoki belgini olib tashlash
export async function toggleHabit(uid: number, habitId: number, date: string, on?: boolean) {
  const db = await getDb();
  const own = await db.query("SELECT 1 FROM habits WHERE id=$1 AND user_id=$2", [habitId, uid]);
  if (!own.rowCount) throw new Error("Topilmadi");
  const exists = (await db.query("SELECT 1 FROM habit_logs WHERE habit_id=$1 AND date=$2", [habitId, date])).rowCount;
  const want = on ?? !exists;
  if (want && !exists)
    await db.query("INSERT INTO habit_logs (habit_id, date, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [habitId, date, uid]);
  if (!want && exists) await db.query("DELETE FROM habit_logs WHERE habit_id=$1 AND date=$2 AND user_id=$3", [habitId, date, uid]);
  return want;
}

/* ---------- Foydalanuvchilar ---------- */
export type User = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  daily_digest: number;
  morning_time: string;
  crypto_report: number;
  region: string;
  prayer_remind: number;
  prayer_offset: number;
  prayer_list: string;
  qaza_remind: number;
  qaza_goal: number;
  fast_remind: number;
  sahar_offset: number;
  quran_goal: number;
  read_goal: number;
  read_year_goal: number;
  read_remind: number;
  read_remind_time: string;
  quote_morning: number;
  ru_enabled?: number;
  ru_remind?: number;
  ru_remind_time?: string;
  ru_daily_new?: number;
  ru_daily_xp?: number;
};

const USER_COLS =
  "id, first_name, last_name, username, photo_url, daily_digest, morning_time, crypto_report, region, prayer_remind, prayer_offset, prayer_list, qaza_remind, qaza_goal, fast_remind, sahar_offset, quran_goal, read_goal, read_year_goal, read_remind, read_remind_time, quote_morning, ru_enabled, ru_remind, ru_remind_time, ru_daily_new, ru_daily_xp";

export async function upsertUser(u: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }) {
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO users (id, first_name, last_name, username, photo_url) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET
       first_name = COALESCE(EXCLUDED.first_name, users.first_name),
       last_name = COALESCE(EXCLUDED.last_name, users.last_name),
       username = COALESCE(EXCLUDED.username, users.username),
       photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
       last_seen = now()
     RETURNING ${USER_COLS}`,
    [u.id, u.first_name ?? null, u.last_name ?? null, u.username ?? null, u.photo_url ?? null]
  );
  return r.rows[0] as User;
}

export async function getUser(uid: number): Promise<User | null> {
  const db = await getDb();
  const r = await db.query(`SELECT ${USER_COLS} FROM users WHERE id=$1`, [uid]);
  return (r.rows[0] as User) ?? null;
}

export async function setDigest(uid: number, on: boolean) {
  const db = await getDb();
  await db.query("UPDATE users SET daily_digest=$1 WHERE id=$2", [on ? 1 : 0, uid]);
}

// Foydalanuvchining barcha ma'lumotlarini o'chirish (hisobni o'chirish)
export async function deleteAccount(uid: number) {
  await tx(async (q) => {
    for (const t of ["habit_logs", "payments", "goals", "debts", "purchases", "transactions", "tasks", "habits", "notes", "books", "holdings", "qaza", "prayer_log", "sent_log", "bills", "budgets", "birthdays", "fast_log", "quran", "quran_log", "zakat", "qaza_log", "reading_log", "quotes"])
      await q(`DELETE FROM ${t} WHERE user_id=$1`, [uid]);
    await q("DELETE FROM users WHERE id=$1", [uid]);
  });
}

/** Sozlamalarni yangilash — faqat ruxsat etilgan maydonlar, tekshiruv bilan */
export async function updateSettings(uid: number, b: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  const put = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col}=$${vals.length}`);
  };
  const bool = (k: string) => typeof b[k] === "boolean" && put(k, b[k] ? 1 : 0);
  bool("daily_digest");
  bool("crypto_report");
  bool("prayer_remind");
  bool("qaza_remind");
  bool("fast_remind");
  bool("read_remind");
  bool("quote_morning");
  bool("ru_remind");
  if ([5, 10, 15, 20, 30, 50].includes(Number(b.ru_daily_new))) put("ru_daily_new", Number(b.ru_daily_new));
  if ([20, 50, 100, 150, 250].includes(Number(b.ru_daily_xp))) put("ru_daily_xp", Number(b.ru_daily_xp));
  if (typeof b.ru_remind_time === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(b.ru_remind_time)) put("ru_remind_time", b.ru_remind_time);
  if (typeof b.read_remind_time === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(b.read_remind_time)) put("read_remind_time", b.read_remind_time);
  if (Number.isInteger(Number(b.read_goal)) && Number(b.read_goal) >= 0 && Number(b.read_goal) <= 500) put("read_goal", Number(b.read_goal));
  if (Number.isInteger(Number(b.read_year_goal)) && Number(b.read_year_goal) >= 0 && Number(b.read_year_goal) <= 365) put("read_year_goal", Number(b.read_year_goal));
  if ([15, 30, 45, 60].includes(Number(b.sahar_offset))) put("sahar_offset", Number(b.sahar_offset));
  if (Number.isInteger(Number(b.quran_goal)) && Number(b.quran_goal) >= 0 && Number(b.quran_goal) <= 100) put("quran_goal", Number(b.quran_goal));
  if (typeof b.morning_time === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(b.morning_time)) put("morning_time", b.morning_time);
  if (typeof b.region === "string" && b.region.length < 40) put("region", b.region);
  if ([0, 5, 10, 15].includes(Number(b.prayer_offset))) put("prayer_offset", Number(b.prayer_offset));
  if (typeof b.prayer_list === "string") {
    const ok = b.prayer_list.split(",").filter((x) => ["bomdod", "peshin", "asr", "shom", "xufton"].includes(x));
    put("prayer_list", ok.join(","));
  }
  if (Number.isInteger(Number(b.qaza_goal)) && Number(b.qaza_goal) >= 0 && Number(b.qaza_goal) <= 50) put("qaza_goal", Number(b.qaza_goal));
  if (!sets.length) return;
  vals.push(uid);
  const db = await getDb();
  await db.query(`UPDATE users SET ${sets.join(",")} WHERE id=$${vals.length}`, vals);
}

/* ---------- Namoz va qazo ---------- */
export const PRAYERS = ["bomdod", "peshin", "asr", "shom", "xufton"] as const;
export const QAZA_KINDS = ["bomdod", "peshin", "asr", "shom", "xufton", "vitr", "roza"] as const;

/** Eski API: o'qildi belgisini qo'yish/olib tashlash */
export async function setPrayed(uid: number, date: string, prayer: string, on: boolean) {
  return setPrayerStatus(uid, date, prayer, on ? "oqildi" : null);
}

/**
 * Namoz holati: 'oqildi' | 'qazo' (qazo hisobiga yozildi) | null (belgilanmagan).
 * 'qazo' ga o'tganda qazo hisobi +1, 'qazo' dan chiqqanda −1 (tuzatish, o'qilgan hisoblanmaydi).
 */
export async function setPrayerStatus(uid: number, date: string, prayer: string, status: "oqildi" | "qazo" | null) {
  if (!(PRAYERS as readonly string[]).includes(prayer)) throw new Error("Noto'g'ri namoz");
  const db = await getDb();
  const prev = (await db.query("SELECT status FROM prayer_log WHERE user_id=$1 AND date=$2 AND prayer=$3", [uid, date, prayer])).rows[0]?.status ?? null;
  if (prev === status) return;
  if (status) {
    await db.query(
      `INSERT INTO prayer_log (user_id, date, prayer, status) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, date, prayer) DO UPDATE SET status=EXCLUDED.status`,
      [uid, date, prayer, status]
    );
  } else {
    await db.query("DELETE FROM prayer_log WHERE user_id=$1 AND date=$2 AND prayer=$3", [uid, date, prayer]);
  }
  if (status === "qazo") await changeQaza(uid, prayer, 1, "day", date);
  if (prev === "qazo") await changeQaza(uid, prayer, -1, "fix", date);
}

/** Sanalar oralig'idagi belgilanmagan namozlarni qazoga yozish (bugungi kun kirmaydi) */
export async function bulkMissedToQaza(uid: number, from: string, to: string) {
  const db = await getDb();
  const r = await db.query(
    `SELECT d::date AS date, p AS prayer
       FROM generate_series($2::date, $3::date, interval '1 day') d
       CROSS JOIN unnest(ARRAY['bomdod','peshin','asr','shom','xufton']) p
      WHERE NOT EXISTS (SELECT 1 FROM prayer_log l WHERE l.user_id=$1 AND l.date=d::date AND l.prayer=p)`,
    [uid, from, to]
  );
  for (const row of r.rows) await setPrayerStatus(uid, String(row.date).slice(0, 10), row.prayer, "qazo");
  return r.rows.length;
}

/**
 * delta>0 — qazo qo'shildi, delta<0 — qazo o'qildi (done_total oshadi).
 * kind='fix' — xato tuzatish: done_total o'zgarmaydi.
 */
export async function changeQaza(uid: number, prayer: string, delta: number, kind: "manual" | "day" | "fix" = "manual", date?: string) {
  if (!(QAZA_KINDS as readonly string[]).includes(prayer)) throw new Error("Noto'g'ri namoz");
  const d = Math.max(-1000, Math.min(10000, Math.trunc(delta)));
  if (!d) throw new Error("delta kerak");
  const db = await getDb();
  const done = kind === "fix" ? 0 : 1;
  const r = await db.query(
    `INSERT INTO qaza (user_id, prayer, count, done_total) VALUES ($1,$2,GREATEST(0,$3),0)
     ON CONFLICT (user_id, prayer) DO UPDATE SET
       done_total = qaza.done_total + CASE WHEN $3 < 0 AND $4 = 1 THEN LEAST(-$3, qaza.count) ELSE 0 END,
       count = GREATEST(0, qaza.count + $3)
     RETURNING prayer, count, done_total`,
    [uid, prayer, d, done]
  );
  await db.query("INSERT INTO qaza_log (user_id, date, prayer, delta, kind) VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5)", [
    uid,
    date ?? null,
    prayer,
    d,
    kind,
  ]);
  return r.rows[0];
}

/* ---------- Byudjet ---------- */
export async function setBudget(uid: number, category: string, amount: number) {
  const db = await getDb();
  const a = Math.round(Number(amount) || 0);
  if (!category || category.length > 40) throw new Error("Noto'g'ri kategoriya");
  if (a <= 0) await db.query("DELETE FROM budgets WHERE user_id=$1 AND category=$2", [uid, category]);
  else
    await db.query(
      "INSERT INTO budgets (user_id, category, amount) VALUES ($1,$2,$3) ON CONFLICT (user_id, category) DO UPDATE SET amount=EXCLUDED.amount",
      [uid, category, a]
    );
}

/* ---------- To'lovlar ---------- */
/** To'lov qilindi: last_paid = sana, ixtiyoriy ravishda xarajatga yozish */
export async function payBill(uid: number, id: number, date: string, addTx: boolean) {
  const db = await getDb();
  const r = await db.query("UPDATE bills SET last_paid=$1 WHERE id=$2 AND user_id=$3 RETURNING name, amount, category", [date, id, uid]);
  const b = r.rows[0];
  if (!b) throw new Error("Topilmadi");
  if (addTx && Number(b.amount) > 0) {
    await insert(uid, "transactions", { type: "chiqim", amount: b.amount, category: b.category, date, note: b.name });
  }
  return b;
}

/* ---------- Ro'za ---------- */
export async function setFast(uid: number, date: string, status: "niyat" | "tutdim" | "qoldi" | null) {
  const db = await getDb();
  if (!status) await db.query("DELETE FROM fast_log WHERE user_id=$1 AND date=$2", [uid, date]);
  else
    await db.query(
      "INSERT INTO fast_log (user_id, date, status) VALUES ($1,$2,$3) ON CONFLICT (user_id, date) DO UPDATE SET status=EXCLUDED.status",
      [uid, date, status]
    );
}

/* ---------- Qur'on ---------- */
export const QURAN_PAGES = 604;
/** Sahifa qo'shish (manfiy — tuzatish). Xatm tugasa hisob oshadi va sahifa boshidan davom etadi */
export async function addQuranPages(uid: number, date: string, pages: number) {
  const n = Math.max(-QURAN_PAGES, Math.min(QURAN_PAGES, Math.trunc(pages)));
  if (!n) throw new Error("Sahifa soni kerak");
  const db = await getDb();
  await db.query("INSERT INTO quran (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [uid]);
  const cur = (await db.query("SELECT page, khatm FROM quran WHERE user_id=$1", [uid])).rows[0];
  let page = Number(cur.page) + n;
  let khatm = Number(cur.khatm);
  let finished = false;
  while (page >= QURAN_PAGES) {
    page -= QURAN_PAGES;
    khatm++;
    finished = true;
  }
  if (page < 0) page = 0;
  await db.query("UPDATE quran SET page=$1, khatm=$2 WHERE user_id=$3", [page, khatm, uid]);
  await db.query(
    `INSERT INTO quran_log (user_id, date, pages) VALUES ($1,$2,GREATEST(0,$3))
     ON CONFLICT (user_id, date) DO UPDATE SET pages = GREATEST(0, quran_log.pages + $3)`,
    [uid, date, n]
  );
  return { page, khatm, finished };
}

export async function setQuranPage(uid: number, page: number, khatm?: number) {
  const db = await getDb();
  const p = Math.max(0, Math.min(QURAN_PAGES - 1, Math.trunc(page)));
  await db.query(
    "INSERT INTO quran (user_id, page, khatm) VALUES ($1,$2,COALESCE($3,0)) ON CONFLICT (user_id) DO UPDATE SET page=EXCLUDED.page, khatm=COALESCE($3, quran.khatm)",
    [uid, p, khatm === undefined ? null : Math.max(0, Math.trunc(khatm))]
  );
}

/* ---------- Zakot ---------- */
const ZAKAT_COLS = ["cash_uzs", "cash_usd", "gold_g", "trade_uzs", "nisab_uzs", "include_goals", "include_crypto", "include_debts"] as const;
export async function saveZakat(uid: number, b: Record<string, unknown>) {
  const vals: Record<string, number> = {};
  for (const c of ZAKAT_COLS) {
    if (c in b) {
      let v = Number(b[c]);
      if (typeof b[c] === "boolean") v = b[c] ? 1 : 0;
      if (!Number.isFinite(v) || v < 0) throw new Error("Noto'g'ri qiymat");
      vals[c] = c === "cash_usd" || c === "gold_g" ? v : Math.round(v);
    }
  }
  const cols = Object.keys(vals);
  const db = await getDb();
  await db.query("INSERT INTO zakat (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [uid]);
  if (cols.length)
    await db.query(`UPDATE zakat SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(",")}, updated_at=now() WHERE user_id=$${cols.length + 1}`, [
      ...cols.map((c) => vals[c]),
      uid,
    ]);
}

/* ---------- Kitob o'qish ---------- */
/**
 * Kitobdagi yangi sahifani yozish: farqni o'qish jurnaliga qo'shadi, holatni yangilaydi.
 * page — yangi joriy sahifa; minutes — taymer bo'yicha o'qilgan vaqt (ixtiyoriy).
 */
export async function logReading(uid: number, bookId: number, page: number, minutes: number, date: string) {
  const db = await getDb();
  const r = await db.query("SELECT id, status, total_pages, current_page, started FROM books WHERE id=$1 AND user_id=$2", [bookId, uid]);
  const b = r.rows[0];
  if (!b) throw new Error("Topilmadi");
  let p = Math.max(0, Math.trunc(page));
  if (b.total_pages) p = Math.min(p, Number(b.total_pages));
  const delta = Math.max(0, p - Number(b.current_page || 0));
  const finished = !!b.total_pages && p >= Number(b.total_pages) && b.status !== "oqidim";
  const status = finished ? "oqidim" : b.status === "reja" && p > 0 ? "oqiyapman" : b.status;
  await db.query(
    `UPDATE books SET current_page=$1, status=$2,
       started = COALESCE(started, CASE WHEN $2 <> 'reja' THEN $4::date END),
       finished = CASE WHEN $3 THEN $4::date ELSE finished END
     WHERE id=$5 AND user_id=$6`,
    [p, status, finished, date, bookId, uid]
  );
  const mins = Math.max(0, Math.min(600, Math.trunc(minutes || 0)));
  if (delta > 0 || mins > 0) {
    await db.query("INSERT INTO reading_log (user_id, book_id, date, pages, minutes) VALUES ($1,$2,$3,$4,$5)", [uid, bookId, date, delta, mins]);
  }
  return { delta, finished, page: p };
}

/** Bot uchun: hozir o'qilayotgan (oxirgi yangilangan) kitobga N sahifa qo'shish */
export async function addPagesToCurrent(uid: number, pages: number, date: string) {
  const db = await getDb();
  const b = (
    await db.query(
      `SELECT b.id, b.title, b.current_page, b.total_pages FROM books b
        LEFT JOIN LATERAL (SELECT MAX(created_at) t FROM reading_log r WHERE r.book_id=b.id) l ON true
        WHERE b.user_id=$1 AND b.status='oqiyapman' ORDER BY l.t DESC NULLS LAST, b.id DESC LIMIT 1`,
      [uid]
    )
  ).rows[0];
  if (!b) {
    await db.query("INSERT INTO reading_log (user_id, book_id, date, pages) VALUES ($1,NULL,$2,$3)", [uid, date, Math.max(0, Math.trunc(pages))]);
    return { title: null as string | null, page: null as number | null, total: null as number | null, finished: false };
  }
  const r = await logReading(uid, b.id, Number(b.current_page) + Math.trunc(pages), 0, date);
  return { title: b.title as string, page: r.page, total: b.total_pages ? Number(b.total_pages) : null, finished: r.finished };
}

/** Ketma-ket o'qilgan kunlar (bugun hali o'qilmagan bo'lsa — kechadan hisoblanadi) */
export async function readingStreak(uid: number, today: string) {
  const db = await getDb();
  const days = (
    await db.query("SELECT DISTINCT date FROM reading_log WHERE user_id=$1 AND pages > 0 AND date >= $2::date - 400 ORDER BY date DESC", [uid, today])
  ).rows.map((r) => String(r.date).slice(0, 10));
  const set = new Set(days);
  const addD = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  let d = set.has(today) ? today : addD(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addD(d, -1);
  }
  return { streak: n, readToday: set.has(today) };
}
