import { NextResponse } from "next/server";
import { insert, setDigest, upsertUser } from "@/lib/repo";
import { isAllowed } from "@/lib/auth";
import { parseQuickTx } from "@/lib/categories";
import { appUrl, esc, openAppButton, som, tg, todayIn } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const HELP = (name?: string) => `Salom${name ? ", " + esc(name) : ""}! 👋

<b>Moliya</b> — shaxsiy yordamchingiz: vazifalar, odatlar, pul, eslatmalar va kitoblar bir joyda.

Ilovani pastdagi <b>Ochish</b> tugmasi yoki menyu tugmasi orqali oching.

Tez qo'shish uchun shunchaki yozing:
<code>-25000 tushlik</code> — xarajat
<code>-30k taksi</code> — xarajat (k = ming)
<code>+3mln maosh</code> — kirim
<code>Kitobni qaytarish</code> — yangi vazifa

Har kuni ertalab qisqa reja yuboraman. O'chirish: /stop, yoqish: /digest`;

type Update = {
  message?: {
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string; last_name?: string; username?: string; is_bot?: boolean };
    text?: string;
  };
};

export async function POST(req: Request) {
  // Telegram so'rovi ekanini tekshirish (setWebhook'dagi secret_token)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const upd = (await req.json().catch(() => ({}))) as Update;
  const msg = upd.message;
  const from = msg?.from;
  // Faqat shaxsiy chatdagi matnli xabarlar
  if (!msg?.text || !from || from.is_bot || msg.chat.type !== "private") return NextResponse.json({ ok: true });

  const chat = msg.chat.id;
  const uid = from.id;
  const url = appUrl(req);

  if (!isAllowed(uid)) {
    await tg("sendMessage", { chat_id: chat, text: `Bu bot hozircha yopiq.\nTelegram ID: <code>${uid}</code>`, parse_mode: "HTML" });
    return NextResponse.json({ ok: true });
  }

  const text = msg.text.trim();
  console.log(`[webhook] ${uid}: ${text.slice(0, 40)}`);
  try {
    await upsertUser({ id: uid, first_name: from.first_name, last_name: from.last_name, username: from.username });

    if (text.startsWith("/start") || text.startsWith("/help")) {
      await tg("sendMessage", { chat_id: chat, text: HELP(from.first_name), parse_mode: "HTML", reply_markup: openAppButton(url) });
    } else if (text.startsWith("/stop")) {
      await setDigest(uid, false);
      await tg("sendMessage", { chat_id: chat, text: "Ertalabki xabarlar o'chirildi. Qayta yoqish: /digest" });
    } else if (text.startsWith("/digest")) {
      await setDigest(uid, true);
      await tg("sendMessage", { chat_id: chat, text: "Ertalabki xabarlar yoqildi ☀️" });
    } else if (text.startsWith("/")) {
      await tg("sendMessage", { chat_id: chat, text: "Noma'lum buyruq. /start", reply_markup: openAppButton(url) });
    } else {
      const tx = parseQuickTx(text);
      if (tx) {
        await insert(uid, "transactions", { ...tx, date: todayIn() });
        await tg("sendMessage", {
          chat_id: chat,
          text: `${tx.type === "kirim" ? "🟢 Kirim" : "🔴 Xarajat"}: <b>${som(tx.amount)} so'm</b>\nKategoriya: ${esc(tx.category)}${tx.note ? `\nIzoh: ${esc(tx.note)}` : ""}`,
          parse_mode: "HTML",
        });
      } else {
        await insert(uid, "tasks", { title: text.slice(0, 300), priority: "orta" });
        await tg("sendMessage", { chat_id: chat, text: `✅ Vazifa qo'shildi: <b>${esc(text.slice(0, 300))}</b>`, parse_mode: "HTML" });
      }
    }
  } catch (e) {
    console.error("[webhook] xato:", e);
    await tg("sendMessage", { chat_id: chat, text: "Xatolik: " + (e as Error).message });
  }
  return NextResponse.json({ ok: true });
}
