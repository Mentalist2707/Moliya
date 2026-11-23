import { NextResponse } from "next/server";
import { appUrl, tg } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Deploydan keyin bir marta oching (ilovaga kirgan holda): https://SIZNING-DOMEN/api/telegram/setup
// Webhook'ni, menyu tugmasini va buyruqlarni o'rnatadi.
export async function GET(req: Request) {
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
    commands: [{ command: "start", description: "Ilovani ochish va yordam" }],
  });
  return NextResponse.json({ app_url: url, webhook, menu, commands });
}
