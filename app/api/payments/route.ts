import { NextResponse } from "next/server";
import { addPayment, removePayment } from "@/lib/repo";
import { withUser } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST { kind: 'goal'|'debt', ref_id, amount, date, note }
export const POST = withUser(async (req, uid) => {
  const b = await req.json();
  const amount = Number(b.amount);
  if (!["goal", "debt"].includes(b.kind) || !b.ref_id || !amount) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }
  const date = b.date || new Date().toISOString().slice(0, 10);
  await addPayment(uid, b.kind, Number(b.ref_id), amount, date, b.note);
  return NextResponse.json({ ok: true }, { status: 201 });
});

// DELETE ?id=123
export const DELETE = withUser(async (req, uid) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });
  await removePayment(uid, id);
  return NextResponse.json({ ok: true });
});
