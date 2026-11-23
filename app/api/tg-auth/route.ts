import { startSession } from "@/lib/login";
import { verifyInitData } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Telegram Mini App ichidan avtomatik kirish: POST { initData }
export async function POST(req: Request) {
  const { initData } = await req.json().catch(() => ({ initData: "" }));
  const user = verifyInitData(String(initData || ""));
  console.log("[tg-auth]", user ? `ok ${user.id}` : `rad etildi (initData uzunligi ${String(initData || "").length})`);
  return startSession(user);
}
