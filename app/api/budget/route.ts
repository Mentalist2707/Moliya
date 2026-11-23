import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { setBudget } from "@/lib/repo";

export const dynamic = "force-dynamic";

// POST { category, amount }  amount=0 — limitni olib tashlash
export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  await setBudget(uid, String(b.category || ""), Number(b.amount));
  return NextResponse.json({ ok: true });
});
