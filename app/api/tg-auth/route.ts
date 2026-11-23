import { startSession } from "@/lib/login";
import { verifyInitData } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Telegram Mini App ichidan avtomatik kirish: POST { initData }
export async function POST(req: Request) {
  const { initData } = await req.json().catch(() => ({ initData: "" }));
  return startSession(verifyInitData(String(initData || "")));
}
