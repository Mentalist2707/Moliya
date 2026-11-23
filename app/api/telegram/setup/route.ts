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
  // ?test=2 — haqiqiy HTTP orqali /api/data va /api/me ni birinchi foydalanuvchi sessiyasi bilan chaqirish
  if (new URL(req.url).searchParams.get("test") === "2") {
    const { getDb } = await import("@/lib/db");
    const { signSession, AUTH_COOKIE } = await import("@/lib/auth");
    const db = await getDb();
    const u = (await db.query("SELECT id FROM users ORDER BY created_at LIMIT 1")).rows[0];
    const cookie = `${AUTH_COOKIE}=${await signSession(Number(u.id))}`;
    const out: Record<string, unknown> = {};
    for (const path of ["/api/data", "/api/me", "/"]) {
      const r = await fetch(url + path, { headers: { cookie }, redirect: "manual" });
      out[path] = { status: r.status, location: r.headers.get("location"), body: (await r.text()).slice(0, 300) };
    }
    return NextResponse.json(out);
  }
  // ?test=1 — bazadan birinchi foydalanuvchi ma'lumotini o'qib ko'rish (diagnostika)
  if (new URL(req.url).searchParams.get("test")) {
    const t0 = Date.now();
    try {
      const { getDb } = await import("@/lib/db");
      const { getAll } = await import("@/lib/repo");
      const db = await getDb();
      const u = (await db.query("SELECT id FROM users ORDER BY created_at LIMIT 1")).rows[0];
      const d = await getAll(Number(u?.id || 0));
      return NextResponse.json({ ok: true, ms: Date.now() - t0, counts: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, (v as unknown[]).length])) });
    } catch (e) {
      const err = e as Error & { code?: string };
      return NextResponse.json({ ok: false, ms: Date.now() - t0, message: err.message, code: err.code, stack: err.stack?.split("\n").slice(0, 6) });
    }
  }
  // ?info=1 — faqat holatni ko'rish (hech narsani o'zgartirmaydi)
  if (new URL(req.url).searchParams.get("info")) {
    const [me, info, menu] = await Promise.all([tg("getMe", {}), tg("getWebhookInfo", {}), tg("getChatMenuButton", {})]);
    return NextResponse.json({ app_url: url, bot: me.result, webhook_info: info.result, menu: menu.result });
  }
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
