import { NextResponse } from "next/server";
import { insert } from "@/lib/repo";
import { parseQuickTx } from "@/lib/categories";
import { appUrl, esc, openAppButton, OWNER_ID, som, tg, todayIn } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const HELP = `<b>Moliya</b> — shaxsiy yordamchingiz.

Asosiy ish ilovada: pastdagi <b>Ochish</b> tugmasi yoki menyu tugmasi.

Tez qo'shish uchun shunchaki yozing:
<code>-25000 tushlik</code> — xarajat
<code>-30k taksi</code> — xarajat (k = ming)
<code>+3mln maosh</code> — kirim
<code>Kitobni qaytarish</code> — yangi vazifa`;

type Update = {
  message?: { chat: { id: number }; from?: { id: number }; text?: string };
};

export async function POST(req: Request) {
  // Telegram so'rovi ekanini tekshirish (setWebhook'dagi secret_token)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const upd = (await req.json().catch(() => ({}))) as Update;
  const msg = upd.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chat = msg.chat.id;
  const url = appUrl(req);

  if (msg.from?.id !== OWNER_ID()) {
    await tg("sendMessage", {
      chat_id: chat,
      text: `Bu shaxsiy bot.\nSizning Telegram ID'ingiz: <code>${msg.from?.id}</code>`,
      parse_mode: "HTML",
    });
    return NextResponse.json({ ok: true });
  }

  const text = msg.text.trim();
  try {
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await tg("sendMessage", { chat_id: chat, text: HELP, parse_mode: "HTML", reply_markup: openAppButton(url) });
    } else if (text.startsWith("/")) {
      await tg("sendMessage", { chat_id: chat, text: "Noma'lum buyruq. /start", reply_markup: openAppButton(url) });
    } else {
      const tx = parseQuickTx(text);
      if (tx) {
        await insert("transactions", { ...tx, date: todayIn() });
        await tg("sendMessage", {
          chat_id: chat,
          text: `${tx.type === "kirim" ? "🟢 Kirim" : "🔴 Xarajat"}: <b>${som(tx.amount)} so'm</b>\nKategoriya: ${esc(tx.category)}${tx.note ? `\nIzoh: ${esc(tx.note)}` : ""}`,
          parse_mode: "HTML",
        });
      } else {
        await insert("tasks", { title: text.slice(0, 300), priority: "orta" });
        await tg("sendMessage", { chat_id: chat, text: `✅ Vazifa qo'shildi: <b>${esc(text.slice(0, 300))}</b>`, parse_mode: "HTML" });
      }
    }
  } catch (e) {
    await tg("sendMessage", { chat_id: chat, text: "Xatolik: " + (e as Error).message });
  }
  return NextResponse.json({ ok: true });
}
