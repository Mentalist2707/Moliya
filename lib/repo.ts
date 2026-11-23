import { getDb } from "./db";
import type { AllData } from "./types";

// Har bir jadval uchun ruxsat etilgan ustunlar (SQL injection'dan himoya)
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

const MONEY = new Set(["target", "saved", "amount", "paid", "price", "total_pages", "current_page", "rating"]);

function pick(table: TableName, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const col of TABLES[table]) {
    if (col in body) {
      let v = body[col];
      if (v === "") v = null;
      if (typeof v === "boolean") v = v ? 1 : 0;
      if (MONEY.has(col) && v !== null) v = Math.round(Number(v) || 0);
      out[col] = v;
    }
  }
  return out;
}

export async function getAll(): Promise<AllData> {
  const db = await getDb();
  const q = (sql: string) => db.query(sql).then((r) => r.rows);
  const [g, d, p, pay, transactions, tasks, habits, habit_logs, notes, books] = await Promise.all([
    db.query(`SELECT * FROM goals ORDER BY deadline NULLS LAST, id DESC`),
    db.query(`SELECT * FROM debts ORDER BY due_date NULLS LAST, id DESC`),
    db.query(`SELECT * FROM purchases ORDER BY bought, planned_date NULLS LAST, id DESC`),
    db.query(`SELECT * FROM payments ORDER BY date DESC, id DESC`),
    q(`SELECT * FROM transactions ORDER BY date DESC, id DESC`),
    q(`SELECT * FROM tasks ORDER BY done, due_date NULLS LAST, id DESC`),
    q(`SELECT * FROM habits ORDER BY id`),
    q(`SELECT * FROM habit_logs WHERE date >= CURRENT_DATE - 400`),
    q(`SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC`),
    q(`SELECT * FROM books ORDER BY CASE status WHEN 'oqiyapman' THEN 0 WHEN 'reja' THEN 1 ELSE 2 END, id DESC`),
  ]);
  return {
    goals: g.rows,
    debts: d.rows,
    purchases: p.rows,
    payments: pay.rows,
    transactions,
    tasks,
    habits,
    habit_logs,
    notes,
    books,
  } as AllData;
}

export async function insert(table: TableName, body: Record<string, unknown>) {
  const data = pick(table, body);
  const cols = Object.keys(data);
  if (!cols.length) throw new Error("Ma'lumot bo'sh");
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`;
  const db = await getDb();
  const r = await db.query(sql, cols.map((c) => data[c]));
  return r.rows[0];
}

export async function update(table: TableName, id: number, body: Record<string, unknown>) {
  const data = pick(table, body);
  const cols = Object.keys(data);
  const db = await getDb();
  if (cols.length) {
    const extra: string[] = [];
    if (table === "notes") extra.push("updated_at=now()");
    if (table === "tasks" && "done" in data) extra.push(Number(data.done) ? "done_at=now()" : "done_at=NULL");
    const sets = [...cols.map((c, i) => `${c}=$${i + 1}`), ...extra].join(",");
    const sql = `UPDATE ${table} SET ${sets} WHERE id=$${cols.length + 1}`;
    await db.query(sql, [...cols.map((c) => data[c]), id]);
  }
  const r = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

// Bir nechta so'rovni bitta tranzaksiyada bajarish
async function tx(fn: (q: (sql: string, params?: unknown[]) => Promise<unknown>) => Promise<void>) {
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

export async function remove(table: TableName, id: number) {
  await tx(async (q) => {
    await q(`DELETE FROM ${table} WHERE id = $1`, [id]);
    if (table === "goals") await q("DELETE FROM payments WHERE kind='goal' AND ref_id=$1", [id]);
    if (table === "debts") await q("DELETE FROM payments WHERE kind='debt' AND ref_id=$1", [id]);
  });
}

// Maqsadga pul qo'shish yoki qarzni to'lash (qisman bo'lishi mumkin)
export async function addPayment(kind: "goal" | "debt", refId: number, amount: number, date: string, note?: string) {
  const amt = Math.round(amount);
  await tx(async (q) => {
    await q("INSERT INTO payments (kind, ref_id, amount, date, note) VALUES ($1,$2,$3,$4,$5)", [
      kind,
      refId,
      amt,
      date,
      note || null,
    ]);
    if (kind === "goal") await q("UPDATE goals SET saved = GREATEST(0, saved + $1) WHERE id = $2", [amt, refId]);
    else await q("UPDATE debts SET paid = GREATEST(0, paid + $1) WHERE id = $2", [amt, refId]);
  });
}

export async function removePayment(id: number) {
  await tx(async (q) => {
    const r = (await q("SELECT * FROM payments WHERE id = $1 FOR UPDATE", [id])) as {
      rows: { kind: "goal" | "debt"; ref_id: number; amount: number }[];
    };
    const p = r.rows[0];
    if (!p) return;
    if (p.kind === "goal") await q("UPDATE goals SET saved = GREATEST(0, saved - $1) WHERE id = $2", [p.amount, p.ref_id]);
    else await q("UPDATE debts SET paid = GREATEST(0, paid - $1) WHERE id = $2", [p.amount, p.ref_id]);
    await q("DELETE FROM payments WHERE id = $1", [id]);
  });
}

// Odat / kunlik vazifani shu kun uchun belgilash yoki belgini olib tashlash
export async function toggleHabit(habitId: number, date: string, on?: boolean) {
  const db = await getDb();
  const exists = (await db.query("SELECT 1 FROM habit_logs WHERE habit_id=$1 AND date=$2", [habitId, date])).rowCount;
  const want = on ?? !exists;
  if (want && !exists) await db.query("INSERT INTO habit_logs (habit_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING", [habitId, date]);
  if (!want && exists) await db.query("DELETE FROM habit_logs WHERE habit_id=$1 AND date=$2", [habitId, date]);
  return want;
}
