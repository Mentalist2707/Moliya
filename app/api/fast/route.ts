import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { setFast } from "@/lib/repo";
import { invalidatePlan } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// POST { date, status: 'niyat'|'tutdim'|'qoldi'|null }
export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) return NextResponse.json({ error: "date kerak" }, { status: 400 });
  const st = b.status === null ? null : String(b.status);
  if (st !== null && !["niyat", "tutdim", "qoldi"].includes(st)) return NextResponse.json({ error: "status noto'g'ri" }, { status: 400 });
  await setFast(uid, b.date, st as "niyat" | "tutdim" | "qoldi" | null);
  invalidatePlan();
  return NextResponse.json({ ok: true });
});
