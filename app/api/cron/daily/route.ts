import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { appUrl, esc, openAppButton, OWNER_ID, som, tg, todayIn } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Vercel Cron har kuni chaqiradi (vercel.json). Authorization: Bearer CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!OWNER_ID()) return NextResponse.json({ error: "TELEGRAM_OWNER_ID yo'q" }, { status: 400 });

  const today = todayIn();
  const yesterday = todayIn(undefined, -1);
  const in3 = todayIn(undefined, 3);
  const db = await getDb();
  const q = <T,>(sql: string, p: unknown[] = []) => db.query(sql, p).then((r) => r.rows as T[]);

  const [tasks, daily, debts, spent, reading] = await Promise.all([
    q<{ title: string; due_date: string | null }>(
      "SELECT title, due_date FROM tasks WHERE done=0 AND (due_date <= $1 OR (due_date IS NULL AND priority='yuqori')) ORDER BY due_date NULLS LAST LIMIT 10",
      [today]
    ),
    q<{ name: string; emoji: string | null }>("SELECT name, emoji FROM habits WHERE archived=0 ORDER BY kind, id"),
    q<{ person: string; direction: string; left: number; due_date: string }>(
      "SELECT person, direction, amount-paid AS left, due_date FROM debts WHERE paid < amount AND due_date <= $1 ORDER BY due_date",
      [in3]
    ),
    q<{ s: number }>("SELECT COALESCE(SUM(amount),0)::bigint AS s FROM transactions WHERE type='chiqim' AND date=$1", [yesterday]),
    q<{ title: string; current_page: number; total_pages: number | null }>(
      "SELECT title, current_page, total_pages FROM books WHERE status='oqiyapman' LIMIT 2"
    ),
  ]);

  const L: string[] = [`☀️ <b>Xayrli tong!</b> Bugun ${today.split("-").reverse().join(".")}`];
  if (tasks.length) {
    L.push("", "<b>📌 Vazifalar</b>");
    for (const t of tasks) L.push(`• ${esc(t.title)}${t.due_date && t.due_date < today ? " ⚠️ <i>muddati o'tgan</i>" : ""}`);
  }
  if (daily.length) {
    L.push("", "<b>🔁 Kunlik</b>", daily.map((h) => `${h.emoji || "▫️"} ${esc(h.name)}`).join("\n"));
  }
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

  const r = await tg("sendMessage", {
    chat_id: OWNER_ID(),
    text: L.join("\n"),
    parse_mode: "HTML",
    reply_markup: openAppButton(appUrl(req)),
  });
  return NextResponse.json({ ok: r.ok, description: r.description });
}
