import { NextResponse } from "next/server";
import { isTable, remove, update } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ table: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { table, id } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
  try {
    const body = await req.json();
    return NextResponse.json(update(table, Number(id), body));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { table, id } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
  remove(table, Number(id));
  return NextResponse.json({ ok: true });
}
