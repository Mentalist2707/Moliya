import { NextResponse } from "next/server";
import { isTable, remove, update } from "@/lib/repo";
import { withUser } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ table: string; id: string }> };

export const PATCH = withUser<Ctx>(async (req, uid, { params }) => {
  const { table, id } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
  return NextResponse.json(await update(uid, table, Number(id), await req.json()));
});

export const DELETE = withUser<Ctx>(async (_req, uid, { params }) => {
  const { table, id } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
  await remove(uid, table, Number(id));
  return NextResponse.json({ ok: true });
});
