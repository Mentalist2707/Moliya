import { NextResponse } from "next/server";
import { getAll, insert, isTable } from "@/lib/repo";
import { withUser } from "@/lib/api";
import { checkBudget } from "@/lib/budget";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ table: string }> };

// GET /api/<table> — butun holatni qaytaradi (Vercel ba'zan statik marshrutni shu yerga yo'naltiradi)
export const GET = withUser<Ctx>(async (_req, uid, { params }) => {
  const { table } = await params;
  if (table === "state" || table === "data") return NextResponse.json(await getAll(uid));
  return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
});

export const POST = withUser<Ctx>(async (req, uid, { params }) => {
  const { table } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
  const row = (await insert(uid, table, await req.json())) as Record<string, unknown>;
  if (table === "transactions" && row?.type === "chiqim") await checkBudget(uid, String(row.category), String(row.date).slice(0, 10));
  return NextResponse.json(row, { status: 201 });
});
