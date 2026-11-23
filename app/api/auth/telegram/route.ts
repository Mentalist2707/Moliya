import { startSession } from "@/lib/login";
import { verifyLoginWidget } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Brauzerdan: Telegram Login Widget qaytargan ma'lumot (id, first_name, …, auth_date, hash)
export async function POST(req: Request) {
  const data = await req.json().catch(() => ({}));
  return startSession(verifyLoginWidget(data && typeof data === "object" ? data : {}));
}
