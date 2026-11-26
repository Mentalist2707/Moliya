"use client";

/**
 * Rus tili sessiyasi: qisqa (2–3 daqiqa), ketma-ket mashqlar, darhol javob,
 * XP, combo va oxirida natija ekrani. Xato topilgan mashq sessiya oxirida yana chiqadi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pushBack } from "@/lib/back";
import { almost, GENDER_LABEL, isCorrect, isUzCorrect, shuffle, variants, type RuWord } from "@/lib/ru";
import { autoplay, canSpeak, post, speak } from "./ruCtx";
import { useStore } from "./ui";

export type SessionKind = "learn" | "review" | "practice";
export type SessionResult = { xp: number; correct: number; total: number; combo: number; secs: number; learned: number };

type Step =
  | { k: "intro"; w: RuWord }
  | { k: "choice"; w: RuWord; dir: "ru2uz" | "uz2ru" }
  | { k: "listen"; w: RuWord }
  | { k: "tiles"; w: RuWord }
  | { k: "type"; w: RuWord }
  | { k: "match"; ws: RuWord[] };

type Verdict = { ok: boolean; near?: boolean; answer: string; w: RuWord };

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
  const cand = shuffle(pool.filter((x) => x.id !== w.id && x[field].toLowerCase() !== own));
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
    // Juft-juft tanishuv: so'z → darhol tanib olish; keyin aralash mustahkamlash; oxirida juftlash
    const steps: Step[] = [];
    for (let i = 0; i < words.length; i += 2) {
      const pair = words.slice(i, i + 2);
      pair.forEach((w) => steps.push({ k: "intro", w }));
      pair.forEach((w) => steps.push({ k: "choice", w, dir: "ru2uz" }));
    }
    const mid: Step[] = words.map((w, i) => (speakOk && i % 2 ? { k: "listen", w } : { k: "choice", w, dir: "uz2ru" }));
    const late: Step[] = words.map((w, i) => (tileable(w) && i % 2 === 0 ? { k: "tiles", w } : { k: "type", w }));
    steps.push(...shuffle(mid));
    if (words.length >= 3) steps.push({ k: "match", ws: words });
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
  pool,
  onClose,
  onSaved,
  goal,
  xpToday,
}: {
  kind: SessionKind;
  title: string;
  words: RuWord[];
  pool: RuWord[];
  onClose: () => void;
  onSaved: () => void;
  goal: number;
  xpToday: number;
}) {
  const { haptic, toast } = useStore();
  const [queue, setQueue] = useState<Step[]>(() => plan(kind, words));
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
  const progress = Math.min(100, (queue.slice(0, pos).filter((s) => s.k !== "intro").length / Math.max(1, queue.filter((s) => s.k !== "intro").length)) * 100);

  const answer = useCallback(
    (ok: boolean, w: RuWord, shown: string, near = false) => {
      setVerdict({ ok, near, answer: shown, w });
      setStats((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }));
      if (ok) {
        const c = combo + 1;
        setCombo(c);
        setBest((b) => Math.max(b, c));
        const add = 10 + (c >= 3 ? 5 : 0);
        setXp((x) => x + add);
        setBonus(c >= 3 && c % 5 === 0 ? `🔥 ${c} ta ketma-ket!` : null);
        if (near) nearMiss.current.add(w.id);
        beep("ok");
        haptic("success");
        if (autoplay()) speak(w.ru);
      } else {
        setCombo(0);
        setBonus(null);
        missed.current.add(w.id);
        beep("bad");
        haptic();
        // Shu mashqni sessiya oxiriga yana qo'yamiz (bir marta)
        const st = queue[pos];
        const key = st && "w" in st ? `${st.k}:${st.w.id}` : "";
        if (key && !retried.current.has(key)) {
          retried.current.add(key);
          setQueue((q) => [...q, q[pos]]);
        }
      }
    },
    [combo, haptic, pos, queue]
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
      await post({
        action: "session.finish",
        grades,
        learned: kind === "learn" ? words.map((w) => w.id) : [],
        xp: total,
        total: Math.max(stats.total, grades.length),
        correct: stats.correct,
      });
      onSaved();
    } catch (e) {
      toast("Natija saqlanmadi: " + (e as Error).message);
    }
  }, [best, haptic, kind, onSaved, stats, toast, words, xp]);

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

  if (result) return <Finish r={result} title={title} kind={kind} goal={goal} xpBefore={xpToday} onClose={onClose} />;

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
        {step?.k === "choice" && <Choice step={step} pool={pool} verdict={verdict} onAnswer={answer} />}
        {step?.k === "listen" && <Listen w={step.w} pool={pool} verdict={verdict} onAnswer={answer} />}
        {step?.k === "tiles" && <Tiles w={step.w} verdict={verdict} onAnswer={answer} />}
        {step?.k === "type" && <TypeIn w={step.w} verdict={verdict} onAnswer={answer} />}
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
            {verdict.ok && !verdict.near && (
              <span>
                {verdict.w.ru} — {verdict.w.uz}
              </span>
            )}
            {verdict.w.example && <small>{verdict.w.example}</small>}
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

function Choice({ step, pool, verdict, onAnswer }: { step: Extract<Step, { k: "choice" }>; pool: RuWord[]; verdict: Verdict | null; onAnswer: (ok: boolean, w: RuWord, shown: string) => void }) {
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

function Listen({ w, pool, verdict, onAnswer }: { w: RuWord; pool: RuWord[]; verdict: Verdict | null; onAnswer: (ok: boolean, w: RuWord, shown: string) => void }) {
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

function Tiles({ w, verdict, onAnswer }: { w: RuWord; verdict: Verdict | null; onAnswer: (ok: boolean, w: RuWord, shown: string) => void }) {
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

function TypeIn({ w, verdict, onAnswer }: { w: RuWord; verdict: Verdict | null; onAnswer: (ok: boolean, w: RuWord, shown: string, near?: boolean) => void }) {
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
  const [gone, setGone] = useState<number[]>([]);
  const [bad, setBad] = useState<string | null>(null);
  const [mist, setMist] = useState(0);
  const tap = (side: "l" | "r", id: number) => {
    if (gone.includes(id)) return;
    if (side === "l") speak(ws.find((w) => w.id === id)!.ru, 1);
    if (!sel || sel.side === side) return setSel({ side, id });
    if (sel.id === id) {
      const g = [...gone, id];
      setGone(g);
      setSel(null);
      beep("ok");
      if (g.length === ws.length) setTimeout(() => onDone(mist), 450);
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
      className={"rs-m" + (side === "l" ? " ru" : "") + (gone.includes(x.id) ? " gone" : "") + (sel?.side === side && sel.id === x.id ? " sel" : "") + (bad === side + x.id ? " bad" : "")}
      onClick={() => tap(side, x.id)}
      disabled={gone.includes(x.id)}
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

/* ============================== Natija ============================== */

function Finish({ r, title, kind, goal, xpBefore, onClose }: { r: SessionResult; title: string; kind: SessionKind; goal: number; xpBefore: number; onClose: () => void }) {
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
        <div className="rs-trophy">{kind === "learn" ? "🎓" : kind === "review" ? "🧠" : "⚡"}</div>
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
