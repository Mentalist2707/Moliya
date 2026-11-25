import { after, NextResponse } from "next/server";
import { addPagesToCurrent, addQuranPages, getUser, readingStreak, insert, setDigest, setFast, setPrayed, updateSettings, upsertUser } from "@/lib/repo";
import { getDayTimes, PRAYER_NAMES } from "@/lib/prayer";
import { cryptoSection, invalidatePlan } from "@/lib/scheduler";
import { isAllowed } from "@/lib/auth";
import { checkBudget } from "@/lib/budget";
import { parseQuickTx } from "@/lib/categories";
import { appUrl, esc, openAppButton, som, tg, todayIn } from "@/lib/telegram";
import { addWords, refundAi, ruEnabled, ruStatus, savePack, useAi } from "@/lib/ruRepo";
import { packFromImages } from "@/lib/ruAi";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // rasm tahlili javobdan keyin (after) davom etadi

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
/quron 5 — bugun 5 sahifa Qur'on o'qidim
/oqidim 15 — kitobdan 15 sahifa o'qidim
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
    caption?: string;
    photo?: { file_id: string; width: number; height: number; file_size?: number }[];
    document?: { file_id: string; mime_type?: string; file_size?: number; file_name?: string };
  };
};

/** Telegram'dagi faylni yuklab olib base64 qilish */
async function tgFileBase64(fileId: string): Promise<string> {
  const f = (await tg("getFile", { file_id: fileId })) as { ok: boolean; result?: { file_path?: string } };
  if (!f.ok || !f.result?.file_path) throw new Error("Rasmni yuklab bo'lmadi");
  const r = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${f.result.file_path}`);
  if (!r.ok) throw new Error("Rasmni yuklab bo'lmadi");
  return Buffer.from(await r.arrayBuffer()).toString("base64");
}

/** Dars rasmi: AI tahlil → dars + so'zlar + mashqlar saqlanadi */
async function lessonFromPhoto(uid: number, chat: number, fileId: string, type: "image/jpeg" | "image/png" | "image/webp", hint: string | undefined, url: string) {
  const today = todayIn();
  try {
    await useAi(uid, today);
  } catch (e) {
    await tg("sendMessage", { chat_id: chat, text: "⚠️ " + (e as Error).message });
    return;
  }
  try {
    const data = await tgFileBase64(fileId);
    const pack = await packFromImages([{ data, type }], hint);
    const res = await savePack(uid, pack, { date: today, source: "rasm" });
    const words = pack.words.slice(0, 12).map((w) => `${esc(w.ru)} — ${esc(w.uz)}`).join("\n");
    const text =
      `📚 <b>${esc(pack.topic)}</b>\n` +
      (pack.summary ? `<i>${esc(pack.summary)}</i>\n` : "") +
      (pack.grammar.length ? `\n<b>Qoida:</b> ${pack.grammar.map((g) => esc(g.title)).filter(Boolean).join("; ")}\n` : "") +
      (pack.words.length ? `\n<b>So'zlar</b> (${res.added} ta yangi qo'shildi):\n${words}${pack.words.length > 12 ? `\n… yana ${pack.words.length - 12} ta` : ""}\n` : "") +
      (pack.homework ? `\n📌 <b>Uy vazifasi:</b> ${esc(pack.homework)}\n` : "") +
      `\n✨ ${pack.exercises.length} ta mashq tayyor.`;
    await tg("sendMessage", { chat_id: chat, text: text.slice(0, 4000), parse_mode: "HTML", reply_markup: openAppButton(url + "/#rus", "✍️ Mashqni boshlash") });
  } catch (e) {
    await refundAi(uid, today);
    console.error("[webhook] rasm:", e);
    await tg("sendMessage", { chat_id: chat, text: "⚠️ Rasmni tahlil qilib bo'lmadi: " + (e as Error).message });
  }
}

export async function POST(req: Request) {
  // Telegram so'rovi ekanini tekshirish (setWebhook'dagi secret_token)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const upd = (await req.json().catch(() => ({}))) as Update;

  // Inline tugmalar: "✅ O'qidim" (pr:YYYY-MM-DD:namoz)
  const cb = upd.callback_query;
  let m2: RegExpMatchArray | null = null;
  if (cb) {
    const m = (cb.data || "").match(/^pr:(\d{4}-\d{2}-\d{2}):(bomdod|peshin|asr|shom|xufton)$/);
    if (m && isAllowed(cb.from.id)) {
      await setPrayed(cb.from.id, m[1], m[2], true).catch((e) => console.error("[cb]", e));
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Qabul bo'lsin! ✅" });
      if (cb.message) {
        await tg("editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [[{ text: "✅ O'qildi", callback_data: "noop" }]] } });
      }
    } else if ((m2 = (cb.data || "").match(/^fs:(\d{4}-\d{2}-\d{2}):(tutdim|qoldi)$/)) && isAllowed(cb.from.id)) {
      await setFast(cb.from.id, m2[1], m2[2] as "tutdim" | "qoldi").catch((e) => console.error("[cb]", e));
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: m2[2] === "tutdim" ? "Qabul bo'lsin! 🤲" : "Belgilandi" });
      if (cb.message) {
        await tg("editMessageReplyMarkup", {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [[{ text: m2[2] === "tutdim" ? "✅ Ro'za tutildi" : "Qayd etildi", callback_data: "noop" }]] },
        });
      }
    } else {
      await tg("answerCallbackQuery", { callback_query_id: cb.id });
    }
    return NextResponse.json({ ok: true });
  }

  const msg = upd.message;
  const from = msg?.from;

  // Rus tili: dars rasmi (faqat bo'lim yoqilgan akkaunt uchun)
  const img = msg?.photo?.length
    ? { id: msg.photo[msg.photo.length - 1].file_id, type: "image/jpeg" as const, size: msg.photo[msg.photo.length - 1].file_size ?? 0 }
    : msg?.document && /^image\/(jpeg|png|webp)$/.test(msg.document.mime_type || "")
      ? { id: msg.document.file_id, type: msg.document.mime_type as "image/jpeg" | "image/png" | "image/webp", size: msg.document.file_size ?? 0 }
      : null;
  if (img && msg && from && !from.is_bot && msg.chat.type === "private") {
    const chat = msg.chat.id;
    if (!isAllowed(from.id) || !(await ruEnabled(from.id).catch(() => false))) {
      await tg("sendMessage", { chat_id: chat, text: "Rasm qabul qilinmaydi. Matn yozing yoki ilovani oching.", reply_markup: openAppButton(appUrl(req)) });
      return NextResponse.json({ ok: true });
    }
    if (img.size > 4_500_000) {
      await tg("sendMessage", { chat_id: chat, text: "Rasm juda katta (4.5 MB dan oshmasin). Oddiy rasm qilib yuboring." });
      return NextResponse.json({ ok: true });
    }
    const url = appUrl(req);
    await tg("sendMessage", { chat_id: chat, text: "⏳ Rasm tahlil qilinmoqda… odatda 30–90 soniya." });
    after(() => lessonFromPhoto(from.id, chat, img.id, img.type, msg.caption?.slice(0, 300), url));
    return NextResponse.json({ ok: true });
  }

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
    } else if (text.startsWith("/oqidim")) {
      const n = parseInt(text.replace(/^\/\S+\s*/, ""), 10);
      if (!n || n < 0) {
        await tg("sendMessage", { chat_id: chat, text: "Nechta sahifa o'qiganingizni yozing, masalan: /oqidim 15" });
      } else {
        const r = await addPagesToCurrent(uid, n, todayIn());
        const { streak } = await readingStreak(uid, todayIn());
        const book = r.title ? `«${esc(r.title)}»${r.total ? ` — ${r.page}/${r.total}` : ` — ${r.page}-bet`}` : "Kitob tanlanmagan (ilovada «O'qiyapman»ga qo'shing)";
        await tg("sendMessage", {
          chat_id: chat,
          parse_mode: "HTML",
          text: r.finished
            ? `🎉 <b>Kitobni tugatdingiz!</b> ${book}\nIlovada 3 ta savolga javob bering — o'qiganingiz yodda qoladi.\n🔥 Streak: ${streak} kun`
            : `📖 +${n} sahifa. ${book}\n🔥 Streak: <b>${streak} kun</b>`,
          reply_markup: r.finished ? openAppButton(url + "/#kitoblar", "📝 Xulosa yozish") : undefined,
        });
      }
    } else if (text.startsWith("/quron")) {
      const n = parseInt(text.replace(/^\/\S+\s*/, ""), 10);
      if (!n) {
        await tg("sendMessage", { chat_id: chat, text: "O'qigan sahifalaringiz sonini yozing, masalan: /quron 5" });
      } else {
        const r = await addQuranPages(uid, todayIn(), n);
        await tg("sendMessage", {
          chat_id: chat,
          parse_mode: "HTML",
          text: r.finished
            ? `🎉 <b>Xatm qildingiz!</b> Alloh qabul qilsin. Jami xatmlar: ${r.khatm}`
            : `📖 +${n} sahifa. Hozir: <b>${r.page}/604</b> (${Math.round((r.page / 604) * 100)}%)`,
        });
      }
    } else if (text.startsWith("/soz") && (await ruEnabled(uid))) {
      const body = text.replace(/^\/soz(@\w+)?\s*/, "");
      const words = body
        .split("\n")
        .map((l) => l.split(/\s+[-–—=:]\s+|\t/))
        .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
        .map((p) => ({ ru: p[0].trim(), uz: p.slice(1).join(" - ").trim() }));
      if (!words.length) {
        await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: "So'z qo'shish:\n<code>/soz книга - kitob</code>\n\nBir nechta bo'lsa, har birini yangi qatorda yozing." });
      } else {
        const added = await addWords(uid, words, null, todayIn());
        await tg("sendMessage", {
          chat_id: chat,
          parse_mode: "HTML",
          text: `🔤 ${added} ta so'z qo'shildi${words.length - added ? ` (${words.length - added} tasi oldin bor edi)` : ""}:\n${words.map((w) => `${esc(w.ru)} — ${esc(w.uz)}`).join("\n").slice(0, 3500)}`,
        });
      }
    } else if (text.startsWith("/rus") && (await ruEnabled(uid))) {
      const st = await ruStatus(uid, todayIn());
      await tg("sendMessage", {
        chat_id: chat,
        parse_mode: "HTML",
        text:
          `🇷🇺 <b>Rus tili</b>\n${st.due ? `🔁 ${st.due} ta so'z takrorlash kerak` : "✓ Bugun takrorlash yo'q"}` +
          (st.homework.length ? `\n\n📌 <b>Uy vazifasi:</b>\n${st.homework.map((h) => `• ${esc(h.homework)} <i>(${esc(h.topic)})</i>`).join("\n")}` : "") +
          `\n\nDars rasmini shu yerga yuboring — so'zlar va mashqlar avtomatik tuziladi.`,
        reply_markup: openAppButton(url + "/#rus", st.due ? "🔁 Takrorlash" : "📱 Rus tili"),
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
        if (tx.type === "chiqim") await checkBudget(uid, tx.category, todayIn());
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
