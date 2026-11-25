import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { todayIn } from "@/lib/telegram";
import { cleanPack } from "@/lib/ru";
import {
  addWords, deleteLesson, deleteSet, deleteWord, getRu, gradeWord, logReview, requireRu, saveLesson, savePack, scoreSet, setHomework, updateWord,
} from "@/lib/ruRepo";

export const dynamic = "force-dynamic";

export const GET = withUser(async (_req, uid) => {
  await requireRu(uid);
  return NextResponse.json(await getRu(uid, todayIn()));
});

/** Bitta marshrut, amal nomi bilan: { action, ... } */
export const POST = withUser(async (req, uid) => {
  await requireRu(uid);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const today = todayIn();
  const id = Number(b.id) || 0;
  switch (b.action) {
    case "word.add": {
      const list = Array.isArray(b.words) ? (b.words as { ru: string; uz: string }[]) : [b as unknown as { ru: string; uz: string }];
      const added = await addWords(uid, list, b.lesson_id ? Number(b.lesson_id) : null, today);
      return NextResponse.json({ ok: true, added, skipped: list.length - added });
    }
    case "word.update":
      await updateWord(uid, id, b);
      break;
    case "word.delete":
      await deleteWord(uid, id);
      break;
    case "word.grade": {
      const g = Number(b.grade);
      if (![0, 1, 2, 3].includes(g)) throw new Error("Noto'g'ri baho");
      return NextResponse.json(await gradeWord(uid, id, g as 0 | 1 | 2 | 3, today));
    }
    case "quiz.done":
      await logReview(uid, today, Number(b.total) || 0, Number(b.correct) || 0);
      break;
    case "lesson.save":
      return NextResponse.json({ ok: true, id: await saveLesson(uid, b) });
    case "lesson.hw":
      await setHomework(uid, id, !!b.done);
      break;
    case "lesson.delete":
      await deleteLesson(uid, id, !!b.with_words);
      break;
    case "set.score":
      await scoreSet(uid, id, Number(b.score) || 0, Number(b.total) || 0, today);
      break;
    case "set.delete":
      await deleteSet(uid, id);
      break;
    case "pack.save": {
      const pack = cleanPack((b.pack ?? {}) as Record<string, unknown>);
      const keep = Array.isArray(b.words) ? (b.words as unknown[]).map(Number) : undefined;
      return NextResponse.json({ ok: true, ...(await savePack(uid, pack, { date: today, wordsToSave: keep, source: b.source === "qo'lda" ? "qo'lda" : "rasm" })) });
    }
    default:
      throw new Error("Noma'lum amal");
  }
  return NextResponse.json({ ok: true });
});
