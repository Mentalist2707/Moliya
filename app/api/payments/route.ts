import { NextResponse } from "next/server";
import { addPayment, removePayment } from "@/lib/repo";

export const dynamic = "force-dynamic";

// POST { kind: 'goal'|'debt', ref_id, amount, date, note }
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const amount = Number(b.amount);
    if (!["goal", "debt"].includes(b.kind) || !b.ref_id || !amount) {
      return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
    }
    const date = b.date || new Date().toISOString().slice(0, 10);
    await addPayment(b.kind, Number(b.ref_id), amount, date, b.note);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// DELETE ?id=123
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });
  await removePayment(id);
  return NextResponse.json({ ok: true });
}
