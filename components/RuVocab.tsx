"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { todayStr } from "@/lib/format";
import { almost, GENDER_LABEL, isCorrect, isDueReview, ivlLabel, schedule, shuffle, variants, wordState, type RuWord } from "@/lib/ru";
import { Bar, Empty, Seg, Sheet, useStore } from "./ui";
import { autoplay, canSpeak, post, speak, useRu } from "./ruCtx";

/* ============================== Kichik yordamchilar ============================== */
export function SpeakBtn({ text, big }: { text: string; big?: boolean }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(canSpeak()), []);
  if (!ok) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      className={"ru-speak" + (big ? " big" : "")}
      aria-label="Tinglash"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          speak(text);
        }
      }}
    >
      🔊
    </span>
  );
}

/** Yod / o'rganilmoqda / yangi — bitta chiziqda */
export function StackBar({ words }: { words: Pick<RuWord, "reps" | "ivl">[] }) {
  const n = words.length || 1;
  const known = words.filter((w) => wordState(w) === "known").length;
  const learning = words.filter((w) => wordState(w) === "learning").length;
  return (
    <div className="ru-stack" role="img" aria-label={`${known} yod, ${learning} o'rganilmoqda, ${words.length - known - learning} yangi`}>
      <b style={{ width: (known / n) * 100 + "%", background: "var(--money)" }} />
      <b style={{ width: (learning / n) * 100 + "%", background: "var(--warn)" }} />
    </div>
  );
}

export function useDayCounts() {
  const { r, me } = useRu();
  const today = todayStr();
  const limit = me?.ru_daily_new ?? 15;
  const learnedToday = r.words.filter((w) => w.learned_at?.slice(0, 10) === today).length;
  const newTotal = r.words.filter((w) => w.reps === 0).length;
  const due = r.words.filter((w) => isDueReview(w, today)).length;
  return { today, limit, learnedToday, newLeft: Math.max(0, Math.min(newTotal, limit - learnedToday)), newTotal, due };
}

/* ============================== Bitta topshiriq ============================== */
type Kind = "card" | "choice" | "type";
type Task = { w: RuWord; kind: Kind; rev: boolean; key: number };

function distractors(w: RuWord, all: RuWord[], field: "ru" | "uz", n = 3): string[] {
  const right = w[field].toLowerCase();
  const same = shuffle(all.filter((x) => x.id !== w.id && x.lesson_id === w.lesson_id && x[field].toLowerCase() !== right));
  const other = shuffle(all.filter((x) => x.id !== w.id && x.lesson_id !== w.lesson_id && x[field].toLowerCase() !== right));
  const out: string[] = [];
  for (const x of [...same, ...other]) {
    if (!out.some((o) => o.toLowerCase() === x[field].toLowerCase())) out.push(x[field]);
    if (out.length >= n) break;
  }
  return out;
}

/**
 * grade: 0 — bilmadi, 1 — qiynaldi, 2 — bildi, 3 — oson.
 * Kartochkada foydalanuvchi o'zi baholaydi; tanlash va yozishda — avtomatik.
 */
function TaskView({ t, all, onDone }: { t: Task; all: RuWord[]; onDone: (grade: 0 | 1 | 2 | 3) => void }) {
  const w = t.w;
  const { haptic } = useStore();
  const [shown, setShown] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [val, setVal] = useState("");
  const [hint, setHint] = useState(0);
  const [res, setRes] = useState<null | "ok" | "almost" | "bad">(null);
  const inp = useRef<HTMLInputElement>(null);
  const answers = variants(w.ru);
  // Tarjimasi bir xil so'zlar (masalan, дело va работа — «ish») ham to'g'ri hisoblanadi
  const synonyms = useMemo(() => all.filter((x) => x.id !== w.id && x.uz.trim().toLowerCase() === w.uz.trim().toLowerCase()).flatMap((x) => variants(x.ru)), [all, w]);
  const options = useMemo(() => {
    if (t.kind !== "choice") return [];
    const field = t.rev ? "ru" : "uz";
    return shuffle([w[field], ...distractors(w, all, field)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.key]);

  useEffect(() => {
    // So'z ko'rsatilganda ruschasini o'qib berish
    if (!autoplay()) return;
    if ((t.kind === "card" && !t.rev) || (t.kind === "choice" && !t.rev)) speak(w.ru);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.key]);

  // Klaviatura: probel — ochish, 1–4 — baho, Enter — davom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (t.kind === "card") {
        if (!shown && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          reveal();
        } else if (shown && ["1", "2", "3", "4"].includes(e.key)) onDone((Number(e.key) - 1) as 0 | 1 | 2 | 3);
      } else if (t.kind === "choice" && picked === null && ["1", "2", "3", "4"].includes(e.key)) pick(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const reveal = () => {
    setShown(true);
    if (t.rev && autoplay()) speak(w.ru);
  };
  const pick = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = options[k] === (t.rev ? w.ru : w.uz);
    haptic(ok ? "success" : "light");
    if (t.rev && autoplay()) speak(w.ru);
    if (ok) setTimeout(() => onDone(2), 650);
  };
  const check = () => {
    if (!val.trim() || res) return;
    let r: "ok" | "almost" | "bad" = "bad";
    if (isCorrect(val, w.ru, [...answers, ...synonyms])) r = "ok";
    else if (answers.some((a) => almost(val, a))) r = "almost";
    setRes(r);
    haptic(r === "ok" ? "success" : "light");
    if (autoplay()) speak(w.ru);
  };
  const typeGrade = (): 0 | 1 | 2 => (res === "ok" ? (hint ? 1 : 2) : res === "almost" ? 1 : 0);

  if (t.kind === "card") {
    const next = (g: 0 | 1 | 2 | 3) => ivlLabel(schedule(w, g).ivl);
    return (
      <>
        <button className={"ru-card" + (shown ? " shown" : "")} onClick={reveal} aria-live="polite">
          <small>{t.rev ? "Ruschasini eslang" : "Tarjimasini eslang"}</small>
          <span className="ru-front" lang={t.rev ? "uz" : "ru"}>
            {t.rev ? w.uz : w.ru} {!t.rev && <SpeakBtn text={w.ru} />}
          </span>
          {!t.rev && w.gender && <span className="pill">{GENDER_LABEL[w.gender]}</span>}
          {shown ? (
            <>
              <hr />
              <span className="ru-back" lang={t.rev ? "ru" : "uz"}>
                {t.rev ? w.ru : w.uz} {t.rev && <SpeakBtn text={w.ru} />}
              </span>
              {t.rev && w.gender && <span className="pill">{GENDER_LABEL[w.gender]}</span>}
              {w.example && (
                <i lang="ru" className="ru-exline">
                  {w.example} <SpeakBtn text={w.example} />
                </i>
              )}
            </>
          ) : (
            <small style={{ marginTop: 18 }}>Bosing — javobni ko&apos;rish</small>
          )}
        </button>
        {shown ? (
          <div className="ru-grades">
            {(["Esimda yo'q", "Qiyin", "Esimda", "Oson"] as const).map((lab, g) => (
              <button key={g} onClick={() => onDone(g as 0 | 1 | 2 | 3)} className={"g" + g}>
                {lab}
                <small>{next(g as 0 | 1 | 2 | 3)}</small>
              </button>
            ))}
          </div>
        ) : (
          <button className="btn brand block" onClick={reveal}>
            Javobni ko&apos;rish
          </button>
        )}
      </>
    );
  }

  if (t.kind === "choice") {
    const right = t.rev ? w.ru : w.uz;
    return (
      <>
        <small className="ru-task">{t.rev ? "Ruschasini tanlang" : "Tarjimasini tanlang"}</small>
        <div className="ru-prompt" lang={t.rev ? "uz" : "ru"}>
          {t.rev ? w.uz : w.ru} {!t.rev && <SpeakBtn text={w.ru} />}
          {!t.rev && w.gender && <span className="pill">{GENDER_LABEL[w.gender]}</span>}
        </div>
        <div className="ru-opts">
          {options.map((op, k) => (
            <button key={k} lang={t.rev ? "ru" : "uz"} disabled={picked !== null} className={picked === null ? "" : op === right ? "ok" : k === picked ? "bad" : "dim"} onClick={() => pick(k)}>
              {op}
            </button>
          ))}
        </div>
        {picked !== null && options[picked] !== right && (
          <>
            <div className="ru-fb bad" role="status">
              <b>✗ To&apos;g&apos;ri javob: {right}</b>
              {w.example && <small lang="ru">{w.example}</small>}
            </div>
            <button className="btn brand block" onClick={() => onDone(0)} autoFocus>
              Keyingisi →
            </button>
          </>
        )}
      </>
    );
  }

  // Yozish: o'zbekchadan ruschaga
  const shownHint = answers[0].slice(0, hint);
  return (
    <>
      <small className="ru-task">Ruscha yozing</small>
      <div className="ru-prompt" lang="uz">
        {w.uz}
        {w.gender && <span className="pill">{GENDER_LABEL[w.gender]}</span>}
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!res) check();
          else onDone(typeGrade());
        }}
      >
        <input
          ref={inp}
          lang="ru"
          data-autofocus
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={"huge" + (res === "ok" ? " ok" : res ? " bad" : "")}
          value={val}
          readOnly={!!res}
          onChange={(e) => setVal(e.target.value)}
          placeholder={shownHint ? shownHint + "…" : "по-русски…"}
        />
        {!res ? (
          <div className="foot">
            <button
              type="button"
              className="btn soft"
              disabled={hint >= answers[0].length - 1}
              onClick={() => {
                setHint((h) => h + 1);
                inp.current?.focus();
              }}
            >
              💡 Harf
            </button>
            <button type="button" className="btn soft" onClick={() => setRes("bad")}>
              Bilmayman
            </button>
            <button type="submit" className="btn brand" disabled={!val.trim()}>
              Tekshirish
            </button>
          </div>
        ) : (
          <>
            <div className={"ru-fb " + (res === "ok" ? "ok" : "bad")} role="status">
              <b>{res === "ok" ? (hint ? "✓ To'g'ri (yordam bilan)" : "✓ To'g'ri!") : res === "almost" ? "Deyarli! Bitta harf xato" : "✗ Noto'g'ri"}</b>
              {res !== "ok" && (
                <span>
                  To&apos;g&apos;ri: <b lang="ru">{w.ru}</b> <SpeakBtn text={w.ru} />
                </span>
              )}
              {w.example && <small lang="ru">{w.example}</small>}
              {res !== "ok" && val.trim() && (
                <button type="button" className="link" onClick={() => onDone(2)}>
                  Men to&apos;g&apos;ri yozganman
                </button>
              )}
            </div>
            <button type="submit" className="btn brand block" autoFocus>
              Keyingisi →
            </button>
          </>
        )}
      </form>
    </>
  );
}

/* ============================== Takrorlash ============================== */
type Mode = "mix" | "card" | "choice" | "type";
const MODES: { v: Mode; t: string }[] = [
  { v: "mix", t: "Aralash" },
  { v: "card", t: "Kartochka" },
  { v: "choice", t: "Tanlash" },
  { v: "type", t: "Yozish" },
];

function kindFor(w: RuWord, mode: Mode): Kind {
  if (mode !== "mix") return mode;
  if (w.reps <= 2 || w.lapses >= 3) return Math.random() < 0.5 ? "choice" : "type";
  const x = Math.random();
  return x < 0.4 ? "type" : x < 0.7 ? "card" : "choice";
}

export function ReviewSheet({ lessonId, onClose }: { lessonId?: number; onClose: () => void }) {
  const { r, reload, open } = useRu();
  const today = todayStr();
  const [lesson, setLesson] = useState<string>(lessonId ? String(lessonId) : "all");
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem("ru_mode") as Mode) || "mix";
    } catch {
      return "mix";
    }
  });
  const pool = r.words.filter((w) => isDueReview(w, today) && (lesson === "all" || String(w.lesson_id) === lesson));
  const [queue, setQueue] = useState<Task[] | null>(null);
  const [stat, setStat] = useState({ n: 0, ok: 0, words: new Set<number>() });
  const seq = useRef(0);
  useEffect(() => () => void reload(), [reload]);

  const start = () => {
    try {
      localStorage.setItem("ru_mode", mode);
    } catch {
      /* */
    }
    setQueue(shuffle(pool).slice(0, 80).map((w) => ({ w, kind: kindFor(w, mode), rev: Math.random() < 0.5, key: ++seq.current })));
  };

  const done = (g: 0 | 1 | 2 | 3) => {
    if (!queue?.length) return;
    const [h, ...rest] = queue;
    // Faqat birinchi urinish bahosi SRS ga yoziladi; xato qilinsa — sessiya oxirigacha qayta so'raladi
    const first = !stat.words.has(h.w.id);
    if (first) post({ action: "word.grade", id: h.w.id, grade: g }).catch(() => {});
    setStat((s) => ({ n: s.n + 1, ok: s.ok + (g ? 1 : 0), words: new Set(s.words).add(h.w.id) }));
    if (g === 0) {
      const at = Math.min(rest.length, 3);
      const again: Task = { w: { ...h.w, ...schedule(h.w, 0) }, kind: h.kind === "type" ? "choice" : "type", rev: false, key: ++seq.current };
      setQueue([...rest.slice(0, at), again, ...rest.slice(at)]);
    } else setQueue(rest);
  };

  if (!queue) {
    const lessons = r.lessons.filter((l) => r.words.some((w) => w.lesson_id === l.id && w.reps > 0));
    return (
      <Sheet title="🔁 Takrorlash" onClose={onClose}>
        <div className="form">
          {lessons.length > 1 && (
            <div className="field">
              <label htmlFor="rv-l">Qaysi so&apos;zlar</label>
              <select id="rv-l" value={lesson} onChange={(e) => setLesson(e.target.value)}>
                <option value="all">Hammasi ({r.words.filter((w) => isDueReview(w, today)).length} ta)</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.topic} ({r.words.filter((w) => w.lesson_id === l.id && isDueReview(w, today)).length} ta)
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Usul</label>
            <Seg label="Usul" value={mode} onChange={setMode} options={MODES} />
            <span className="hint">
              {mode === "mix"
                ? "Yangi o'rganilganlar — tanlash va yozish, mustahkamlari — aralash. Eng samarali usul."
                : mode === "card"
                  ? "So'zni ko'rasiz, eslaysiz va o'zingizni baholaysiz."
                  : mode === "choice"
                    ? "4 ta variantdan to'g'risini tanlaysiz."
                    : "Tarjimasiga qarab ruscha yozasiz — eng kuchli yodlash usuli."}
            </span>
          </div>
          {pool.length ? (
            <button className="btn brand block" onClick={start}>
              Boshlash — {Math.min(80, pool.length)} ta so&apos;z
            </button>
          ) : (
            <>
              <Empty emoji="✅" text="Hozir takrorlanadigan so'z yo'q. Yangi so'z o'rganing yoki o'yin o'ynang." />
              <div className="foot">
                <button className="btn soft" onClick={() => open({ k: "match" })}>
                  🧩 Juftlash
                </button>
                <button className="btn brand" onClick={() => open({ k: "learn" })}>
                  🆕 Yangi so&apos;zlar
                </button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    );
  }

  const cur = queue[0];
  if (!cur) {
    return (
      <Sheet title="Takrorlash" onClose={onClose}>
        <div className="form" style={{ textAlign: "center", justifyItems: "center" }}>
          <span style={{ fontSize: 56 }}>🎉</span>
          <h3 style={{ margin: 0 }}>Barakalla! Takrorlash tugadi</h3>
          {stat.n > 0 && (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {stat.words.size} ta so&apos;z · {Math.round((stat.ok / stat.n) * 100)}% to&apos;g&apos;ri
            </p>
          )}
          <div className="foot" style={{ width: "100%" }}>
            <button className="btn soft" onClick={() => open({ k: "match" })}>
              🧩 Juftlash
            </button>
            <button className="btn brand" onClick={onClose}>
              Tayyor
            </button>
          </div>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title="🔁 Takrorlash" onClose={onClose}>
      <div className="form">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Bar pct={(stat.n / Math.max(1, stat.n + queue.length)) * 100} color="var(--brand)" />
          </div>
          <span className="num" style={{ fontSize: 13, color: "var(--muted)" }}>
            {queue.length} qoldi
          </span>
        </div>
        <TaskView key={cur.key} t={cur} all={r.words} onDone={done} />
      </div>
    </Sheet>
  );
}

/* ============================== Yangi so'zlarni yod olish ============================== */
export function LearnSheet({ lessonId, onClose }: { lessonId?: number; onClose: () => void }) {
  const { r, reload, open } = useRu();
  const { limit, learnedToday } = useDayCounts();
  const fresh = useMemo(
    () =>
      r.words
        .filter((w) => w.reps === 0 && (!lessonId || w.lesson_id === lessonId))
        .sort((a, b) => (a.lesson_id ?? 1e9) - (b.lesson_id ?? 1e9) || a.id - b.id),
    [r.words, lessonId]
  );
  const [extra, setExtra] = useState(false);
  const left = extra ? 7 : Math.max(0, limit - learnedToday);
  const [batch, setBatch] = useState<RuWord[] | null>(null);
  const [phase, setPhase] = useState<"intro" | "drill" | "done">("intro");
  const [i, setI] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [mist, setMist] = useState(0);
  const seq = useRef(0);
  useEffect(() => () => void reload(), [reload]);

  const begin = (src: RuWord[]) => {
    const b = src.slice(0, Math.min(7, Math.max(1, left)));
    setBatch(b);
    setPhase("intro");
    setI(0);
    setMist(0);
    if (b[0] && autoplay()) setTimeout(() => speak(b[0].ru), 300);
  };
  const startDrill = (b: RuWord[]) => {
    const t: Task[] = [
      ...shuffle(b).map((w) => ({ w, kind: "choice" as Kind, rev: false, key: ++seq.current })),
      ...shuffle(b).map((w) => ({ w, kind: "choice" as Kind, rev: true, key: ++seq.current })),
      ...shuffle(b).map((w) => ({ w, kind: "type" as Kind, rev: false, key: ++seq.current })),
    ];
    setTasks(t);
    setTotal(t.length);
    setPhase("drill");
  };
  const done = async (g: 0 | 1 | 2 | 3) => {
    const [h, ...rest] = tasks;
    if (g === 0) {
      setMist((m) => m + 1);
      const at = Math.min(rest.length, 2);
      const again = { ...h, key: ++seq.current };
      setTotal((x) => x + 1);
      setTasks([...rest.slice(0, at), again, ...rest.slice(at)]);
      return;
    }
    setTasks(rest);
    if (!rest.length && batch) {
      setPhase("done");
      await post({ action: "word.learn", ids: batch.map((w) => w.id) }).catch(() => {});
    }
  };

  if (!batch) {
    return (
      <Sheet title="🆕 Yangi so'zlar" onClose={onClose}>
        <div className="form">
          {!fresh.length ? (
            <Empty emoji="🎓" text="Barcha so'zlar o'rganilgan! Yangi dars rasmini yuboring yoki so'z qo'shing." />
          ) : left <= 0 ? (
            <>
              <Empty emoji="✅" text={`Bugungi limit bajarildi: ${learnedToday} ta yangi so'z. Ertaga yana. Hozir takrorlash yoki o'yin foydaliroq.`} />
              <div className="foot">
                <button className="btn soft" onClick={() => setExtra(true)}>
                  Baribir yana 7 ta
                </button>
                <button className="btn brand" onClick={() => open({ k: "review" })}>
                  🔁 Takrorlash
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
                So&apos;zlar 5–7 tadan o&apos;rganiladi: <b>1)</b> tanishasiz va tinglaysiz, <b>2)</b> tarjimasini tanlaysiz, <b>3)</b> ruschasini tanlaysiz, <b>4)</b> o&apos;zingiz yozasiz. Xato qilganingiz qayta so&apos;raladi.
              </p>
              <div className="ru-chips">
                {fresh.slice(0, Math.min(7, left)).map((w) => (
                  <span key={w.id} lang="ru">
                    {w.ru}
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Bugun: {learnedToday}/{limit} · Jami o&apos;rganilmagan: {fresh.length} ta
              </p>
              <button className="btn brand block" onClick={() => begin(fresh)}>
                Boshlash — {Math.min(7, left, fresh.length)} ta so&apos;z
              </button>
            </>
          )}
        </div>
      </Sheet>
    );
  }

  if (phase === "intro") {
    const w = batch[i];
    return (
      <Sheet title={`Tanishuv · ${i + 1}/${batch.length}`} onClose={onClose}>
        <div className="form">
          <div className="ru-dots">
            {batch.map((_, k) => (
              <i key={k} className={k <= i ? "on" : ""} />
            ))}
          </div>
          <div className="ru-card shown" style={{ cursor: "default" }}>
            <small>Yangi so&apos;z</small>
            <span className="ru-front" lang="ru">
              {w.ru} <SpeakBtn text={w.ru} big />
            </span>
            {w.gender && <span className="pill">{GENDER_LABEL[w.gender]}</span>}
            <hr />
            <span className="ru-back">{w.uz}</span>
            {w.example && (
              <i lang="ru" className="ru-exline">
                {w.example} <SpeakBtn text={w.example} />
              </i>
            )}
          </div>
          <div className="foot">
            {i > 0 && (
              <button className="btn soft" onClick={() => setI(i - 1)}>
                ←
              </button>
            )}
            <button
              className="btn brand"
              style={{ flex: 1 }}
              autoFocus
              onClick={() => {
                if (i + 1 < batch.length) {
                  setI(i + 1);
                  if (autoplay()) speak(batch[i + 1].ru);
                } else startDrill(batch);
              }}
            >
              {i + 1 < batch.length ? "Keyingi so'z →" : "Mashqqa o'tish →"}
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  if (phase === "done") {
    const moreLeft = fresh.filter((w) => !batch.some((b) => b.id === w.id)).length;
    const canMore = moreLeft > 0 && (extra || limit - learnedToday - batch.length > 0);
    return (
      <Sheet title="🎉 Yangi so'zlar" onClose={onClose}>
        <div className="form" style={{ justifyItems: "center", textAlign: "center" }}>
          <span style={{ fontSize: 56 }}>🎉</span>
          <h3 style={{ margin: 0 }}>{batch.length} ta yangi so&apos;z o&apos;rganildi!</h3>
          <p style={{ margin: 0, color: "var(--muted)" }}>{mist ? `${mist} marta xato — ular ertaga birinchi bo'lib takrorlanadi.` : "Bitta ham xatosiz! 💪"} Ertaga takrorlashda yana chiqadi.</p>
          <div className="ru-chips" style={{ justifyContent: "center" }}>
            {batch.map((w) => (
              <span key={w.id} lang="ru">
                {w.ru} <small>— {w.uz}</small>
              </span>
            ))}
          </div>
          <div className="foot" style={{ width: "100%" }}>
            {canMore && (
              <button
                className="btn soft"
                onClick={() => {
                  const rest = fresh.filter((w) => !batch.some((b) => b.id === w.id));
                  setBatch(null);
                  setTimeout(() => begin(rest), 0);
                }}
              >
                Yana {Math.min(7, moreLeft)} ta
              </button>
            )}
            <button className="btn brand" onClick={onClose}>
              Tayyor
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  const cur = tasks[0];
  return (
    <Sheet title="Mashq" onClose={onClose}>
      <div className="form">
        <Bar pct={((total - tasks.length) / Math.max(1, total)) * 100} color="var(--brand)" />
        {cur && <TaskView key={cur.key} t={cur} all={r.words} onDone={done} />}
      </div>
    </Sheet>
  );
}

/* ============================== Juftlash o'yini ============================== */
export function MatchGame({ onClose }: { onClose: () => void }) {
  const { r, reload } = useRu();
  const { haptic } = useStore();
  const src = useMemo(() => {
    const learned = r.words.filter((w) => w.reps > 0);
    const base = learned.length >= 6 ? learned : r.words;
    // Ko'p xato qilinganlar ko'proq chiqadi
    return shuffle(base).sort((a, b) => b.lapses - a.lapses).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ROUNDS = Math.min(3, Math.floor(src.length / 6)) || 1;
  const [round, setRound] = useState(0);
  const words = useMemo(() => shuffle(src).slice(0, 6), [src, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const right = useMemo(() => shuffle(words), [words]);
  const [selL, setSelL] = useState<number | null>(null);
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<string | null>(null);
  const [mist, setMist] = useState(0);
  const [t0] = useState(Date.now());
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => () => void reload(), [reload]);

  if (src.length < 4) {
    return (
      <Sheet title="🧩 Juftlash" onClose={onClose}>
        <Empty emoji="🔤" text="O'yin uchun kamida 4 ta so'z kerak." />
      </Sheet>
    );
  }

  const tryPair = (rid: number) => {
    if (selL === null) return;
    if (selL === rid) {
      haptic("success");
      speak(words.find((w) => w.id === rid)!.ru, 1);
      const g = new Set(gone).add(rid);
      setGone(g);
      setSelL(null);
      if (g.size === words.length) {
        if (round + 1 < ROUNDS) {
          setTimeout(() => {
            setRound(round + 1);
            setGone(new Set());
          }, 400);
        } else {
          const sec = Math.round((Date.now() - t0) / 1000);
          setEnd(sec);
          const total = ROUNDS * words.length;
          post({ action: "quiz.done", total, correct: Math.max(0, total - mist) }).catch(() => {});
        }
      }
    } else {
      haptic();
      setMist((m) => m + 1);
      setBad(`${selL}-${rid}`);
      setTimeout(() => {
        setBad(null);
        setSelL(null);
      }, 500);
    }
  };

  if (end !== null) {
    return (
      <Sheet title="🧩 Juftlash" onClose={onClose}>
        <div className="form" style={{ justifyItems: "center", textAlign: "center" }}>
          <span style={{ fontSize: 56 }}>{mist === 0 ? "🏆" : mist < 4 ? "👍" : "💪"}</span>
          <b style={{ fontSize: 26 }} className="num">
            {end} soniya · {mist} xato
          </b>
          <span style={{ color: "var(--muted)" }}>{ROUNDS * 6} ta juftlik</span>
          <div className="foot" style={{ width: "100%" }}>
            <button
              className="btn soft"
              onClick={() => {
                setRound(0);
                setGone(new Set());
                setMist(0);
                setEnd(null);
              }}
            >
              🔁 Qayta
            </button>
            <button className="btn brand" onClick={onClose}>
              Tayyor
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`🧩 Juftlash · ${round + 1}/${ROUNDS}`} onClose={onClose}>
      <div className="form">
        <small className="ru-task">Ruscha so&apos;zni, keyin uning tarjimasini bosing</small>
        <div className="ru-match">
          <div>
            {words.map((w) => (
              <button
                key={w.id}
                lang="ru"
                disabled={gone.has(w.id)}
                className={(gone.has(w.id) ? "gone " : "") + (selL === w.id ? "sel " : "") + (bad?.startsWith(w.id + "-") ? "bad" : "")}
                onClick={() => {
                  setSelL(w.id);
                  if (autoplay()) speak(w.ru, 1);
                }}
              >
                {w.ru}
              </button>
            ))}
          </div>
          <div>
            {right.map((w) => (
              <button key={w.id} disabled={gone.has(w.id) || selL === null} className={(gone.has(w.id) ? "gone " : "") + (bad?.endsWith("-" + w.id) ? "bad" : "")} onClick={() => tryPair(w.id)}>
                {w.uz}
              </button>
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>Xatolar: {mist}</p>
      </div>
    </Sheet>
  );
}
