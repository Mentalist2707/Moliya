import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { todayIn } from "@/lib/telegram";
import { packFromImages } from "@/lib/ruAi";
import { refundAi, requireRu, useAi } from "@/lib/ruRepo";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // rasmni o'qish va mashq tuzish ~30–90 soniya

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** POST { images: [{ data: base64, type }], hint? } → dars to'plami (hali saqlanmaydi) */
export const POST = withUser(async (req, uid) => {
  await requireRu(uid);
  const b = (await req.json().catch(() => ({}))) as { images?: { data?: string; type?: string }[]; hint?: string };
  const images = (b.images || [])
    .filter((im) => im?.data && TYPES.has(String(im.type)))
    .slice(0, 4)
    .map((im) => ({ data: String(im.data).replace(/^data:[^,]+,/, ""), type: im.type as "image/jpeg" | "image/png" | "image/webp" }));
  if (!images.length) throw new Error("Rasm yuklanmadi");
  const today = todayIn();
  await useAi(uid, today);
  try {
    const pack = await packFromImages(images, b.hint ? String(b.hint).slice(0, 300) : undefined);
    return NextResponse.json({ pack });
  } catch (e) {
    await refundAi(uid, today);
    throw e;
  }
});
