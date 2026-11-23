import crypto from "crypto";

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || "";
export const TZ = () => process.env.APP_TZ || "Asia/Tashkent";

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string };

/**
 * Telegram Mini App initData'sini tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, maxAgeSec = 60 * 60 * 24): TgUser | null {
  const token = TOKEN();
  if (!token || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

/**
 * Brauzer uchun Telegram Login Widget ma'lumotini tekshiradi.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyLoginWidget(data: Record<string, unknown>, maxAgeSec = 60 * 60 * 24): TgUser | null {
  const token = TOKEN();
  const hash = String(data.hash || "");
  if (!token || !hash) return null;
  const dataCheck = Object.keys(data)
    .filter((k) => k !== "hash" && data[k] !== undefined && data[k] !== null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = Number(data.auth_date || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  return {
    id: Number(data.id),
    first_name: data.first_name as string | undefined,
    last_name: data.last_name as string | undefined,
    username: data.username as string | undefined,
    photo_url: data.photo_url as string | undefined,
  };
}

export async function tg(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; description?: string; result?: unknown }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: (e as Error).message };
  }
}

export function openAppButton(url: string, text = "📱 Ilovani ochish") {
  return { inline_keyboard: [[{ text, web_app: { url } }]] };
}

export function appUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

// Berilgan vaqt mintaqasidagi bugungi sana: "2026-11-23"
export function todayIn(tz = TZ(), offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function som(n: number): string {
  const v = Math.round(n || 0);
  return (v < 0 ? "−" : "") + Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
