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
  const webhook = await tg("setWebhook", {
    url: `${url}/api/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  const menu = await tg("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Ochish", web_app: { url } },
  });
  const commands = await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Ilovani ochish va yordam" },
      { command: "stop", description: "Ertalabki xabarni o'chirish" },
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
