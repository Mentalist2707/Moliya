import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildDigest } from "@/lib/digest";
import { setDigest } from "@/lib/repo";
import { appUrl, openAppButton, tg } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron har kuni chaqiradi (vercel.json). Authorization: Bearer CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const db = await getDb();
  const users = (await db.query("SELECT id, first_name FROM users WHERE daily_digest=1 ORDER BY id")).rows as { id: number; first_name: string | null }[];
  const url = appUrl(req);
  let sent = 0,
    skipped = 0,
    failed = 0;

  // Telegram cheklovi ~30 xabar/soniya: 20 tadan guruh, guruhlar orasida 1 soniya
  for (let i = 0; i < users.length; i += 20) {
    await Promise.all(
      users.slice(i, i + 20).map(async (u) => {
        const text = await buildDigest(Number(u.id), u.first_name).catch(() => null);
        if (!text) return skipped++;
        const r = await tg("sendMessage", { chat_id: u.id, text, parse_mode: "HTML", reply_markup: openAppButton(url) });
        if (r.ok) return sent++;
        failed++;
        // Botni bloklagan yoki hisobi o'chirilgan — boshqa yubormaymiz
        if (/blocked|deactivated|chat not found/i.test(r.description || "")) await setDigest(Number(u.id), false);
      })
    );
    if (i + 20 < users.length) await new Promise((r) => setTimeout(r, 1000));
  }
  return NextResponse.json({ ok: true, users: users.length, sent, skipped, failed });
}
