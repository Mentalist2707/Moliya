/** Rus tili: turlar, takrorlash (SRS) va javob tekshirish — server va mijoz uchun umumiy */

export type RuGender = "m" | "f" | "n" | "pl" | null;
export type RuWord = {
  id: number;
  lesson_id: number | null;
  ru: string;
  uz: string;
  gender: RuGender;
  example: string | null;
  ease: number;
  ivl: number;
  reps: number;
  lapses: number;
  due: string;
  last_seen: string | null;
  learned_at: string | null;
};
export type RuGrammar = { title: string; rule: string; examples?: { ru: string; uz: string }[] };
export type RuLesson = {
  id: number;
  date: string;
  topic: string;
  summary: string | null;
  grammar: RuGrammar[];
  homework: string | null;
  hw_done: number;
  notes: string | null;
  source: string;
};
export type RuItem =
  | { type: "choice"; q: string; options: string[]; answer: number; explain?: string }
  | { type: "fill"; q: string; answer: string; accept?: string[]; hint?: string; explain?: string }
  | { type: "translate"; q: string; answer: string; accept?: string[]; explain?: string };
export type RuSet = { id: number; lesson_id: number | null; title: string; items: RuItem[]; score: number | null; total: number | null; done_at: string | null; created_at: string };
export type RuLogDay = { date: string; reviews: number; correct: number; xp?: number };
export type RuData = { words: RuWord[]; lessons: RuLesson[]; sets: RuSet[]; log: RuLogDay[]; ai: boolean; ai_left: number };

/** Rasmdan yoki mavzudan AI qaytaradigan to'plam */
export type RuPack = {
  topic: string;
  summary?: string;
  grammar: RuGrammar[];
  words: { ru: string; uz: string; gender?: RuGender; example?: string }[];
  homework?: string;
  exercises: RuItem[];
};

export const GENDER_LABEL: Record<string, string> = { m: "он (м.р.)", f: "она (ж.р.)", n: "оно (ср.р.)", pl: "они (мн.ч.)" };

/** Takrorlash bahosi: 0 — Esimda yo'q, 1 — Qiyin, 2 — Yaxshi, 3 — Oson (SM-2 soddalashtirilgan) */
export function schedule(w: Pick<RuWord, "ease" | "ivl" | "reps" | "lapses">, grade: 0 | 1 | 2 | 3) {
  let { ease, ivl, reps, lapses } = w;
  if (grade === 0) {
    lapses += 1;
    reps = 0;
    ivl = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else if (grade === 1) {
    ivl = Math.max(1, Math.round(ivl * 1.2));
    ease = Math.max(1.3, ease - 0.15);
    reps += 1;
  } else if (grade === 2) {
    ivl = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(ivl + 1, Math.round(ivl * ease));
    reps += 1;
  } else {
    ivl = reps === 0 ? 4 : Math.max(ivl + 2, Math.round(ivl * ease * 1.3));
    ease = Math.min(3.2, ease + 0.15);
    reps += 1;
  }
  return { ease: Math.round(ease * 100) / 100, ivl: Math.min(ivl, 365), reps, lapses };
}

/** Keyingi takrorlash qachon — tugma ostidagi yozuv uchun */
export function ivlLabel(days: number): string {
  if (days <= 0) return "hozir";
  if (days === 1) return "ertaga";
  if (days < 30) return `${days} kun`;
  if (days < 365) return `${Math.round(days / 30)} oy`;
  return "1 yil";
}

/** Javobni solishtirish uchun: kichik harf, ё→е, urg'u/tinish belgilarisiz */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // urg'u belgilari
    .normalize("NFC")
    .replace(/ё/g, "е")
    .replace(/[«»"'“”„.,!?;:()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrect(given: string, answer: string, accept: string[] = []): boolean {
  const g = norm(given);
  if (!g) return false;
  return [answer, ...accept].some((a) => norm(a) === g);
}

/** Bitta harf xato bo'lsa — "deyarli to'g'ri" */
export function almost(given: string, answer: string): boolean {
  const a = norm(given);
  const b = norm(answer);
  if (!a || Math.abs(a.length - b.length) > 1 || b.length < 4) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + (a.length >= b.length ? 1 : 0)) === b.slice(i + (b.length >= a.length ? 1 : 0));
}

/** Kunlik streak (takrorlash yoki mashq qilingan kunlar) */
export function ruStreak(log: RuLogDay[], today: string): { streak: number; today: number } {
  const set = new Map(log.filter((l) => l.reviews > 0).map((l) => [l.date.slice(0, 10), l.reviews]));
  const day = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  let d = set.has(today) ? today : day(today, -1);
  let streak = 0;
  while (set.has(d)) {
    streak++;
    d = day(d, -1);
  }
  return { streak, today: set.get(today) ?? 0 };
}

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** AI javobidagi mashqlarni tekshirib, buzuqlarini tashlab yuborish */
export function cleanItems(raw: unknown): RuItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RuItem[] = [];
  for (const x of raw as Record<string, unknown>[]) {
    const q = String(x?.q ?? "").trim();
    const explain = x?.explain ? String(x.explain).slice(0, 600) : undefined;
    if (!q) continue;
    if (x.type === "choice" && Array.isArray(x.options) && x.options.length >= 2) {
      const options = (x.options as unknown[]).map(String).slice(0, 5);
      const answer = Number(x.answer);
      if (Number.isInteger(answer) && answer >= 0 && answer < options.length) out.push({ type: "choice", q, options, answer, explain });
    } else if ((x.type === "fill" || x.type === "translate") && x.answer) {
      const accept = Array.isArray(x.accept) ? (x.accept as unknown[]).map(String).slice(0, 6) : [];
      if (x.type === "fill") out.push({ type: "fill", q, answer: String(x.answer), accept, hint: x.hint ? String(x.hint) : undefined, explain });
      else out.push({ type: "translate", q, answer: String(x.answer), accept, explain });
    }
  }
  return out.slice(0, 30);
}

export function cleanPack(raw: Record<string, unknown>): RuPack {
  const str = (v: unknown, n = 2000) => (v == null ? "" : String(v).slice(0, n));
  const grammar = (Array.isArray(raw.grammar) ? raw.grammar : [])
    .map((g: Record<string, unknown>) => ({
      title: str(g?.title, 200),
      rule: str(g?.rule, 3000),
      examples: (Array.isArray(g?.examples) ? g.examples : []).slice(0, 8).map((e: Record<string, unknown>) => ({ ru: str(e?.ru, 300), uz: str(e?.uz, 300) })),
    }))
    .filter((g) => g.title || g.rule)
    .slice(0, 8);
  const G = ["m", "f", "n", "pl"];
  const words = (Array.isArray(raw.words) ? raw.words : [])
    .map((w: Record<string, unknown>) => ({
      ru: str(w?.ru, 120).trim(),
      uz: str(w?.uz, 200).trim(),
      gender: (G.includes(String(w?.gender)) ? String(w.gender) : null) as RuGender,
      example: str(w?.example, 300) || undefined,
    }))
    .filter((w) => w.ru && w.uz)
    .slice(0, 80);
  return {
    topic: str(raw.topic, 200) || "Dars",
    summary: str(raw.summary, 1500) || undefined,
    grammar,
    words,
    homework: str(raw.homework, 1500) || undefined,
    exercises: cleanItems(raw.exercises),
  };
}

/** "читать / прочитать", "час, часы" → har bir variant */
export function variants(ru: string): string[] {
  return ru
    .split(/[\/,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export type WordState = "new" | "learning" | "known";
export function wordState(w: Pick<RuWord, "reps" | "ivl">): WordState {
  if (w.reps === 0) return "new";
  return w.ivl >= 21 ? "known" : "learning";
}
export const STATE_LABEL: Record<WordState, string> = { new: "yangi", learning: "o'rganilmoqda", known: "yod" };

export const isDueReview = (w: Pick<RuWord, "reps" | "due">, today: string) => w.reps > 0 && w.due.slice(0, 10) <= today;

/* ---------- Rus tili 2.0: o'yin mexanikasi ---------- */

/** Bitta bosqichdagi so'zlar soni — qisqa, 2–3 daqiqalik sessiya */
export const NODE_SIZE = 5;

/** XP → daraja. N-darajadan N+1 ga o'tish uchun N*100 XP kerak */
export function xpLevel(total: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = Math.max(0, total);
  while (rest >= level * 100) {
    rest -= level * 100;
    level++;
  }
  return { level, into: rest, need: level * 100 };
}

export type RuNode = { idx: number; words: RuWord[]; done: number; state: "done" | "open" | "locked" };
export type RuUnit = { id: number | null; title: string; words: RuWord[]; nodes: RuNode[]; learned: number };

/** Darslar → bo'limlar (unit) → har biri NODE_SIZE so'zli bosqichlar. Har bo'limda birinchi tugallanmagan bosqich ochiq */
export function buildUnits(words: RuWord[], lessons: Pick<RuLesson, "id" | "topic">[]): RuUnit[] {
  const byLesson = new Map<number | null, RuWord[]>();
  for (const w of [...words].sort((a, b) => a.id - b.id)) {
    const k = w.lesson_id && lessons.some((l) => l.id === w.lesson_id) ? w.lesson_id : null;
    if (!byLesson.has(k)) byLesson.set(k, []);
    byLesson.get(k)!.push(w);
  }
  const order: (number | null)[] = [...lessons].sort((a, b) => a.id - b.id).map((l) => l.id);
  if (byLesson.has(null)) order.push(null);
  return order
    .filter((id) => byLesson.get(id)?.length)
    .map((id) => {
      const ws = byLesson.get(id)!;
      const nodes: RuNode[] = [];
      let opened = false;
      for (let i = 0; i < ws.length; i += NODE_SIZE) {
        const chunk = ws.slice(i, i + NODE_SIZE);
        const done = chunk.filter((w) => w.reps > 0).length;
        let state: RuNode["state"] = "locked";
        if (done === chunk.length) state = "done";
        else if (!opened) {
          state = "open";
          opened = true;
        }
        nodes.push({ idx: nodes.length, words: chunk, done, state });
      }
      const title = id == null ? "Boshqa so'zlar" : lessons.find((l) => l.id === id)!.topic;
      return { id, title, words: ws, nodes, learned: ws.filter((w) => w.reps > 0).length };
    });
}

/** "yechim, qaror" / "kitob (darslik)" → qabul qilinadigan javoblar */
export function uzAnswers(uz: string): string[] {
  const base = uz.replace(/\([^)]*\)/g, " ");
  const parts = base.split(/[,;/]/).map((x) => x.trim()).filter(Boolean);
  return [...new Set([uz, base.trim(), ...parts])];
}

/** O'zbekcha apostrof variantlari: o' oʻ o‘ o` → bir xil */
export function normUz(s: string): string {
  return norm(s.replace(/[ʻʼ‘’`]/g, "'"));
}

export function isUzCorrect(given: string, uz: string): boolean {
  const g = normUz(given);
  if (!g) return false;
  return uzAnswers(uz).some((a) => normUz(a) === g);
}
