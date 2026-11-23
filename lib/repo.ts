import { getDb } from "./db";
import type { AllData } from "./types";

// Har bir jadval uchun ruxsat etilgan ustunlar (SQL injection'dan himoya)
export const TABLES = {
  goals: ["name", "target", "saved", "deadline", "note"],
  debts: ["direction", "person", "amount", "paid", "taken_date", "due_date", "note"],
  purchases: ["name", "price", "planned_date", "priority", "bought", "note"],
} as const;

export type TableName = keyof typeof TABLES;

export function isTable(t: string): t is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, t);
}

function pick(table: TableName, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const col of TABLES[table]) {
    if (col in body) {
      let v = body[col];
      if (v === "") v = null;
      if (typeof v === "boolean") v = v ? 1 : 0;
      out[col] = v;
    }
  }
  return out;
}

export function getAll(): AllData {
  const db = getDb();
  return {
    goals: db.prepare("SELECT * FROM goals ORDER BY deadline IS NULL, deadline, id DESC").all() as AllData["goals"],
    debts: db.prepare("SELECT * FROM debts ORDER BY due_date IS NULL, due_date, id DESC").all() as AllData["debts"],
    purchases: db
      .prepare("SELECT * FROM purchases ORDER BY bought, planned_date IS NULL, planned_date, id DESC")
      .all() as AllData["purchases"],
    payments: db.prepare("SELECT * FROM payments ORDER BY date DESC, id DESC").all() as AllData["payments"],
  };
}

export function insert(table: TableName, body: Record<string, unknown>) {
  const data = pick(table, body);
  const cols = Object.keys(data);
  if (!cols.length) throw new Error("Ma'lumot bo'sh");
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((c) => "@" + c).join(",")})`;
  const info = getDb().prepare(sql).run(data);
  return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
}

export function update(table: TableName, id: number, body: Record<string, unknown>) {
  const data = pick(table, body);
  const cols = Object.keys(data);
  if (cols.length) {
    const sql = `UPDATE ${table} SET ${cols.map((c) => `${c}=@${c}`).join(",")} WHERE id=@__id`;
    getDb().prepare(sql).run({ ...data, __id: id });
  }
  return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

export function remove(table: TableName, id: number) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    if (table === "goals") db.prepare("DELETE FROM payments WHERE kind='goal' AND ref_id=?").run(id);
    if (table === "debts") db.prepare("DELETE FROM payments WHERE kind='debt' AND ref_id=?").run(id);
  });
  tx();
}

// Maqsadga pul qo'shish yoki qarzni to'lash (qisman bo'lishi mumkin)
export function addPayment(kind: "goal" | "debt", refId: number, amount: number, date: string, note?: string) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO payments (kind, ref_id, amount, date, note) VALUES (?,?,?,?,?)").run(
      kind,
      refId,
      amount,
      date,
      note || null
    );
    if (kind === "goal") db.prepare("UPDATE goals SET saved = MAX(0, saved + ?) WHERE id = ?").run(amount, refId);
    else db.prepare("UPDATE debts SET paid = MAX(0, paid + ?) WHERE id = ?").run(amount, refId);
  });
  tx();
}

export function removePayment(id: number) {
  const db = getDb();
  const p = db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as
    | { kind: "goal" | "debt"; ref_id: number; amount: number }
    | undefined;
  if (!p) return;
  const tx = db.transaction(() => {
    if (p.kind === "goal") db.prepare("UPDATE goals SET saved = MAX(0, saved - ?) WHERE id = ?").run(p.amount, p.ref_id);
    else db.prepare("UPDATE debts SET paid = MAX(0, paid - ?) WHERE id = ?").run(p.amount, p.ref_id);
    db.prepare("DELETE FROM payments WHERE id = ?").run(id);
  });
  tx();
}
