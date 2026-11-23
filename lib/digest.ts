import { getDb } from "./db";
import { esc, som, todayIn } from "./telegram";

/** Bitta foydalanuvchi uchun ertalabki xabar matni. Aytadigan gap bo'lmasa — null */
export async function buildDigest(uid: number, firstName?: string | null): Promise<string | null> {
  const today = todayIn();
  const yesterday = todayIn(undefined, -1);
  const in3 = todayIn(undefined, 3);
  const db = await getDb();
  const q = <T,>(sql: string, p: unknown[]) => db.query(sql, p).then((r) => r.rows as T[]);

  const [tasks, daily, debts, spent, reading] = await Promise.all([
    q<{ title: string; due_date: string | null }>(
      "SELECT title, due_date FROM tasks WHERE user_id=$1 AND done=0 AND (due_date <= $2 OR (due_date IS NULL AND priority='yuqori')) ORDER BY due_date NULLS LAST LIMIT 10",
      [uid, today]
    ),
    q<{ name: string; emoji: string | null }>("SELECT name, emoji FROM habits WHERE user_id=$1 AND archived=0 ORDER BY kind, id", [uid]),
    q<{ person: string; direction: string; left: number; due_date: string }>(
      "SELECT person, direction, amount-paid AS left, due_date FROM debts WHERE user_id=$1 AND paid < amount AND due_date <= $2 ORDER BY due_date",
      [uid, in3]
    ),
    q<{ s: number }>("SELECT COALESCE(SUM(amount),0)::bigint AS s FROM transactions WHERE user_id=$1 AND type='chiqim' AND date=$2", [uid, yesterday]),
    q<{ title: string; current_page: number; total_pages: number | null }>(
      "SELECT title, current_page, total_pages FROM books WHERE user_id=$1 AND status='oqiyapman' LIMIT 2",
      [uid]
    ),
  ]);

  const L: string[] = [];
  if (tasks.length) {
    L.push("", "<b>📌 Vazifalar</b>");
    for (const t of tasks) L.push(`• ${esc(t.title)}${t.due_date && t.due_date < today ? " ⚠️ <i>muddati o'tgan</i>" : ""}`);
  }
  if (daily.length) L.push("", "<b>🔁 Kunlik</b>", daily.map((h) => `${h.emoji || "▫️"} ${esc(h.name)}`).join("\n"));
  if (debts.length) {
    L.push("", "<b>💸 Qarz muddatlari</b>");
    for (const d of debts) {
      const late = d.due_date < today ? " ⚠️ <i>o'tgan</i>" : "";
      L.push(`• ${d.direction === "owe" ? "Men → " : "← "}${esc(d.person)}: ${som(d.left)} so'm (${d.due_date})${late}`);
    }
  }
  if (Number(spent[0]?.s)) L.push("", `🧾 Kecha sarflandi: <b>${som(Number(spent[0].s))} so'm</b>`);
  if (reading.length) {
    L.push("", "<b>📚 O'qilmoqda</b>");
    for (const b of reading) L.push(`• ${esc(b.title)}${b.total_pages ? ` — ${b.current_page}/${b.total_pages} bet` : ""}`);
  }
  if (!L.length) return null;
  const hi = `☀️ <b>Xayrli tong${firstName ? ", " + esc(firstName) : ""}!</b> Bugun ${today.split("-").reverse().join(".")}`;
  return [hi, ...L].join("\n");
}
