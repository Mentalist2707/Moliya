import { NextResponse } from "next/server";
import { toggleHabit } from "@/lib/repo";

export const dynamic = "force-dynamic";

// POST { habit_id, date: "YYYY-MM-DD", on?: boolean }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const id = Number(b.habit_id);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }
  const on = await toggleHabit(id, b.date, typeof b.on === "boolean" ? b.on : undefined);
  return NextResponse.json({ on });
}
