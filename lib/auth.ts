// Kirish himoyasi: brauzerda parol, Telegram Mini App'da Telegram orqali avtomatik.
// APP_PASSWORD ham, TELEGRAM_BOT_TOKEN ham bo'lmasa — himoya o'chiq (faqat lokal ishlatish uchun).
export const AUTH_COOKIE = "moliya_auth";

export function authEnabled(): boolean {
  return !!(process.env.APP_PASSWORD || process.env.TELEGRAM_BOT_TOKEN);
}

// Cookie'da sirlarning SHA-256 xeshi saqlanadi (parolning o'zi emas).
// AUTH_SECRET yoki parol o'zgartirilsa — hamma qurilmalar qaytadan kirishi kerak.
export async function expectedToken(): Promise<string> {
  const data = new TextEncoder().encode(
    `moliya:${process.env.AUTH_SECRET || ""}:${process.env.APP_PASSWORD || ""}:${process.env.TELEGRAM_BOT_TOKEN || ""}`
  );
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const COOKIE_OPTS = {
  httpOnly: true,
  // Telegram Web (brauzerdagi Telegram) Mini App'ni iframe ichida ochadi — shuning uchun "none"
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 kun
};
