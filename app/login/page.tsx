import LoginClient from "@/components/LoginClient";

export const dynamic = "force-dynamic";

// Bot username'ini env'dan yoki Telegram'dan (getMe) olamiz — Login Widget uchun kerak
async function botUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { next: { revalidate: 3600 } });
    const j = await r.json();
    return j?.result?.username ?? null;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  return <LoginClient bot={await botUsername()} />;
}
