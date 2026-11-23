import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { addQuranPages, setQuranPage } from "@/lib/repo";

export const dynamic = "force-dynamic";

// POST { pages, date }  — o'qilgan sahifalarni qo'shish
// POST { set_page, khatm? } — joriy sahifani to'g'rilash
export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  if (b.set_page !== undefined) {
    await setQuranPage(uid, Number(b.set_page), b.khatm === undefined ? undefined : Number(b.khatm));
    return NextResponse.json({ ok: true });
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : new Date().toISOString().slice(0, 10);
  return NextResponse.json(await addQuranPages(uid, date, Number(b.pages)));
});
