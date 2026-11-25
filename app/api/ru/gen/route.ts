import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/telegram";
import { generateExercises } from "@/lib/ruAi";
import type { RuGrammar } from "@/lib/ru";
import { refundAi, requireRu, saveSet, useAi } from "@/lib/ruRepo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { lesson_id? , topic?, focus?, count?, mode?: "weak" } → yangi mashqlar to'plami */
export const POST = withUser(async (req, uid) => {
  await requireRu(uid);
  const b = (await req.json().catch(() => ({}))) as { lesson_id?: number; topic?: string; focus?: string; count?: number; mode?: string };
  const db = await getDb();
  const lessonId = Number(b.lesson_id) || null;
  let topic = String(b.topic || "").slice(0, 200);
  let grammar: RuGrammar[] = [];
  let words: { ru: string; uz: string }[] = [];
  if (lessonId) {
    const l = (await db.query("SELECT topic, grammar FROM ru_lessons WHERE id=$1 AND user_id=$2", [lessonId, uid])).rows[0];
    if (!l) throw new Error("Topilmadi");
    topic = l.topic;
    grammar = l.grammar || [];
    words = (await db.query("SELECT ru, uz FROM ru_words WHERE lesson_id=$1 AND user_id=$2", [lessonId, uid])).rows;
  } else {
    words = (await db.query("SELECT ru, uz FROM ru_words WHERE user_id=$1 ORDER BY random() LIMIT 40", [uid])).rows;
  }
  const weak = (await db.query("SELECT ru, uz FROM ru_words WHERE user_id=$1 AND lapses > 0 ORDER BY lapses DESC, ease LIMIT 12", [uid])).rows;
  const today = todayIn();
  await useAi(uid, today);
  try {
    const items = await generateExercises({ topic, grammar, words, weak: b.mode === "weak" || !lessonId ? weak : weak.slice(0, 4), count: b.count, focus: b.focus?.slice(0, 300) });
    const title = topic || (b.mode === "weak" ? "Qiyin so'zlar" : b.focus ? String(b.focus).slice(0, 60) : "Aralash takrorlash");
    const id = await saveSet(uid, title, items, lessonId);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    await refundAi(uid, today);
    throw e;
  }
});
