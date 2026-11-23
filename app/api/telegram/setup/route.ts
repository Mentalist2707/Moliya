import { NextResponse } from "next/server";
import { appUrl, tg } from "@/lib/telegram";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Deploydan keyin bir marta oching:
//   https://SIZNING-DOMEN/api/telegram/setup?key=TELEGRAM_WEBHOOK_SECRET
// Webhook'ni, menyu tugmasini va buyruqlarni o'rnatadi.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || "";
  const ws = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!ws || !safeEqual(key, ws)) {
    return NextResponse.json({ error: "?key= ga TELEGRAM_WEBHOOK_SECRET qiymatini yozing" }, { status: 403 });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN va TELEGRAM_WEBHOOK_SECRET o'rnatilmagan" }, { status: 400 });
  }
  const url = appUrl(req);
  // ?info=1 — faqat holatni ko'rish (hech narsani o'zgartirmaydi)
  if (new URL(req.url).searchParams.get("info")) {
    const ping = async (u: string) => {
      const t0 = Date.now();
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
        const body = (await r.text()).slice(0, 160);
        return { status: r.status, ms: Date.now() - t0, body };
      } catch (e) {
        return { error: (e as Error).message, ms: Date.now() - t0 };
      }
    };
    const [me, info, menu, islom, gecko, cbu] = await Promise.all([
      tg("getMe", {}),
      tg("getWebhookInfo", {}),
      tg("getChatMenuButton", {}),
      ping("https://islomapi.uz/api/present/day?region=Toshkent"),
      ping("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
      ping("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/"),
    ]);
    return NextResponse.json({ app_url: url, bot: me.result, webhook_info: info.result, menu: menu.result, services: { islomapi: islom, coingecko: gecko, cbu } });
  }
  const webhook = await tg("setWebhook", {
    url: `${url}/api/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const menu = await tg("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Ochish", web_app: { url } },
  });
  const commands = await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Ilovani ochish va yordam" },
      { command: "namoz", description: "Bugungi namoz vaqtlari" },
      { command: "kripto", description: "Portfel: kechagidan foyda/zarar" },
      { command: "stop", description: "Ertalabki xabarni o'chirish" },
      { command: "namoz_off", description: "Namoz eslatmalarini o'chirish" },
      { command: "digest", description: "Ertalabki xabarni yoqish" },
    ],
  });
  const me = await tg("getMe", {});
  return NextResponse.json({
    app_url: url,
    bot: me.result,
    webhook,
    menu,
    commands,
    next_step: "Brauzerdan kirish uchun @BotFather → /setdomain → botni tanlang → " + new URL(url).host,
  });
}
