import { getDb } from "./db";
import { som, tg } from "./telegram";

/**
 * Xarajat qo'shilgandan keyin: shu oy kategoriya bo'yicha limitning 80% va 100% iga yetganda
 * Telegram'ga bir martalik ogohlantirish yuboradi.
 */
export async function checkBudget(uid: number, category: string, date: string) {
  try {
    const db = await getDb();
    const lim = (await db.query("SELECT amount FROM budgets WHERE user_id=$1 AND category=$2", [uid, category])).rows[0];
    if (!lim) return;
    const limit = Number(lim.amount);
    const ym = date.slice(0, 7);
    const spent = Number(
      (
        await db.query(
          "SELECT COALESCE(SUM(amount),0)::bigint AS s FROM transactions WHERE user_id=$1 AND type='chiqim' AND category=$2 AND to_char(date,'YYYY-MM')=$3",
          [uid, category, ym]
        )
      ).rows[0].s
    );
    const pct = (spent / limit) * 100;
    const level = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
    if (!level) return;
    const claimed = await db.query("INSERT INTO sent_log (user_id, key) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1", [uid, `b:${ym}:${category}:${level}`]);
    if (!claimed.rowCount) return;
    const text =
      level === 100
        ? `🚨 <b>${category}</b> uchun oylik limit oshib ketdi!\nSarflandi: <b>${som(spent)}</b> / ${som(limit)} so'm (${Math.round(pct)}%)`
        : `⚠️ <b>${category}</b> limitining ${Math.round(pct)}% ishlatildi.\nSarflandi: ${som(spent)} / ${som(limit)} so'm. Qoldi: <b>${som(limit - spent)}</b>`;
    await tg("sendMessage", { chat_id: uid, text, parse_mode: "HTML" });
  } catch (e) {
    console.error("[budget]", e);
  }
}
