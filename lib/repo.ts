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
  books: ["title", "author", "genre", "status", "total_pages", "current_page", "rating", "started", "finished", "note"],
  holdings: ["coin", "symbol", "name", "amount", "avg_price"],
  bills: ["name", "amount", "day", "category", "remind_days", "last_paid", "active", "note"],
  birthdays: ["name", "month", "day", "year", "note"],
} as const;

export type TableName = keyof typeof TABLES;

export function isTable(t: string): t is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, t);
}

const NUM = new Set(["target", "saved", "amount", "paid", "price", "total_pages", "current_page", "rating", "avg_price", "day", "month", "year", "remind_days", "active"]);

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
  const [goals, debts, purchases, payments, transactions, tasks, habits, habit_logs, notes, books, holdings, qaza, prayer_log, bills, budgets, birthdays, fast_log, quranRows, quran_log, zakatRows] = await Promise.all([
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
    q(`SELECT date, prayer FROM prayer_log WHERE user_id=$1 AND date >= CURRENT_DATE - 7`),
    q(`SELECT * FROM bills WHERE user_id=$1 ORDER BY active DESC, day, id`),
    q(`SELECT category, amount FROM budgets WHERE user_id=$1`),
    q(`SELECT * FROM birthdays WHERE user_id=$1 ORDER BY month, day`),
    q(`SELECT date, status FROM fast_log WHERE user_id=$1 AND date >= CURRENT_DATE - 400 ORDER BY date`),
    q(`SELECT page, khatm FROM quran WHERE user_id=$1`),
    q(`SELECT date, pages FROM quran_log WHERE user_id=$1 AND date >= CURRENT_DATE - 60 ORDER BY date`),
    q(`SELECT * FROM zakat WHERE user_id=$1`),
  ]);
  return {
    goals, debts, purchases, payments, transactions, tasks, habits, habit_logs, notes, books, holdings, qaza, prayer_log,
    bills, budgets, birthdays, fast_log, quran_log,
    quran: quranRows[0] ?? { page: 0, khatm: 0 },
    zakat: zakatRows[0] ?? null,
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
};

const USER_COLS = "id, first_name, last_name, username, photo_url, daily_digest, morning_time, crypto_report, region, prayer_remind, prayer_offset, prayer_list, qaza_remind, qaza_goal, fast_remind, sahar_offset, quran_goal";

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
    for (const t of ["habit_logs", "payments", "goals", "debts", "purchases", "transactions", "tasks", "habits", "notes", "books", "holdings", "qaza", "prayer_log", "sent_log", "bills", "budgets", "birthdays", "fast_log", "quran", "quran_log", "zakat"])
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

export async function setPrayed(uid: number, date: string, prayer: string, on: boolean) {
  if (!(PRAYERS as readonly string[]).includes(prayer)) throw new Error("Noto'g'ri namoz");
  const db = await getDb();
  if (on) await db.query("INSERT INTO prayer_log (user_id, date, prayer) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [uid, date, prayer]);
  else await db.query("DELETE FROM prayer_log WHERE user_id=$1 AND date=$2 AND prayer=$3", [uid, date, prayer]);
}

/** delta>0 — qazo qo'shildi, delta<0 — qazo o'qildi (done_total oshadi) */
export async function changeQaza(uid: number, prayer: string, delta: number) {
  if (!(QAZA_KINDS as readonly string[]).includes(prayer)) throw new Error("Noto'g'ri namoz");
  const d = Math.max(-1000, Math.min(10000, Math.trunc(delta)));
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO qaza (user_id, prayer, count, done_total) VALUES ($1,$2,GREATEST(0,$3),0)
     ON CONFLICT (user_id, prayer) DO UPDATE SET
       done_total = qaza.done_total + CASE WHEN $3 < 0 THEN LEAST(-$3, qaza.count) ELSE 0 END,
       count = GREATEST(0, qaza.count + $3)
     RETURNING prayer, count, done_total`,
    [uid, prayer, d]
  );
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
