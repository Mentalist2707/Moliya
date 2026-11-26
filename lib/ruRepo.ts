import { getDb } from "./db";
import { aiReady } from "./ai";
import { schedule, type RuData, type RuGrammar, type RuItem, type RuPack } from "./ru";

export const AI_DAILY_LIMIT = 40;

const strip = <T extends Record<string, unknown>>(rows: T[]) => rows.map(({ user_id: _u, ...r }) => r) as unknown as T[];

/** Bo'lim faqat yoqilgan akkauntlar uchun */
export async function ruEnabled(uid: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.query("SELECT ru_enabled FROM users WHERE id=$1", [uid]);
  return Number(r.rows[0]?.ru_enabled) === 1;
}

export async function requireRu(uid: number) {
  if (!(await ruEnabled(uid))) throw new Error("Topilmadi");
}

export async function getRu(uid: number, today: string): Promise<RuData> {
  const db = await getDb();
  const q = (sql: string) => db.query(sql, [uid]).then((r) => strip(r.rows));
  const [words, lessons, sets, log] = await Promise.all([
    q("SELECT * FROM ru_words WHERE user_id=$1 ORDER BY id DESC"),
    q("SELECT * FROM ru_lessons WHERE user_id=$1 ORDER BY date DESC, id DESC"),
    q("SELECT * FROM ru_sets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60"),
    q("SELECT date, reviews, correct, ai_calls, xp FROM ru_log WHERE user_id=$1 AND date >= CURRENT_DATE - 400 ORDER BY date"),
  ]);
  const used = Number((log as { date: string; ai_calls: number }[]).find((l) => String(l.date).slice(0, 10) === today)?.ai_calls ?? 0);
  return { words, lessons, sets, log, ai: aiReady(), ai_left: Math.max(0, AI_DAILY_LIMIT - used) } as unknown as RuData;
}

/** AI chaqiruvini hisoblash; limitdan oshsa xato */
export async function useAi(uid: number, today: string) {
  if (!aiReady()) throw new Error("AI ulanmagan: Vercel'da ANTHROPIC_API_KEY o'rnatilmagan");
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO ru_log (user_id, date, ai_calls) VALUES ($1,$2,1)
     ON CONFLICT (user_id, date) DO UPDATE SET ai_calls = ru_log.ai_calls + 1 RETURNING ai_calls`,
    [uid, today]
  );
  if (Number(r.rows[0].ai_calls) > AI_DAILY_LIMIT) {
    await db.query("UPDATE ru_log SET ai_calls = ai_calls - 1 WHERE user_id=$1 AND date=$2", [uid, today]);
    throw new Error(`Bugungi AI limiti (${AI_DAILY_LIMIT} ta) tugadi, ertaga davom etamiz`);
  }
}

export async function refundAi(uid: number, today: string) {
  const db = await getDb();
  await db.query("UPDATE ru_log SET ai_calls = GREATEST(0, ai_calls - 1) WHERE user_id=$1 AND date=$2", [uid, today]);
}

const G = new Set(["m", "f", "n", "pl"]);
const s = (v: unknown, n: number) => (v == null || v === "" ? null : String(v).trim().slice(0, n));

export async function addWords(uid: number, words: { ru: string; uz: string; gender?: string | null; example?: string | null }[], lessonId: number | null, today: string) {
  const db = await getDb();
  let added = 0;
  for (const w of words) {
    const ru = s(w.ru, 120);
    const uz = s(w.uz, 200);
    if (!ru || !uz) continue;
    const r = await db.query(
      `INSERT INTO ru_words (user_id, lesson_id, ru, uz, gender, example, due) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, lower(ru)) DO NOTHING`,
      [uid, lessonId, ru, uz, G.has(String(w.gender)) ? w.gender : null, s(w.example, 300), today]
    );
    added += r.rowCount ?? 0;
  }
  return added;
}

export async function updateWord(uid: number, id: number, b: Record<string, unknown>) {
  const db = await getDb();
  await db.query(
    `UPDATE ru_words SET ru=COALESCE($3,ru), uz=COALESCE($4,uz), gender=$5, example=$6 WHERE id=$1 AND user_id=$2`,
    [id, uid, s(b.ru, 120), s(b.uz, 200), G.has(String(b.gender)) ? b.gender : null, s(b.example, 300)]
  );
}

export async function deleteWord(uid: number, id: number) {
  const db = await getDb();
  await db.query("DELETE FROM ru_words WHERE id=$1 AND user_id=$2", [id, uid]);
}

/** Kartochkaga baho qo'yish va keyingi takrorlash sanasini hisoblash */
export async function gradeWord(uid: number, id: number, grade: 0 | 1 | 2 | 3, today: string) {
  const db = await getDb();
  const r = await db.query("SELECT ease, ivl, reps, lapses FROM ru_words WHERE id=$1 AND user_id=$2", [id, uid]);
  const w = r.rows[0];
  if (!w) throw new Error("Topilmadi");
  const n = schedule({ ease: Number(w.ease), ivl: Number(w.ivl), reps: Number(w.reps), lapses: Number(w.lapses) }, grade);
  await db.query(
    `UPDATE ru_words SET ease=$3, ivl=$4, reps=$5, lapses=$6, due=$7::date + $4::int, last_seen=$7,
       learned_at = CASE WHEN $8 THEN COALESCE(learned_at, $7::date) ELSE learned_at END
     WHERE id=$1 AND user_id=$2`,
    [id, uid, n.ease, n.ivl, n.reps, n.lapses, today, grade > 0]
  );
  await logReview(uid, today, 1, grade > 0 ? 1 : 0);
  return n;
}

export async function logReview(uid: number, today: string, reviews: number, correct: number) {
  const db = await getDb();
  await db.query(
    `INSERT INTO ru_log (user_id, date, reviews, correct) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, date) DO UPDATE SET reviews = ru_log.reviews + $3, correct = ru_log.correct + $4`,
    [uid, today, Math.max(0, reviews | 0), Math.max(0, correct | 0)]
  );
}

function grammarJson(g: unknown): RuGrammar[] {
  if (typeof g === "string") return g.trim() ? [{ title: "", rule: g.trim().slice(0, 5000) }] : [];
  return Array.isArray(g) ? (g as RuGrammar[]).slice(0, 10) : [];
}

export async function saveLesson(uid: number, b: Record<string, unknown>) {
  const db = await getDb();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : null;
  const vals = [s(b.topic, 200) ?? "", s(b.summary, 1500), JSON.stringify(grammarJson(b.grammar)), s(b.homework, 1500), b.hw_done ? 1 : 0, s(b.notes, 3000)];
  if (b.id) {
    await db.query(
      `UPDATE ru_lessons SET topic=$3, summary=$4, grammar=$5, homework=$6, hw_done=$7, notes=$8, date=COALESCE($9::date, date) WHERE id=$1 AND user_id=$2`,
      [Number(b.id), uid, ...vals, date]
    );
    return Number(b.id);
  }
  const r = await db.query(
    `INSERT INTO ru_lessons (user_id, topic, summary, grammar, homework, hw_done, notes, date, source) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::date, CURRENT_DATE),$9) RETURNING id`,
    [uid, ...vals, date, b.source === "rasm" ? "rasm" : "qo'lda"]
  );
  return Number(r.rows[0].id);
}

export async function setHomework(uid: number, id: number, done: boolean) {
  const db = await getDb();
  await db.query("UPDATE ru_lessons SET hw_done=$3 WHERE id=$1 AND user_id=$2", [id, uid, done ? 1 : 0]);
}

export async function deleteLesson(uid: number, id: number, withWords: boolean) {
  const db = await getDb();
  if (withWords) await db.query("DELETE FROM ru_words WHERE lesson_id=$1 AND user_id=$2", [id, uid]);
  else await db.query("UPDATE ru_words SET lesson_id=NULL WHERE lesson_id=$1 AND user_id=$2", [id, uid]);
  await db.query("DELETE FROM ru_sets WHERE lesson_id=$1 AND user_id=$2", [id, uid]);
  await db.query("DELETE FROM ru_lessons WHERE id=$1 AND user_id=$2", [id, uid]);
}

export async function saveSet(uid: number, title: string, items: RuItem[], lessonId: number | null) {
  const db = await getDb();
  const r = await db.query("INSERT INTO ru_sets (user_id, lesson_id, title, items) VALUES ($1,$2,$3,$4) RETURNING id", [uid, lessonId, title.slice(0, 200), JSON.stringify(items)]);
  return Number(r.rows[0].id);
}

export async function scoreSet(uid: number, id: number, score: number, total: number, today: string) {
  const db = await getDb();
  const r = await db.query("UPDATE ru_sets SET score=$3, total=$4, done_at=now() WHERE id=$1 AND user_id=$2", [id, uid, score | 0, total | 0]);
  if (r.rowCount) await logReview(uid, today, total, score);
}

export async function deleteSet(uid: number, id: number) {
  const db = await getDb();
  await db.query("DELETE FROM ru_sets WHERE id=$1 AND user_id=$2", [id, uid]);
}

/** AI tuzgan to'plamni saqlash: dars + so'zlar + mashqlar */
export async function savePack(uid: number, pack: RuPack, opts: { date: string; wordsToSave?: number[]; source: "rasm" | "qo'lda" }) {
  const lessonId = await saveLesson(uid, {
    topic: pack.topic,
    summary: pack.summary,
    grammar: pack.grammar,
    homework: pack.homework,
    date: opts.date,
    source: opts.source,
  });
  const words = opts.wordsToSave ? pack.words.filter((_, i) => opts.wordsToSave!.includes(i)) : pack.words;
  const added = await addWords(uid, words, lessonId, opts.date);
  const setId = pack.exercises.length ? await saveSet(uid, pack.topic, pack.exercises, lessonId) : null;
  return { lessonId, added, setId };
}

/** Yangi so'zlarni "o'rganildi" deb belgilash: ertaga birinchi takrorlash */
export async function learnWords(uid: number, ids: number[], today: string) {
  const list = ids.map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 50);
  if (!list.length) return 0;
  const db = await getDb();
  const r = await db.query(
    `UPDATE ru_words SET reps = GREATEST(reps, 1), ivl = GREATEST(ivl, 1), due = $3::date + 1, last_seen = $3,
       learned_at = COALESCE(learned_at, $3::date)
     WHERE user_id=$1 AND id = ANY($2::int[]) AND reps = 0`,
    [uid, list, today]
  );
  await logReview(uid, today, list.length, list.length);
  return r.rowCount ?? 0;
}

/** Bot va eslatmalar uchun qisqa holat */
export async function ruStatus(uid: number, today: string) {
  const db = await getDb();
  const [due, fresh, hw, rev] = await Promise.all([
    db.query("SELECT count(*)::int AS n FROM ru_words WHERE user_id=$1 AND reps > 0 AND due <= $2", [uid, today]).then((r) => Number(r.rows[0].n)),
    db
      .query(
        `SELECT LEAST((SELECT count(*) FROM ru_words WHERE user_id=$1 AND reps = 0),
                GREATEST(0, (SELECT ru_daily_new FROM users WHERE id=$1) - (SELECT count(*) FROM ru_words WHERE user_id=$1 AND learned_at = $2)))::int AS n`,
        [uid, today]
      )
      .then((r) => Number(r.rows[0].n)),
    db.query("SELECT topic, homework FROM ru_lessons WHERE user_id=$1 AND hw_done=0 AND COALESCE(homework,'')<>'' ORDER BY date DESC LIMIT 3", [uid]).then((r) => r.rows as { topic: string; homework: string }[]),
    db.query("SELECT reviews FROM ru_log WHERE user_id=$1 AND date=$2", [uid, today]).then((r) => Number(r.rows[0]?.reviews ?? 0)),
  ]);
  return { due, fresh, homework: hw, reviewedToday: rev };
}

/* ---------- Telegram testlari (quiz poll) ---------- */
export async function pickQuizWords(uid: number, today: string, n = 5) {
  const db = await getDb();
  // Avval takrorlash vaqti kelganlar, keyin o'rganilganlardan tasodifiy
  const due = (await db.query("SELECT id, ru, uz, example FROM ru_words WHERE user_id=$1 AND reps > 0 AND due <= $2 ORDER BY random() LIMIT $3", [uid, today, n])).rows;
  const rest = due.length < n
    ? (await db.query("SELECT id, ru, uz, example FROM ru_words WHERE user_id=$1 AND reps > 0 AND NOT (id = ANY($2::int[])) ORDER BY random() LIMIT $3", [uid, due.map((w) => w.id), n - due.length])).rows
    : [];
  const words = [...due, ...rest] as { id: number; ru: string; uz: string; example: string | null }[];
  const pool = (await db.query("SELECT uz FROM ru_words WHERE user_id=$1 ORDER BY random() LIMIT 60", [uid])).rows.map((r) => String(r.uz));
  return { words, pool };
}

export async function savePoll(uid: number, pollId: string, wordId: number, correct: number) {
  const db = await getDb();
  await db.query("INSERT INTO ru_polls (poll_id, user_id, word_id, correct) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [pollId, uid, wordId, correct]);
  await db.query("DELETE FROM ru_polls WHERE created_at < now() - interval '3 days'");
}

/** Telegram testiga javob: to'g'ri bo'lsa va takrorlash vaqti kelgan bo'lsa — "Esimda", xato bo'lsa — "Esimda yo'q" */
export async function answerPoll(pollId: string, uid: number, option: number, today: string) {
  const db = await getDb();
  const p = (await db.query("DELETE FROM ru_polls WHERE poll_id=$1 AND user_id=$2 RETURNING word_id, correct", [pollId, uid])).rows[0];
  if (!p) return;
  const ok = Number(p.correct) === option;
  const w = (await db.query("SELECT due FROM ru_words WHERE id=$1 AND user_id=$2", [p.word_id, uid])).rows[0];
  if (!w) return;
  const isDue = String(w.due).slice(0, 10) <= today;
  if (!ok) await gradeWord(uid, Number(p.word_id), 0, today);
  else if (isDue) await gradeWord(uid, Number(p.word_id), 2, today);
  else await logReview(uid, today, 1, 1);
}

/** Sessiya tugadi: baholar, yangi o'rganilgan so'zlar va XP bitta so'rovda */
export async function finishSession(
  uid: number,
  today: string,
  b: { grades?: { id: number; grade: number }[]; learned?: number[]; xp?: number; total?: number; correct?: number }
) {
  const grades = (Array.isArray(b.grades) ? b.grades : []).slice(0, 100);
  for (const g of grades) {
    const grade = Number(g.grade);
    if (![0, 1, 2, 3].includes(grade) || !Number(g.id)) continue;
    await gradeWord(uid, Number(g.id), grade as 0 | 1 | 2 | 3, today).catch(() => null);
  }
  const learned = Array.isArray(b.learned) ? await learnWords(uid, b.learned, today) : 0;
  // gradeWord/learnWords o'zi takrorlashlarni yozadi; qolgan mashqlar (amaliyot) shu yerda
  const extra = Math.max(0, (Number(b.total) || 0) - grades.length - learned);
  const extraOk = Math.max(0, Math.min(extra, (Number(b.correct) || 0) - grades.filter((g) => Number(g.grade) > 0).length - learned));
  if (extra) await logReview(uid, today, extra, extraOk);
  const xp = Math.max(0, Math.min(2000, Math.round(Number(b.xp) || 0)));
  const db = await getDb();
  await db.query(
    `INSERT INTO ru_log (user_id, date, xp) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, date) DO UPDATE SET xp = ru_log.xp + $3`,
    [uid, today, xp]
  );
  return { learned };
}
