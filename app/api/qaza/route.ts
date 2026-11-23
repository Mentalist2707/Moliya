import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { changeQaza } from "@/lib/repo";

export const dynamic = "force-dynamic";

// POST { prayer, delta }  delta>0 — qazo qo'shish, delta<0 — qazo o'qildi
export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  const delta = Number(b.delta);
  if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: "delta kerak" }, { status: 400 });
  return NextResponse.json(await changeQaza(uid, String(b.prayer), delta));
});
