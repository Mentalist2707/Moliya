import { NextResponse } from "next/server";
import { insert, isTable } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Noma'lum bo'lim" }, { status: 404 });
  try {
    const body = await req.json();
    return NextResponse.json(insert(table, body), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
