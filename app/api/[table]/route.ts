import { NextResponse } from "next/server";
import { insert, isTable } from "@/lib/repo";
import { withUser } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ table: string }> };

export const POST = withUser<Ctx>(async (req, uid, { params }) => {
  const { table } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
  return NextResponse.json(await insert(uid, table, await req.json()), { status: 201 });
});
