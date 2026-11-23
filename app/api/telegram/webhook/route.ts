import { NextResponse } from "next/server";
import { getUser, insert, setDigest, setPrayed, updateSettings, upsertUser } from "@/lib/repo";
import { getDayTimes, PRAYER_NAMES } from "@/lib/prayer";
import { cryptoSection, invalidatePlan } from "@/lib/scheduler";
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

Buyruqlar:
/namoz — bugungi namoz vaqtlari
/kripto — portfel, kechagidan foyda/zarar
/stop, /digest — ertalabki xabarni o'chirish/yoqish
/namoz_off, /namoz_on — namoz eslatmalari

Sozlamalarning hammasi ilovada: avatar → Sozlamalar.`;

type Update = {
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number }; text?: string };
  };
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

  // Inline tugmalar: "✅ O'qidim" (pr:YYYY-MM-DD:namoz)
  const cb = upd.callback_query;
  if (cb) {
    const m = (cb.data || "").match(/^pr:(\d{4}-\d{2}-\d{2}):(bomdod|peshin|asr|shom|xufton)$/);
    if (m && isAllowed(cb.from.id)) {
      await setPrayed(cb.from.id, m[1], m[2], true).catch((e) => console.error("[cb]", e));
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Qabul bo'lsin! ✅" });
      if (cb.message) {
        await tg("editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [[{ text: "✅ O'qildi", callback_data: "noop" }]] } });
      }
    } else {
      await tg("answerCallbackQuery", { callback_query_id: cb.id });
    }
    return NextResponse.json({ ok: true });
  }

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
    } else if (text.startsWith("/namoz_off")) {
      await updateSettings(uid, { prayer_remind: false });
      invalidatePlan();
      await tg("sendMessage", { chat_id: chat, text: "Namoz eslatmalari o'chirildi. Yoqish: /namoz_on" });
    } else if (text.startsWith("/namoz_on")) {
      await updateSettings(uid, { prayer_remind: true });
      invalidatePlan();
      const u = await getUser(uid);
      await tg("sendMessage", { chat_id: chat, text: `Namoz eslatmalari yoqildi 🕌 (${u?.region}). Hududni ilovadagi Sozlamalarda o'zgartiring.` });
    } else if (text.startsWith("/namoz")) {
      const u = await getUser(uid);
      const region = u?.region || "Toshkent";
      const t = await getDayTimes(region, todayIn());
      const lines = (["bomdod", "quyosh", "peshin", "asr", "shom", "xufton"] as const).map((k) => `${PRAYER_NAMES[k]}: <b>${t[k]}</b>`);
      await tg("sendMessage", {
        chat_id: chat,
        parse_mode: "HTML",
        text: `🕌 <b>${esc(region)}</b> — ${todayIn().split("-").reverse().join(".")}\n\n${lines.join("\n")}${t.source === "hisob" ? "\n\n<i>Hisoblangan vaqt (islom.uz bilan ±2 daqiqa)</i>" : ""}\n\nEslatmalar: ${u?.prayer_remind ? "yoqilgan (/namoz_off)" : "o'chirilgan (/namoz_on)"}`,
      });
    } else if (text.startsWith("/kripto")) {
      const c = await cryptoSection(uid);
      await tg("sendMessage", {
        chat_id: chat,
        parse_mode: "HTML",
        text: c ?? "Portfel bo'sh. Ilovada Moliya → Kripto bo'limida GRAM, BTC, XAUt va boshqalarni qo'shing.",
        reply_markup: openAppButton(url + "/#moliya-crypto", "💰 Portfelni ochish"),
      });
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
