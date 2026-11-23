// Sessiya: cookie'da "userId.muddat.imzo" (HMAC-SHA256, AUTH_SECRET bilan).
// Web Crypto ishlatiladi — middleware (edge) va API (node) ikkalasida ishlaydi.
export const AUTH_COOKIE = "moliya_sess";
const DAYS = 60;

/**
 * TELEGRAM_BOT_TOKEN yo'q bo'lsa — lokal rejim: login yo'q, bitta foydalanuvchi (id=1).
 * Vercel'da (VERCEL=1) lokal rejim HECH QACHON yoqilmaydi: token bo'lmasa hech kim kira olmaydi.
 */
export function authEnabled(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN || !!process.env.VERCEL;
}
export const LOCAL_UID = 1;

function secret(): string {
  return process.env.AUTH_SECRET || `fallback:${process.env.TELEGRAM_BOT_TOKEN || ""}`;
}

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signSession(uid: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  const body = `${uid}.${exp}`;
  return `${body}.${await hmac(body)}`;
}

export async function verifySession(value: string | undefined): Promise<number | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  if (!/^\d+$/.test(uid) || !/^\d+$/.test(exp)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  if (!safeEqual(sig, await hmac(`${uid}.${exp}`))) return null;
  return Number(uid);
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}

/** API ichida: joriy foydalanuvchi ID'si yoki null */
export async function currentUid(req: Request): Promise<number | null> {
  if (!authEnabled()) return LOCAL_UID;
  return verifySession(readCookie(req, AUTH_COOKIE));
}

/** Kimlar kira oladi: ALLOWED_USER_IDS bo'sh bo'lsa — hamma */
export function isAllowed(id: number): boolean {
  const list = (process.env.ALLOWED_USER_IDS || "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  return list.length === 0 || list.includes(id);
}

export const COOKIE_OPTS = {
  httpOnly: true,
  // Telegram Web (brauzerdagi Telegram) Mini App'ni iframe ichida ochadi — shuning uchun "none"
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DAYS * 86400,
};
