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
  books: ["title", "author", "status", "total_pages", "current_page", "rating", "started", "finished", "note"],
} as const;

export type TableName = keyof typeof TABLES;

export function isTable(t: string): t is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, t);
}

const NUM = new Set(["target", "saved", "amount", "paid", "price", "total_pages", "current_page", "rating"]);

function pick(table: TableName, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const col of TABLES[table]) {
    if (col in body) {
      let v = body[col];
      if (v === "") v = null;
      if (typeof v === "boolean") v = v ? 1 : 0;
      if (NUM.has(col) && v !== null) v = Math.round(Number(v) || 0);
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
  const [goals, debts, purchases, payments, transactions, tasks, habits, habit_logs, notes, books] = await Promise.all([
    q(`SELECT * FROM goals WHERE user_id=$1 ORDER BY deadline NULLS LAST, id DESC`),
    q(`SELECT * FROM debts WHERE user_id=$1 ORDER BY due_date NULLS LAST, id DESC`),
    q(`SELECT * FROM purchases WHERE user_id=$1 ORDER BY bought, planned_date NULLS LAST, id DESC`),
    q(`SELECT * FROM payments WHERE user_id=$1 ORDER BY date DESC, id DESC`),
    q(`SELECT * FROM transactions WHERE user_id=$1 ORDER BY date DESC, id DESC`),
    q(`SELECT * FROM tasks WHERE user_id=$1 ORDER BY done, due_date NULLS LAST, id DESC`),
    q(`SELECT * FROM habits WHERE user_id=$1 ORDER BY id`),
    q(`SELECT * FROM habit_logs WHERE user_id=$1 AND date >= CURRENT_DATE - 400`),
    q(`SELECT * FROM notes WHERE user_id=$1 ORDER BY pinned DESC, updated_at DESC`),
    q(`SELECT * FROM books WHERE user_id=$1 ORDER BY CASE status WHEN 'oqiyapman' THEN 0 WHEN 'reja' THEN 1 ELSE 2 END, id DESC`),
  ]);
  return { goals, debts, purchases, payments, transactions, tasks, habits, habit_logs, notes, books } as unknown as AllData;
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
};

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
     RETURNING id, first_name, last_name, username, photo_url, daily_digest`,
    [u.id, u.first_name ?? null, u.last_name ?? null, u.username ?? null, u.photo_url ?? null]
  );
  return r.rows[0] as User;
}

export async function getUser(uid: number): Promise<User | null> {
  const db = await getDb();
  const r = await db.query("SELECT id, first_name, last_name, username, photo_url, daily_digest FROM users WHERE id=$1", [uid]);
  return (r.rows[0] as User) ?? null;
}

export async function setDigest(uid: number, on: boolean) {
  const db = await getDb();
  await db.query("UPDATE users SET daily_digest=$1 WHERE id=$2", [on ? 1 : 0, uid]);
}

// Foydalanuvchining barcha ma'lumotlarini o'chirish (hisobni o'chirish)
export async function deleteAccount(uid: number) {
  await tx(async (q) => {
    for (const t of ["habit_logs", "payments", "goals", "debts", "purchases", "transactions", "tasks", "habits", "notes", "books"])
      await q(`DELETE FROM ${t} WHERE user_id=$1`, [uid]);
    await q("DELETE FROM users WHERE id=$1", [uid]);
  });
}
