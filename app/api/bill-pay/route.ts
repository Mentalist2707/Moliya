import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { payBill } from "@/lib/repo";
import { checkBudget } from "@/lib/budget";

export const dynamic = "force-dynamic";

// POST { id, date, add_tx }
export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : new Date().toISOString().slice(0, 10);
  const bill = await payBill(uid, Number(b.id), date, b.add_tx !== false);
  if (b.add_tx !== false) await checkBudget(uid, bill.category, date);
  return NextResponse.json({ ok: true });
});
