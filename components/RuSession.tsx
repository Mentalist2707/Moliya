"use client";

/**
 * Rus tili sessiyasi: qisqa (2–3 daqiqa), ketma-ket mashqlar, darhol javob,
 * XP, combo va oxirida natija ekrani. Xato topilgan mashq sessiya oxirida yana chiqadi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pushBack } from "@/lib/back";
import { almost, GENDER_LABEL, isCorrect, isUzCorrect, norm, normUz, shuffle, SKILL, uzAnswers, variants, type RuItem, type RuSkill, type RuWord } from "@/lib/ru";
import { autoplay, canSpeak, post, speak } from "./ruCtx";
import { useStore } from "./ui";

export type SessionKind = "learn" | "review" | "practice" | "grammar";
export type SessionResult = { xp: number; correct: number; total: number; combo: number; secs: number; learned: number };

type Step =
  | { k: "intro"; w: RuWord }
  | { k: "choice"; w: RuWord; dir: "ru2uz" | "uz2ru" }
  | { k: "listen"; w: RuWord }
  | { k: "tiles"; w: RuWord }
  | { k: "type"; w: RuWord }
  | { k: "match"; ws: RuWord[] }
  | { k: "item"; it: RuItem; i: number }
  | { k: "passage" };

/** O'qish/tinglash matni */
export type Passage = { kind: RuSkill; text: string; uz?: string | null; gloss?: Record<string, string> | null };

/** Javob natijasi: so'z yoki grammatika mashqi uchun umumiy */
type Verdict = { ok: boolean; near?: boolean; answer: string; line?: string; example?: string | null; say?: string };
type Info = { id?: number; key: string; answer: string; line?: string; example?: string | null; say?: string };
type OnWord = (ok: boolean, w: RuWord, shown: string, near?: boolean) => void;

/* ---------- Ovoz effektlari (WebAudio, fayl yuklamasdan) ---------- */
let actx: AudioContext | null = null;
export function sfxOn(): boolean {
  try {
    return localStorage.getItem("ru_sfx") !== "0";
  } catch {
    return true;
  }
}
export function setSfx(on: boolean) {
  try {
    localStorage.setItem("ru_sfx", on ? "1" : "0");
  } catch {
    /* */
  }
}
function beep(kind: "ok" | "bad" | "done") {
  if (!sfxOn()) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx ??= new AC();
    const notes = kind === "ok" ? [660, 880] : kind === "bad" ? [220, 180] : [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const o = actx!.createOscillator();
      const g = actx!.createGain();
      o.type = kind === "bad" ? "square" : "sine";
      o.frequency.value = f;
      const t = actx!.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === "bad" ? 0.05 : 0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(actx!.destination);
      o.start(t);
      o.stop(t + 0.18);
    });
  } catch {
    /* ovoz bo'lmasa — jim */
  }
}

const ruMain = (w: RuWord) => variants(w.ru)[0] ?? w.ru;
const tileable = (w: RuWord) => {
  const m = ruMain(w);
  return m.length >= 3 && m.length <= 12 && !/\s/.test(m);
};

/** Chalg'ituvchi variantlar: avval shu bo'limdan, o'xshash uzunlikdagi */
function distractors(w: RuWord, pool: RuWord[], field: "ru" | "uz", n = 3): string[] {
  const own = w[field].toLowerCase();
  // Ma'nosi bir xil so'zlar (мама / мать — ona) variant bo'lmasin: aks holda ikkita to'g'ri javob chiqadi
  const mine = new Set(uzAnswers(w.uz).map(normUz));
  const same = (x: RuWord) => uzAnswers(x.uz).some((a) => mine.has(normUz(a)));
  const cand = shuffle(pool.filter((x) => x.id !== w.id && x[field].toLowerCase() !== own && !same(x)));
  const near = cand.filter((x) => x.lesson_id === w.lesson_id);
  const out: string[] = [];
  for (const x of [...near, ...cand]) {
    const v = x[field];
    if (!out.includes(v)) out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

/** Mashqlar rejasi */
function plan(kind: SessionKind, words: RuWord[]): Step[] {
  const speakOk = canSpeak();
  if (kind === "learn") {
    // 4 tadan guruh: tanishuv → tanib olish → juftlash; oxirida hamma so'zlar aralash takror
    const steps: Step[] = [];
    for (let i = 0; i < words.length; i += 4) {
      const g = words.slice(i, i + 4);
      g.forEach((w) => steps.push({ k: "intro", w }));
      shuffle(g).forEach((w) => steps.push({ k: "choice", w, dir: "ru2uz" }));
      if (g.length >= 3) steps.push({ k: "match", ws: g });
    }
    const KINDS = ["uz2ru", "tiles", "listen", "type"] as const;
    const late: Step[] = words.map((w, i) => {
      const t = KINDS[i % 4];
      if (t === "tiles" && tileable(w)) return { k: "tiles", w };
      if (t === "listen" && speakOk) return { k: "listen", w };
      if (t === "type") return { k: "type", w };
      return { k: "choice", w, dir: "uz2ru" };
    });
    steps.push(...shuffle(late));
    return steps;
  }
  if (kind === "review") {
    // Har so'zga bitta mashq: kuchiga qarab qiyinlashadi
    const steps: Step[] = words.map((w, i) => {
      if (w.ivl <= 3) return i % 2 ? { k: "choice", w, dir: "uz2ru" } : { k: "choice", w, dir: "ru2uz" };
      if (w.ivl <= 10) return tileable(w) && i % 2 ? { k: "tiles", w } : speakOk ? { k: "listen", w } : { k: "choice", w, dir: "uz2ru" };
      return tileable(w) && i % 3 === 0 ? { k: "tiles", w } : { k: "type", w };
    });
    const s = shuffle(steps);
    const easy = words.filter((w) => w.ivl <= 10).slice(0, 5);
    if (easy.length >= 4) s.splice(Math.floor(s.length / 2), 0, { k: "match", ws: easy });
    return s;
  }
  // Amaliyot: har so'zga 2 xil mashq
  const a: Step[] = words.map((w, i) => (speakOk && i % 3 === 1 ? { k: "listen", w } : { k: "choice", w, dir: i % 2 ? "uz2ru" : "ru2uz" }));
  const b: Step[] = words.map((w) => (tileable(w) ? { k: "tiles", w } : { k: "type", w }));
  const out = [...shuffle(a)];
  if (words.length >= 4) out.push({ k: "match", ws: shuffle(words).slice(0, 5) });
  return [...out, ...shuffle(b)];
}

export default function Session({
  kind,
  title,
  words,
  items,
  setId,
  passage,
  pool,
  onClose,
  onSaved,
  goal,
  xpToday,
}: {
  kind: SessionKind;
  title: string;
  words: RuWord[];
  items?: RuItem[];
  passage?: Passage;
  setId?: number;
  pool: RuWord[];
  onClose: () => void;
  onSaved: () => void;
  goal: number;
  xpToday: number;
}) {
  const { haptic, toast } = useStore();
  const [queue, setQueue] = useState<Step[]>(() =>
    kind === "grammar"
      ? [
          ...(passage?.text ? [{ k: "passage" as const }] : []),
          ...(items ?? []).map((it, i) => ({ k: "item" as const, it, i })),
        ]
      : plan(kind, words)
  );
  const [pos, setPos] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [bonus, setBonus] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [quit, setQuit] = useState(false);
  const started = useRef(Date.now());
  const missed = useRef(new Set<number>()); // xato qilingan so'zlar
  const nearMiss = useRef(new Set<number>());
  const missedKeys = useRef(new Set<string>()); // grammatika: birinchi urinishda xato qilingan savollar
  const retried = useRef(new Set<string>()); // qayta qo'yilgan mashqlar (har so'z+tur bir marta)

  // Orqaga tugmasi: avval "chiqasizmi?" so'rash
  const quitRef = useRef(() => setQuit(true));
  useEffect(() => pushBack(() => (result ? onClose() : quitRef.current())), [result, onClose]);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const step = queue[pos];
  const counts = (s: Step) => s.k !== "intro" && s.k !== "passage";
  const progress = Math.min(100, (queue.slice(0, pos).filter(counts).length / Math.max(1, queue.filter(counts).length)) * 100);

  const answer = useCallback(
    (ok: boolean, inf: Info, near = false) => {
      setVerdict({ ok, near, answer: inf.answer, line: inf.line, example: inf.example, say: inf.say });
      setStats((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }));
      if (ok) {
        const c = combo + 1;
        setCombo(c);
        setBest((b) => Math.max(b, c));
        const add = 10 + (c >= 3 ? 5 : 0);
        setXp((x) => x + add);
        setBonus(c >= 3 && c % 5 === 0 ? `🔥 ${c} ta ketma-ket!` : null);
        if (near && inf.id) nearMiss.current.add(inf.id);
        beep("ok");
        haptic("success");
        if (inf.say && autoplay()) speak(inf.say);
      } else {
        setCombo(0);
        setBonus(null);
        if (inf.id) missed.current.add(inf.id);
        else missed.current.add(-1);
        beep("bad");
        haptic();
        // Shu mashqni sessiya oxiriga yana qo'yamiz (bir marta)
        missedKeys.current.add(inf.key);
        if (!retried.current.has(inf.key)) {
          retried.current.add(inf.key);
          setQueue((q) => [...q, q[pos]]);
        }
      }
    },
    [combo, haptic, pos]
  );

  const onWord: OnWord = useCallback(
    (ok, w, shown, near) => {
      const st = queue[pos];
      answer(ok, { id: w.id, key: `${st?.k}:${w.id}`, answer: shown, line: `${w.ru} — ${w.uz}`, example: w.example, say: w.ru }, near);
    },
    [answer, pos, queue]
  );

  const finish = useCallback(async () => {
    const secs = Math.round((Date.now() - started.current) / 1000);
    const perfect = missed.current.size === 0 && stats.total > 0;
    const total = xp + (perfect ? 20 : 0) + (kind === "learn" ? words.length * 2 : 0);
    const res: SessionResult = { xp: total, correct: stats.correct, total: stats.total, combo: best, secs, learned: kind === "learn" ? words.length : 0 };
    setResult(res);
    beep("done");
    haptic("success");
    const grades =
      kind === "review"
        ? words.map((w) => ({ id: w.id, grade: missed.current.has(w.id) ? 0 : nearMiss.current.has(w.id) ? 1 : w.ivl > 10 ? 3 : 2 }))
        : [];
    try {
      const n = items?.length ?? 0;
      if (kind === "grammar" && setId) await post({ action: "set.score", id: setId, score: n - missedKeys.current.size, total: n });
      await post({
        action: "session.finish",
        grades,
        learned: kind === "learn" ? words.map((w) => w.id) : [],
        xp: total,
        total: kind === "grammar" ? 0 : Math.max(stats.total, grades.length),
        correct: stats.correct,
      });
      onSaved();
    } catch (e) {
      toast("Natija saqlanmadi: " + (e as Error).message);
    }
  }, [best, haptic, items, kind, onSaved, setId, stats, toast, words, xp]);

  const next = useCallback(() => {
    setVerdict(null);
    setBonus(null);
    if (pos + 1 >= queue.length) finish();
    else setPos(pos + 1);
  }, [finish, pos, queue.length]);

  // Enter — davom etish
  useEffect(() => {
    if (!verdict) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    const t = setTimeout(() => document.addEventListener("keydown", onKey), 150);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [verdict, next]);

  if (result) return <Finish r={result} title={title} kind={kind} skill={passage?.kind} goal={goal} xpBefore={xpToday} onClose={onClose} />;

  return (
    <div className="rs" role="dialog" aria-modal="true" aria-label={title}>
      <div className="rs-top">
        <button className="rs-x" aria-label="Chiqish" onClick={() => setQuit(true)}>
          ✕
        </button>
        <div className="rs-prog" aria-label={`${Math.round(progress)}%`}>
          <b style={{ width: progress + "%" }} />
        </div>
        <span className={"rs-combo" + (combo >= 3 ? " hot" : "")} aria-label={`Ketma-ket: ${combo}`}>
          🔥 {combo}
        </span>
      </div>

      <div className="rs-body" key={pos}>
        {step?.k === "intro" && <Intro w={step.w} onNext={next} />}
        {step?.k === "choice" && <Choice step={step} pool={pool} verdict={verdict} onAnswer={onWord} />}
        {step?.k === "listen" && <Listen w={step.w} pool={pool} verdict={verdict} onAnswer={onWord} />}
        {step?.k === "tiles" && <Tiles w={step.w} verdict={verdict} onAnswer={onWord} />}
        {step?.k === "type" && <TypeIn w={step.w} verdict={verdict} onAnswer={onWord} />}
        {step?.k === "passage" && passage && <PassageView p={passage} pool={pool} onNext={next} />}
        {step?.k === "item" && (
          <GItem
            it={step.it}
            verdict={verdict}
            listen={passage?.kind === "listening" ? passage.text : undefined}
            onAnswer={(ok, shown, line, note) => answer(ok, { key: "item:" + step.i, answer: shown, line, example: note ?? step.it.explain }, false)}
          />
        )}
        {step?.k === "match" && <Match ws={step.ws} onDone={(mistakes) => {
          setStats((s) => ({ correct: s.correct + (mistakes ? 0 : 1), total: s.total + 1 }));
          setXp((x) => x + (mistakes ? 5 : 15));
          beep(mistakes ? "ok" : "done");
          next();
        }} />}
      </div>

      {verdict && (
        <div className={"rs-verdict " + (verdict.ok ? "ok" : "bad")} role="status">
          <div className="rs-vtext">
            <b>{verdict.ok ? (verdict.near ? "Deyarli! Bitta harf xato" : pick(PRAISE, pos)) : "To'g'ri javob:"}</b>
            {(!verdict.ok || verdict.near) && <span className="rs-ans">{verdict.answer}</span>}
            {verdict.ok && !verdict.near && verdict.line && <span>{verdict.line}</span>}
            {verdict.example && <small>{verdict.example}</small>}
            {bonus && <span className="rs-bonus">{bonus}</span>}
          </div>
          <button className="rs-btn" onClick={next} data-autofocus>
            Davom etish
          </button>
        </div>
      )}

      {quit && (
        <div className="rs-quit" onClick={() => setQuit(false)}>
          <div className="rs-quit-card" onClick={(e) => e.stopPropagation()}>
            <b style={{ fontSize: 40 }}>🥺</b>
            <h3>Chiqib ketasizmi?</h3>
            <p>Ozgina qoldi! Hozir chiqsangiz, bu sessiyadagi natija saqlanmaydi.</p>
            <button className="rs-btn" onClick={() => setQuit(false)}>
              Davom etaman
            </button>
            <button className="rs-link" onClick={onClose}>
              Chiqish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PRAISE = ["Zo'r! 🎉", "To'g'ri! ✨", "Ajoyib! 💪", "Barakalla! 👏", "Aynan shunday! ✅", "Super! 🚀"];
const pick = (a: string[], i: number) => a[i % a.length];

/* ============================== Mashqlar ============================== */

function Prompt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rs-prompt">
      <span className="rs-label">{label}</span>
      {children}
    </div>
  );
}

function SpeakIcon({ text, big }: { text: string; big?: boolean }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(canSpeak()), []);
  if (!ok) return null;
  return (
    <button type="button" className={"rs-speak" + (big ? " big" : "")} aria-label="Tinglash" onClick={() => speak(text)}>
      🔊
    </button>
  );
}

function Intro({ w, onNext }: { w: RuWord; onNext: () => void }) {
  useEffect(() => {
    if (autoplay()) speak(w.ru);
  }, [w]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && onNext();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNext]);
  return (
    <>
      <Prompt label="✨ Yangi so'z">
        <div className="rs-card intro">
          <div className="rs-word">
            {w.ru}
            <SpeakIcon text={w.ru} big />
          </div>
          {w.gender && <span className="rs-gender">{GENDER_LABEL[w.gender]}</span>}
          <div className="rs-tr">{w.uz}</div>
          {w.example && <div className="rs-ex">{w.example}</div>}
        </div>
      </Prompt>
      <div className="rs-foot">
        <button className="rs-btn" onClick={onNext}>
          Tushundim
        </button>
      </div>
    </>
  );
}

function Options({ options, correct, verdict, onPick, ru }: { options: string[]; correct: string; verdict: Verdict | null; onPick: (o: string) => void; ru?: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (verdict) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        setPicked(options[n - 1]);
        onPick(options[n - 1]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [options, onPick, verdict]);
  return (
    <div className="rs-opts">
      {options.map((o, i) => {
        const state = verdict ? (o === correct ? "ok" : o === picked ? "bad" : "dim") : "";
        return (
          <button
            key={o + i}
            className={"rs-opt " + state + (ru ? " ru" : "")}
            disabled={!!verdict}
            onClick={() => {
              setPicked(o);
              onPick(o);
            }}
          >
            <kbd>{i + 1}</kbd>
            <span>{o}</span>
          </button>
        );
      })}
    </div>
  );
}

function Choice({ step, pool, verdict, onAnswer }: { step: Extract<Step, { k: "choice" }>; pool: RuWord[]; verdict: Verdict | null; onAnswer: OnWord }) {
  const { w, dir } = step;
  const field = dir === "ru2uz" ? "uz" : "ru";
  const correct = w[field];
  const options = useMemo(() => shuffle([correct, ...distractors(w, pool, field)]), [w, pool, field, correct]);
  useEffect(() => {
    if (dir === "ru2uz" && autoplay()) speak(w.ru);
  }, [w, dir]);
  return (
    <>
      <Prompt label={dir === "ru2uz" ? "Tarjimasini tanlang" : "Ruschasini tanlang"}>
        <div className="rs-card">
          <div className={"rs-word" + (dir === "uz2ru" ? " uz" : "")}>
            {dir === "ru2uz" ? w.ru : w.uz}
            {dir === "ru2uz" && <SpeakIcon text={w.ru} />}
          </div>
        </div>
      </Prompt>
      <Options options={options} correct={correct} verdict={verdict} ru={field === "ru"} onPick={(o) => onAnswer(o === correct, w, correct)} />
    </>
  );
}

function Listen({ w, pool, verdict, onAnswer }: { w: RuWord; pool: RuWord[]; verdict: Verdict | null; onAnswer: OnWord }) {
  const options = useMemo(() => shuffle([w.uz, ...distractors(w, pool, "uz")]), [w, pool]);
  useEffect(() => {
    const t = setTimeout(() => speak(w.ru), 250);
    return () => clearTimeout(t);
  }, [w]);
  return (
    <>
      <Prompt label="🎧 Eshiting va ma'nosini tanlang">
        <div className="rs-listen">
          <button className="rs-play" onClick={() => speak(w.ru)} aria-label="Yana eshitish">
            🔊
          </button>
          <button className="rs-play slow" onClick={() => speak(w.ru, 0.55)} aria-label="Sekin eshitish">
            🐢
          </button>
        </div>
        {verdict && <div className="rs-word" style={{ textAlign: "center" }}>{w.ru}</div>}
      </Prompt>
      <Options options={options} correct={w.uz} verdict={verdict} onPick={(o) => onAnswer(o === w.uz, w, `${w.ru} — ${w.uz}`)} />
    </>
  );
}

const CYR = "абвгдежзиклмнопрстуфхцчшыэюя";

function Tiles({ w, verdict, onAnswer }: { w: RuWord; verdict: Verdict | null; onAnswer: OnWord }) {
  const target = ruMain(w);
  const tiles = useMemo(() => {
    const letters = [...target.toLowerCase()];
    const extra = shuffle([...CYR].filter((c) => !letters.includes(c))).slice(0, letters.length > 7 ? 2 : 3);
    return shuffle([...letters, ...extra]).map((c, i) => ({ c, i }));
  }, [target]);
  const [built, setBuilt] = useState<number[]>([]);
  const word = built.map((i) => tiles[i].c).join("");
  const check = () => onAnswer(norm2(word) === norm2(target), w, target);
  useEffect(() => {
    if (verdict) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") setBuilt((b) => b.slice(0, -1));
      else if (e.key === "Enter" && built.length) check();
      else {
        const t = tiles.find((t) => t.c === e.key.toLowerCase() && !built.includes(t.i));
        if (t) setBuilt((b) => [...b, t.i]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  return (
    <>
      <Prompt label="🧩 Harflardan ruscha so'zni yig'ing">
        <div className="rs-card">
          <div className="rs-word uz">{w.uz}</div>
        </div>
        <div className={"rs-slot" + (verdict ? (verdict.ok ? " ok" : " bad") : "")} aria-live="polite">
          {built.length ? (
            built.map((i, k) => (
              <button key={k} className="rs-tile on" disabled={!!verdict} onClick={() => setBuilt((b) => b.filter((x) => x !== i))}>
                {tiles[i].c}
              </button>
            ))
          ) : (
            <span className="rs-ph">Harflarni bosing…</span>
          )}
        </div>
      </Prompt>
      <div className="rs-tiles">
        {tiles.map((t) => (
          <button key={t.i} className="rs-tile" disabled={!!verdict || built.includes(t.i)} onClick={() => setBuilt((b) => [...b, t.i])}>
            {t.c}
          </button>
        ))}
      </div>
      {!verdict && (
        <div className="rs-foot">
          <button className="rs-btn" disabled={!built.length} onClick={check}>
            Tekshirish
          </button>
        </div>
      )}
    </>
  );
}
const norm2 = (s: string) => s.toLowerCase().replace(/ё/g, "е").normalize("NFD").replace(/[̀-ͯ]/g, "");

function TypeIn({ w, verdict, onAnswer }: { w: RuWord; verdict: Verdict | null; onAnswer: OnWord }) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    if (autoplay()) speak(w.ru);
  }, [w]);
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (verdict || !v.trim()) return;
    if (isUzCorrect(v, w.uz) || isCorrect(v, w.uz)) onAnswer(true, w, w.uz);
    else if (w.uz.split(/[,;/]/).some((a) => almost(v, a.trim()))) onAnswer(true, w, w.uz, true);
    else onAnswer(false, w, w.uz);
  };
  return (
    <form onSubmit={submit} style={{ display: "contents" }}>
      <Prompt label="✍️ O'zbekchaga tarjima qiling">
        <div className="rs-card">
          <div className="rs-word">
            {w.ru}
            <SpeakIcon text={w.ru} />
          </div>
        </div>
        <input
          ref={ref}
          className={"rs-input" + (verdict ? (verdict.ok ? " ok" : " bad") : "")}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Javobingiz…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          disabled={!!verdict}
          aria-label="Javob"
        />
      </Prompt>
      {!verdict && (
        <div className="rs-foot">
          <button type="button" className="rs-link" onClick={() => onAnswer(false, w, w.uz)}>
            Bilmayman
          </button>
          <button className="rs-btn" disabled={!v.trim()}>
            Tekshirish
          </button>
        </div>
      )}
    </form>
  );
}

function Match({ ws, onDone }: { ws: RuWord[]; onDone: (mistakes: number) => void }) {
  const left = useMemo(() => shuffle(ws.map((w) => ({ id: w.id, t: w.ru }))), [ws]);
  const right = useMemo(() => shuffle(ws.map((w) => ({ id: w.id, t: w.uz }))), [ws]);
  const [sel, setSel] = useState<{ side: "l" | "r"; id: number } | null>(null);
  const [gone, setGone] = useState<{ l: number[]; r: number[] }>({ l: [], r: [] });
  const [bad, setBad] = useState<string | null>(null);
  const [mist, setMist] = useState(0);
  // Tarjimasi bir xil so'zlar (мама / мать — ona) istalgan "ona" bilan juftlanadi
  const uzOf = (id: number) => normUz(ws.find((w) => w.id === id)!.uz);
  const tap = (side: "l" | "r", id: number) => {
    if (gone[side].includes(id)) return;
    if (side === "l") speak(ws.find((w) => w.id === id)!.ru, 1);
    if (!sel || sel.side === side) return setSel({ side, id });
    const l = side === "l" ? id : sel.id;
    const r = side === "r" ? id : sel.id;
    if (uzOf(l) === uzOf(r)) {
      const g = { l: [...gone.l, l], r: [...gone.r, r] };
      setGone(g);
      setSel(null);
      beep("ok");
      if (g.l.length === ws.length) setTimeout(() => onDone(mist), 450);
    } else {
      setBad(side + id);
      setMist((m) => m + 1);
      beep("bad");
      setTimeout(() => setBad(null), 400);
      setSel(null);
    }
  };
  const btn = (side: "l" | "r", x: { id: number; t: string }) => (
    <button
      key={side + x.id}
      className={"rs-m" + (side === "l" ? " ru" : "") + (gone[side].includes(x.id) ? " gone" : "") + (sel?.side === side && sel.id === x.id ? " sel" : "") + (bad === side + x.id ? " bad" : "")}
      onClick={() => tap(side, x.id)}
      disabled={gone[side].includes(x.id)}
    >
      {x.t}
    </button>
  );
  return (
    <Prompt label="🔗 Juftlarini toping">
      <div className="rs-match">
        <div>{left.map((x) => btn("l", x))}</div>
        <div>{right.map((x) => btn("r", x))}</div>
      </div>
    </Prompt>
  );
}

/* ============================== Grammatika mashqi ============================== */

const isCyr = (s: string) => /[а-яё]/i.test(s);
const KB = ["йцукенгшщзх", "фывапролджэ", "ячсмитьбюъё"];

/** Ekrandagi rus klaviaturasi — telefonda rus tili o'rnatilmagan bo'lsa ham yozish mumkin */
function RuKeyboard({ onKey, punct }: { onKey: (k: string) => void; punct?: boolean }) {
  return (
    <div className="rs-kb" aria-label="Rus klaviaturasi">
      {KB.map((row) => (
        <div key={row}>
          {[...row].map((c) => (
            <button key={c} type="button" onClick={() => onKey(c)}>
              {c}
            </button>
          ))}
        </div>
      ))}
      <div>
        {punct &&
          [".", ",", "?"].map((c) => (
            <button key={c} type="button" onClick={() => onKey(c)}>
              {c}
            </button>
          ))}
        <button type="button" className="wide" onClick={() => onKey(" ")}>
          probel
        </button>
        <button type="button" className="wide" onClick={() => onKey("⌫")} aria-label="O'chirish">
          ⌫
        </button>
      </div>
    </div>
  );
}

type GAnswer = (ok: boolean, shown: string, line?: string, note?: string) => void;

/** Matnni gaplarga bo'lish (tinglash uchun) */
const sentences = (t: string) => t.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

function ReplayBar({ text }: { text: string }) {
  return (
    <div className="rs-replay">
      <button type="button" onClick={() => speak(text, 0.85)}>
        🔊 Matnni qayta eshitish
      </button>
      <button type="button" onClick={() => speak(text, 0.6)} aria-label="Sekin">
        🐢
      </button>
    </div>
  );
}

function GItem({ it, verdict, listen, onAnswer }: { it: RuItem; verdict: Verdict | null; listen?: string; onAnswer: GAnswer }) {
  if (it.type === "choice") {
    const correct = it.options[it.answer];
    return (
      <>
        <Prompt label={listen ? "🎧 Eshitganingiz bo'yicha javob bering" : "📘 To'g'ri variantni tanlang"}>
          {listen && <ReplayBar text={listen} />}
          <div className="rs-card">
            <div className="rs-q">{it.q}</div>
          </div>
        </Prompt>
        <Options options={it.options} correct={correct} verdict={verdict} ru={isCyr(correct)} onPick={(o) => onAnswer(o === correct, correct)} />
      </>
    );
  }
  if (it.type === "order") return <OrderItem it={it} verdict={verdict} onAnswer={onAnswer} />;
  if (it.type === "free") return <FreeItem it={it} verdict={verdict} onAnswer={onAnswer} />;
  return <TextItem it={it} verdict={verdict} listen={listen} onAnswer={onAnswer} />;
}

function TextItem({ it, verdict, listen, onAnswer }: { it: Extract<RuItem, { type: "fill" | "translate" | "dictation" }>; verdict: Verdict | null; listen?: string; onAnswer: GAnswer }) {
  const [v, setV] = useState("");
  const cyr = isCyr(it.answer);
  const dict = it.type === "dictation";
  useEffect(() => {
    if (dict) {
      const t = setTimeout(() => speak(it.say, 0.8), 300);
      return () => clearTimeout(t);
    }
  }, [dict, it]);
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (verdict || !v.trim()) return;
    const ok = isCorrect(v, it.answer, it.accept);
    const near = !ok && almost(v, it.answer);
    onAnswer(ok, it.answer, undefined, near ? "Deyarli to'g'ri — bitta harfni tekshiring" : undefined);
  };
  const label = dict ? "🎧 Eshiting va yozing (diktant)" : it.type === "fill" ? "✍️ Bo'sh joyni to'ldiring" : "🔁 Ruschaga tarjima qiling";
  return (
    <form onSubmit={submit} style={{ display: "contents" }}>
      <Prompt label={label}>
        {listen && !dict && <ReplayBar text={listen} />}
        {dict ? (
          <div className="rs-listen">
            <button type="button" className="rs-play" onClick={() => speak(it.say, 0.8)} aria-label="Eshitish">
              🔊
            </button>
            <button type="button" className="rs-play slow" onClick={() => speak(it.say, 0.5)} aria-label="Sekin eshitish">
              🐢
            </button>
          </div>
        ) : (
          <div className="rs-card">
            <div className="rs-q">{it.q}</div>
            {it.type === "fill" && it.hint && <span className="rs-gender">💡 {it.hint}</span>}
          </div>
        )}
        <input
          className={"rs-input" + (verdict ? (verdict.ok ? " ok" : " bad") : "")}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={cyr ? "Ruscha yozing…" : "Javobingiz…"}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          lang={cyr ? "ru" : undefined}
          inputMode={cyr ? "none" : undefined}
          disabled={!!verdict}
          aria-label="Javob"
        />
      </Prompt>
      {cyr && !verdict && <RuKeyboard onKey={(k) => setV((x) => (k === "⌫" ? x.slice(0, -1) : x + k))} />}
      {!verdict && (
        <div className="rs-foot">
          <button type="button" className="rs-link" onClick={() => onAnswer(false, it.answer)}>
            Bilmayman
          </button>
          <button className="rs-btn" disabled={!v.trim()}>
            Tekshirish
          </button>
        </div>
      )}
    </form>
  );
}

/** So'zlardan gap tuzish */
function OrderItem({ it, verdict, onAnswer }: { it: Extract<RuItem, { type: "order" }>; verdict: Verdict | null; onAnswer: GAnswer }) {
  const tiles = useMemo(() => {
    let t = shuffle(it.words.map((w, i) => ({ w, i })));
    // Tasodifan to'g'ri tartib chiqsa — yana aralashtiramiz
    for (let k = 0; k < 5 && it.words.length > 1 && t.every((x, j) => x.i === j); k++) t = shuffle(t);
    return t;
  }, [it]);
  const [built, setBuilt] = useState<number[]>([]);
  const answer = it.words.join(" ");
  const check = () => onAnswer(norm(built.map((i) => tiles[i].w).join(" ")) === norm(answer), answer, answer);
  return (
    <>
      <Prompt label="🧩 So'zlardan gap tuzing">
        <div className="rs-card">
          <div className="rs-q">{it.q}</div>
        </div>
        <div className={"rs-slot" + (verdict ? (verdict.ok ? " ok" : " bad") : "")} aria-live="polite">
          {built.length ? (
            built.map((i, k) => (
              <button key={k} className="rs-tile word on" disabled={!!verdict} onClick={() => setBuilt((b) => b.filter((x) => x !== i))}>
                {tiles[i].w}
              </button>
            ))
          ) : (
            <span className="rs-ph">So&apos;zlarni tartib bilan bosing…</span>
          )}
        </div>
      </Prompt>
      <div className="rs-tiles">
        {tiles.map((t, i) => (
          <button key={i} className="rs-tile word" disabled={!!verdict || built.includes(i)} onClick={() => setBuilt((b) => [...b, i])}>
            {t.w}
          </button>
        ))}
      </div>
      {!verdict && (
        <div className="rs-foot">
          <button className="rs-btn" disabled={built.length !== tiles.length} onClick={check}>
            Tekshirish
          </button>
        </div>
      )}
    </>
  );
}

/** Erkin yozish: kerakli so'zlar ishlatilganini tekshiradi, namunani ko'rsatadi */
function FreeItem({ it, verdict, onAnswer }: { it: Extract<RuItem, { type: "free" }>; verdict: Verdict | null; onAnswer: GAnswer }) {
  const [v, setV] = useState("");
  const check = () => {
    const text = " " + norm(v) + " ";
    const missing = (it.must ?? []).filter((m) => !m.split("|").some((alt) => text.includes(" " + norm(alt) + " ")));
    const enough = norm(v).split(" ").filter(Boolean).length >= 4;
    const ok = !missing.length && enough;
    const note = ok
      ? "Barakalla! Namuna bilan solishtirib ko'ring."
      : !enough
        ? "Juda qisqa — kamida 2–3 ta gap yozing."
        : "Yetishmayapti: " + missing.map((m) => m.split("|")[0]).join(", ");
    onAnswer(ok, "Namuna: " + it.sample, "Namuna: " + it.sample, note);
  };
  return (
    <>
      <Prompt label="📝 O'zingiz yozing">
        <div className="rs-card">
          <div className="rs-q">{it.q}</div>
          {it.hint && <span className="rs-gender">💡 {it.hint}</span>}
        </div>
        <textarea
          className={"rs-input rs-area" + (verdict ? (verdict.ok ? " ok" : " bad") : "")}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Ruscha yozing…"
          lang="ru"
          inputMode="none"
          spellCheck={false}
          disabled={!!verdict}
          aria-label="Matningiz"
          rows={3}
        />
      </Prompt>
      {!verdict && <RuKeyboard onKey={(k) => setV((x) => (k === "⌫" ? x.slice(0, -1) : x + k))} punct />}
      {!verdict && (
        <div className="rs-foot">
          <button type="button" className="rs-link" onClick={() => onAnswer(false, "Namuna: " + it.sample)}>
            Namunani ko&apos;rish
          </button>
          <button className="rs-btn" disabled={!v.trim()} onClick={check}>
            Tekshirish
          </button>
        </div>
      )}
    </>
  );
}

/** O'qish / tinglash matni: so'zni bosib tarjima, ovoz, o'zbekcha tarjima */
function PassageView({ p, pool, onNext }: { p: Passage; pool: RuWord[]; onNext: () => void }) {
  const listening = p.kind === "listening";
  const [show, setShow] = useState(!listening || !canSpeak()); // ovoz bo'lmasa — matn darhol ko'rinadi
  const [uz, setUz] = useState(false);
  const [tip, setTip] = useState<{ w: string; t: string | null } | null>(null);
  const [heard, setHeard] = useState(0);
  const sents = useMemo(() => sentences(p.text), [p.text]);
  const dict = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of pool) for (const v of variants(w.ru)) m.set(v.toLowerCase().replace(/ё/g, "е"), w.uz);
    for (const [k, v] of Object.entries(p.gloss ?? {})) m.set(k.toLowerCase().replace(/ё/g, "е"), v);
    return m;
  }, [pool, p.gloss]);
  const lookup = (raw: string) => {
    const w = raw.toLowerCase().replace(/ё/g, "е");
    if (dict.has(w)) return dict.get(w)!;
    // Qo'shimchasiz o'zak bo'yicha (книгу → книга)
    for (let cut = 1; cut <= 3 && w.length - cut >= 3; cut++) {
      const stem = w.slice(0, -cut);
      for (const [k, v] of dict) if (!k.includes(" ") && k.startsWith(stem) && k.length - stem.length <= 3) return v;
    }
    return null;
  };
  const play = (t: string, rate = 0.85) => {
    speak(t, rate);
    setHeard((h) => h + 1);
  };
  return (
    <>
      <Prompt label={listening ? "🎧 Tinglang" : "📖 Matnni o'qing"}>
        {listening && (
          <>
            <div className="rs-listen">
              <button className="rs-play" onClick={() => play(p.text)} aria-label="Butun matnni eshitish">
                🔊
              </button>
              <button className="rs-play slow" onClick={() => play(p.text, 0.6)} aria-label="Sekin eshitish">
                🐢
              </button>
            </div>
            <p className="rs-note">Matn ko&apos;rinmaydi — 2–3 marta tinglang. Har bir gapni alohida ham eshitishingiz mumkin:</p>
            <div className="rs-sents">
              {sents.map((x, i) => (
                <button key={i} onClick={() => play(x, 0.8)}>
                  {i + 1}-gap 🔊
                </button>
              ))}
            </div>
          </>
        )}
        {show && (
          <div className="rs-card rs-passage" lang="ru">
            {sents.map((x, i) => (
              <p key={i}>
                {x.split(/(\s+)/).map((tok, j) => {
                  const clean = tok.replace(/^[«"(—–-]+|[»".,!?:;)…]+$/g, "");
                  if (!clean.trim() || !/[а-яё]/i.test(clean)) return <span key={j}>{tok}</span>;
                  return (
                    <span key={j} className={"rs-w" + (tip?.w === clean ? " on" : "")} role="button" tabIndex={0} onClick={() => setTip({ w: clean, t: lookup(clean) })}>
                      {tok}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        )}
        {show && tip && (
          <div className="rs-tip" role="status">
            <b lang="ru">{tip.w}</b> — {tip.t ?? "lug'atda yo'q"}
            <button type="button" onClick={() => speak(tip.w, 0.8)} aria-label="Tinglash">
              🔊
            </button>
          </div>
        )}
        {show && !listening && <p className="rs-note">💡 Tushunmagan so&apos;zni bosing — tarjimasi chiqadi.</p>}
        <div className="rs-tools">
          {!listening && (
            <button type="button" onClick={() => play(p.text)}>
              🔊 Tinglash
            </button>
          )}
          {listening && (
            <button type="button" onClick={() => setShow((x) => !x)}>
              {show ? "🙈 Matnni yashirish" : "📄 Matnni ko'rish"}
            </button>
          )}
          {p.uz && (
            <button type="button" onClick={() => setUz((x) => !x)}>
              🇺🇿 {uz ? "Tarjimani yashirish" : "Tarjima"}
            </button>
          )}
        </div>
        {uz && p.uz && <div className="rs-uz">{p.uz}</div>}
      </Prompt>
      <div className="rs-foot">
        <button className="rs-btn" onClick={onNext} disabled={listening && heard === 0 && canSpeak()}>
          Savollarga o&apos;tish
        </button>
      </div>
    </>
  );
}

/* ============================== Natija ============================== */

function Finish({ r, title, kind, skill, goal, xpBefore, onClose }: { r: SessionResult; title: string; kind: SessionKind; skill?: RuSkill; goal: number; xpBefore: number; onClose: () => void }) {
  const acc = r.total ? Math.round((r.correct / r.total) * 100) : 100;
  const after = xpBefore + r.xp;
  const hitGoal = xpBefore < goal && after >= goal;
  const mm = `${Math.floor(r.secs / 60)}:${String(r.secs % 60).padStart(2, "0")}`;
  const head = acc === 100 ? "Mukammal! 🏆" : acc >= 80 ? "Zo'r natija! 🎉" : acc >= 50 ? "Yaxshi, davom etamiz! 💪" : "Mashq — mahorat onasi 🌱";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="rs fin" role="dialog" aria-modal="true" aria-label="Natija">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <div className="rs-fin">
        <div className="rs-trophy">{kind === "learn" ? "🎓" : kind === "review" ? "🧠" : kind === "grammar" ? SKILL[skill ?? "grammar"].icon : "⚡"}</div>
        <h2>{head}</h2>
        <p>
          {title}
          {r.learned ? ` · ${r.learned} ta yangi so'z` : ""}
        </p>
        <div className="rs-stats">
          <div className="xp">
            <small>XP</small>
            <b>+{r.xp}</b>
          </div>
          <div className="acc">
            <small>Aniqlik</small>
            <b>{acc}%</b>
          </div>
          <div className="cmb">
            <small>Combo</small>
            <b>🔥{r.combo}</b>
          </div>
          <div className="tm">
            <small>Vaqt</small>
            <b>{mm}</b>
          </div>
        </div>
        <div className="rs-goal">
          <div>
            <span>Kunlik maqsad</span>
            <b className="num">
              {Math.min(after, goal)}/{goal} XP
            </b>
          </div>
          <div className="rs-prog big">
            <b style={{ width: Math.min(100, (after / goal) * 100) + "%" }} />
          </div>
          {hitGoal && <span className="rs-bonus">🎯 Bugungi maqsad bajarildi!</span>}
        </div>
      </div>
      <div className="rs-foot">
        <button className="rs-btn" onClick={onClose} autoFocus>
          Davom etish
        </button>
      </div>
    </div>
  );
}
