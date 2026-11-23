import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { logReading } from "@/lib/repo";

export const dynamic = "force-dynamic";

// POST { book_id, page, minutes?, date? } → { delta, finished, page }
export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
  if (!Number(b.book_id)) return NextResponse.json({ error: "book_id kerak" }, { status: 400 });
  return NextResponse.json(await logReading(uid, Number(b.book_id), Number(b.page), Number(b.minutes) || 0, date));
});
