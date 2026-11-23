import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { saveZakat } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const POST = withUser(async (req, uid) => {
  const b = await req.json().catch(() => ({}));
  await saveZakat(uid, b && typeof b === "object" ? b : {});
  return NextResponse.json({ ok: true });
});
