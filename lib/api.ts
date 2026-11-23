import { NextResponse } from "next/server";
import { currentUid } from "./auth";

type Handler<C> = (req: Request, uid: number, ctx: C) => Promise<Response>;

/** API marshrutini o'rash: foydalanuvchini aniqlaydi, xatolarni JSON qilib qaytaradi */
export function withUser<C = unknown>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    const uid = await currentUid(req);
    if (!uid) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
    try {
      return await fn(req, uid, ctx);
    } catch (e) {
      const msg = (e as Error).message || "Xatolik";
      return NextResponse.json({ error: msg }, { status: msg === "Topilmadi" ? 404 : 400 });
    }
  };
}
