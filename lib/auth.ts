// Parol bilan himoya. APP_PASSWORD bo'sh bo'lsa — himoya o'chiq (lokal ishlatish uchun).
export const AUTH_COOKIE = "moliya_auth";

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

// Cookie'da parolning o'zi emas, uning SHA-256 xeshi saqlanadi.
// AUTH_SECRET o'zgartirilsa — barcha qurilmalar qaytadan kirishi kerak bo'ladi.
export async function expectedToken(): Promise<string> {
  const data = new TextEncoder().encode(
    `moliya:${process.env.AUTH_SECRET || ""}:${process.env.APP_PASSWORD || ""}`
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
