"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { todayStr } from "@/lib/format";
import {
  almost, GENDER_LABEL, isCorrect, ivlLabel, ruStreak, schedule, shuffle,
  type RuData, type RuItem, type RuLesson, type RuPack, type RuSet, type RuWord,
} from "@/lib/ru";
import { GRAMMAR } from "@/lib/ruGrammar";
import { api, Bar, Chips, Confirm, Empty, Field, Foot, Seg, Sheet, useStore, useSubmit } from "./ui";
import { I } from "./icons";
import type { Me } from "./Settings";

type Sub = "bugun" | "sozlar" | "darslar" | "grammatika";
type Open =
  | null
  | { k: "review" }
  | { k: "photo" }
  | { k: "gen"; lessonId?: number }
  | { k: "quiz" }
  | { k: "set"; id: number }
  | { k: "word"; w?: RuWord }
  | { k: "lesson"; l: RuLesson }
  | { k: "lessonForm"; l?: RuLesson }
  | { k: "settings" };

type Ctx = { r: RuData; reload: () => Promise<void>; open: (o: Open) => void; run: (fn: () => Promise<unknown>, msg?: string) => Promise<void> };
const RuCtx = createContext<Ctx | null>(null);
const useRu = () => useContext(RuCtx)!;
const post = <T = { ok: boolean }>(body: Record<string, unknown>) => api<T>("/api/ru", "POST", body);

const GTAG: Record<string, string> = { m: "м", f: "ж", n: "ср", pl: "мн" };

export default function Russian({ me, setMe }: { me: Me | null; setMe: (m: Me) => void }) {
  const { toast, haptic } = useStore();
  const [r, setR] = useState<RuData | null>(null);
  const [err, setErr] = useState("");
  const [sub, setSub] = useState<Sub>("bugun");
  const [o, setO] = useState<Open>(null);
  const reload = useCallback(async () => {
    try {
      setR(await api<RuData>("/api/ru"));
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  const run = useCallback(
    async (fn: () => Promise<unknown>, msg?: string) => {
      try {
        await fn();
        await reload();
        if (msg) {
          toast(msg);
          haptic("success");
        }
      } catch (e) {
        toast("Xatolik: " + (e as Error).message);
      }
    },
    [reload, toast, haptic]
  );

  if (err) return <div className="card"><Empty emoji="⚠️" text={err} btn="Qayta urinish" onAdd={reload} /></div>;
  if (!r) return <div className="card"><Empty emoji="⏳" text="Yuklanmoqda…" /></div>;
  const ctx: Ctx = { r, reload, open: setO, run };
  const close = () => setO(null);

  return (
    <RuCtx.Provider value={ctx}>
      <div className="ph">
        <div>
          <h1>Rus tili</h1>
          <p>
            {r.words.length} ta so&apos;z · {r.lessons.length} ta dars
          </p>
        </div>
        <button className="more" aria-label="Sozlamalar" onClick={() => setO({ k: "settings" })}>
          <I.gear />
        </button>
      </div>
      <Seg
        label="Bo'lim"
        value={sub}
        onChange={setSub}
        options={[
          { v: "bugun", t: "Bugun" },
          { v: "sozlar", t: "So'zlar" },
          { v: "darslar", t: "Darslar" },
          { v: "grammatika", t: "Qoidalar" },
        ]}
      />
      {sub === "bugun" && <TodayTab />}
      {sub === "sozlar" && <WordsTab />}
      {sub === "darslar" && <LessonsTab />}
      {sub === "grammatika" && <GrammarTab />}
      {(sub === "sozlar" || sub === "darslar") && (
        <button className="fab" aria-label="Qo'shish" onClick={() => setO(sub === "sozlar" ? { k: "word" } : { k: "lessonForm" })}>
          <I.plus />
        </button>
      )}

      {o?.k === "review" && <ReviewSheet onClose={close} />}
      {o?.k === "photo" && <PhotoSheet onClose={close} />}
      {o?.k === "gen" && <GenSheet lessonId={o.lessonId} onClose={close} />}
      {o?.k === "quiz" && <WordQuiz onClose={close} />}
      {o?.k === "set" && <SetSheet id={o.id} onClose={close} />}
      {o?.k === "word" && <WordForm w={o.w} onClose={close} />}
      {o?.k === "lesson" && <LessonView l={o.l} onClose={close} />}
      {o?.k === "lessonForm" && <LessonForm l={o.l} onClose={close} />}
      {o?.k === "settings" && me && <RuSettings me={me} setMe={setMe} onClose={close} />}
    </RuCtx.Provider>
  );
}

/* ============================== Bugun ============================== */
function TodayTab() {
  const { r, open, run } = useRu();
  const today = todayStr();
  const due = r.words.filter((w) => w.due.slice(0, 10) <= today);
  const fresh = due.filter((w) => w.reps === 0).length;
  const { streak, today: doneToday } = ruStreak(r.log, today);
  const learned = r.words.filter((w) => w.ivl >= 21).length;
  const hw = r.lessons.filter((l) => l.homework && !l.hw_done);
  const sets = r.sets.slice(0, 8);
  const last7 = r.log.filter((l) => l.date.slice(0, 10) > new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10));
  const acc = last7.reduce((a, l) => a + l.reviews, 0) ? Math.round((last7.reduce((a, l) => a + l.correct, 0) / last7.reduce((a, l) => a + l.reviews, 0)) * 100) : null;

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, display: "grid", gap: 2 }}>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: streak ? "var(--brand)" : "var(--muted)" }}>🔥 {streak} kun</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {doneToday ? `Bugun ${doneToday} ta mashq bajarildi` : "Bugun hali mashq qilinmadi"}
              {acc !== null ? ` · 7 kunda ${acc}% to'g'ri` : ""}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>
              {learned}/{r.words.length}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>yod bo&apos;lgan</div>
          </div>
        </div>
        <button className="btn brand block" disabled={!due.length} onClick={() => open({ k: "review" })}>
          🔁 {due.length ? `Takrorlash — ${due.length} ta so'z${fresh ? ` (${fresh} yangi)` : ""}` : "Bugungi takrorlash bajarildi ✓"}
        </button>
        <div className="ru-actions">
          <button onClick={() => open({ k: "photo" })}>
            <b>📷</b>
            <span>Rasmdan dars</span>
            <small>darslik, daftar, doska</small>
          </button>
          <button onClick={() => open({ k: "gen" })}>
            <b>✨</b>
            <span>AI mashq</span>
            <small>mavzu bo&apos;yicha</small>
          </button>
          <button onClick={() => open({ k: "quiz" })} disabled={r.words.length < 4}>
            <b>📝</b>
            <span>So&apos;z testi</span>
            <small>{r.words.length < 4 ? "kamida 4 so'z kerak" : "10 ta savol"}</small>
          </button>
        </div>
        {!r.ai && <p className="ru-warn">AI hali ulanmagan — rasm va AI mashqlar ishlashi uchun Vercel'da ANTHROPIC_API_KEY qo&apos;shilishi kerak.</p>}
      </div>

      {hw.length > 0 && (
        <div className="card flush">
          <h2>📌 Uy vazifasi</h2>
          {hw.map((l) => (
            <div key={l.id} className="row">
              <button
                className="check"
                role="checkbox"
                aria-checked={false}
                aria-label="Bajarildi"
                onClick={() => run(() => post({ action: "lesson.hw", id: l.id, done: true }), "Uy vazifasi bajarildi ✅")}
              />
              <button className="body" style={{ textAlign: "left", background: "none", border: 0, font: "inherit", color: "inherit", cursor: "pointer" }} onClick={() => open({ k: "lesson", l })}>
                <span className="t">{l.homework}</span>
                <span className="m">
                  {l.topic} · {fmtDate(l.date)}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card flush">
        <h2>
          ✨ Mashqlar
          {r.sets.length > 0 && (
            <button className="link" onClick={() => open({ k: "gen" })}>
              + Yangi
            </button>
          )}
        </h2>
        {sets.length === 0 ? (
          <Empty emoji="📷" text="Dars rasmini yuboring — AI undan so'zlar, qoida va mashqlar tuzib beradi. Rasmni botga ham yuborsangiz bo'ladi." btn="Rasm yuklash" onAdd={() => open({ k: "photo" })} />
        ) : (
          sets.map((s) => <SetRow key={s.id} s={s} />)
        )}
      </div>
    </>
  );
}

function SetRow({ s }: { s: RuSet }) {
  const { open } = useRu();
  const pct = s.total ? Math.round(((s.score ?? 0) / s.total) * 100) : null;
  return (
    <button className="row" style={{ width: "100%", background: "none", border: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }} onClick={() => open({ k: "set", id: s.id })}>
      <span className="ru-ic">{pct === null ? "▶" : pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "🔁"}</span>
      <span className="body">
        <span className="t">{s.title}</span>
        <span className="m">
          {s.items.length} ta mashq · {fmtDate(s.created_at)}
          {pct !== null && <b style={{ color: pct >= 80 ? "var(--money)" : pct >= 50 ? "var(--ink)" : "var(--warn)" }}>{pct}%</b>}
        </span>
      </span>
      <span className="pill">{pct === null ? "Boshlash" : "Qayta"}</span>
    </button>
  );
}

/* ============================== Takrorlash (kartochkalar) ============================== */
function ReviewSheet({ onClose }: { onClose: () => void }) {
  const { r, reload } = useRu();
  const { haptic } = useStore();
  const today = todayStr();
  const [queue, setQueue] = useState<{ w: RuWord; rev: boolean }[]>(() =>
    shuffle(r.words.filter((w) => w.due.slice(0, 10) <= today))
      .slice(0, 60)
      .map((w, i) => ({ w, rev: w.reps > 1 && i % 2 === 1 })) // yangi so'zlar ruscha → o'zbekcha, keyin aralash
  );
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState({ n: 0, ok: 0 });
  const cur = queue[0];
  useEffect(() => () => void reload(), [reload]);

  const grade = async (g: 0 | 1 | 2 | 3) => {
    if (!cur) return;
    haptic(g ? "light" : undefined);
    post({ action: "word.grade", id: cur.w.id, grade: g }).catch(() => {});
    setDone((d) => ({ n: d.n + 1, ok: d.ok + (g ? 1 : 0) }));
    setShown(false);
    setQueue((q) => {
      const [h, ...rest] = q;
      if (g === 0) {
        // Esimda yo'q — biroz keyin yana chiqadi
        const at = Math.min(rest.length, 3);
        const w = { ...h.w, ...schedule(h.w, 0) };
        return [...rest.slice(0, at), { w, rev: h.rev }, ...rest.slice(at)];
      }
      return rest;
    });
  };

  if (!cur) {
    return (
      <Sheet title="Takrorlash" onClose={onClose}>
        <div className="form" style={{ textAlign: "center", justifyItems: "center" }}>
          <span style={{ fontSize: 56 }}>🎉</span>
          <h3 style={{ margin: 0 }}>{done.n ? "Barakalla! Bugungi takrorlash tugadi" : "Hozircha takrorlash yo'q"}</h3>
          {done.n > 0 && (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {done.n} ta javob · {Math.round((done.ok / done.n) * 100)}% esingizda
            </p>
          )}
          <button className="btn brand" onClick={onClose}>
            Yopish
          </button>
        </div>
      </Sheet>
    );
  }
  const w = cur.w;
  const front = cur.rev ? w.uz : w.ru;
  const next = (g: 0 | 1 | 2 | 3) => ivlLabel(schedule(w, g).ivl);
  return (
    <Sheet title="Takrorlash" onClose={onClose}>
      <div className="form">
        <Bar pct={(done.n / Math.max(1, done.n + queue.length)) * 100} color="var(--brand)" />
        <button className={"ru-card" + (shown ? " shown" : "")} onClick={() => setShown(true)} aria-live="polite">
          <small>{cur.rev ? "Ruschasini eslang" : w.reps === 0 ? "Yangi so'z" : "Tarjimasini eslang"}</small>
          <span className="ru-front" lang={cur.rev ? "uz" : "ru"}>
            {front}
          </span>
          {!cur.rev && w.gender && <span className="pill">{GENDER_LABEL[w.gender]}</span>}
          {shown ? (
            <>
              <hr />
              <span className="ru-back" lang={cur.rev ? "ru" : "uz"}>
                {cur.rev ? w.ru : w.uz}
              </span>
              {cur.rev && w.gender && <span className="pill">{GENDER_LABEL[w.gender]}</span>}
              {w.example && (
                <i lang="ru" style={{ color: "var(--muted)" }}>
                  {w.example}
                </i>
              )}
            </>
          ) : (
            <small style={{ marginTop: 18 }}>Bosing — javobni ko&apos;rish</small>
          )}
        </button>
        {shown ? (
          <div className="ru-grades">
            <button onClick={() => grade(0)} className="g0">
              Esimda yo&apos;q<small>{next(0)}</small>
            </button>
            <button onClick={() => grade(1)} className="g1">
              Qiyin<small>{next(1)}</small>
            </button>
            <button onClick={() => grade(2)} className="g2">
              Esimda<small>{next(2)}</small>
            </button>
            <button onClick={() => grade(3)} className="g3">
              Oson<small>{next(3)}</small>
            </button>
          </div>
        ) : (
          <button className="btn brand block" onClick={() => setShown(true)}>
            Javobni ko&apos;rish
          </button>
        )}
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>Qolgan: {queue.length} ta · Esdan chiqqanlar tezroq, yaxshi bilganlar kamroq qaytariladi</p>
      </div>
    </Sheet>
  );
}

/* ============================== Mashq bajarish (umumiy) ============================== */
function Runner({ title, items, onFinish, onClose }: { title: string; items: RuItem[]; onFinish: (score: number, total: number) => void; onClose: () => void }) {
  const { haptic } = useStore();
  const [i, setI] = useState(0);
  const [val, setVal] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [res, setRes] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<{ it: RuItem; given: string }[]>([]);
  const [finished, setFinished] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  const it = items[i];

  const check = (choice?: number) => {
    if (res !== null || !it) return;
    let ok: boolean;
    let given: string;
    if (it.type === "choice") {
      ok = choice === it.answer;
      given = it.options[choice ?? -1] ?? "";
      setPicked(choice ?? null);
    } else {
      if (!val.trim()) return;
      ok = isCorrect(val, it.answer, it.accept);
      given = val;
    }
    haptic(ok ? "success" : "light");
    setRes(ok);
    if (ok) setScore((s) => s + 1);
    else setWrong((w) => [...w, { it, given }]);
  };
  const override = () => {
    setRes(true);
    setScore((s) => s + 1);
    setWrong((w) => w.slice(0, -1));
  };
  const next = () => {
    if (i + 1 >= items.length) {
      setFinished(true);
      onFinish(score, items.length);
      return;
    }
    setI(i + 1);
    setVal("");
    setPicked(null);
    setRes(null);
    setTimeout(() => inp.current?.focus(), 50);
  };
  const restart = () => {
    setI(0);
    setVal("");
    setPicked(null);
    setRes(null);
    setScore(0);
    setWrong([]);
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((score / items.length) * 100);
    return (
      <Sheet title={title} onClose={onClose}>
        <div className="form">
          <div style={{ textAlign: "center", display: "grid", gap: 4, justifyItems: "center" }}>
            <span style={{ fontSize: 56 }}>{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "💪"}</span>
            <b style={{ fontSize: 28 }} className="num">
              {score}/{items.length} · {pct}%
            </b>
            <span style={{ color: "var(--muted)" }}>{pct >= 80 ? "Zo'r natija!" : pct >= 50 ? "Yaxshi, xatolarni ko'rib chiqing" : "Qoidani yana bir ko'rib, qayta urinib ko'ring"}</span>
          </div>
          {wrong.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <b>Xatolar ustida ishlash</b>
              {wrong.map(({ it, given }, k) => (
                <div key={k} className="ru-mistake">
                  <span lang="ru">{it.q}</span>
                  <span>
                    <s style={{ color: "var(--bad)" }}>{given || "—"}</s> → <b style={{ color: "var(--money)" }}>{it.type === "choice" ? it.options[it.answer] : it.answer}</b>
                  </span>
                  {it.explain && <small>{it.explain}</small>}
                </div>
              ))}
            </div>
          )}
          <div className="foot">
            <button className="btn soft" onClick={restart}>
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
    <Sheet title={title} onClose={onClose}>
      <div className="form">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Bar pct={(i / items.length) * 100} color="var(--brand)" />
          </div>
          <span className="num" style={{ fontSize: 13, color: "var(--muted)" }}>
            {i + 1}/{items.length}
          </span>
        </div>
        <small style={{ color: "var(--muted)", fontWeight: 600 }}>
          {it.type === "choice" ? "To'g'ri javobni tanlang" : it.type === "fill" ? "Bo'sh joyni to'ldiring" : "Rus tiliga tarjima qiling"}
        </small>
        <div className="ru-q" lang={it.type === "translate" ? "uz" : "ru"}>
          {it.q}
        </div>
        {it.type === "fill" && it.hint && <small style={{ color: "var(--muted)" }}>💡 {it.hint}</small>}

        {it.type === "choice" ? (
          <div className="ru-opts">
            {it.options.map((op, k) => (
              <button
                key={k}
                lang="ru"
                disabled={res !== null}
                className={res === null ? "" : k === it.answer ? "ok" : k === picked ? "bad" : "dim"}
                onClick={() => check(k)}
              >
                {op}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (res === null) check();
              else next();
            }}
            className="form"
          >
            <input
              ref={inp}
              lang="ru"
              data-autofocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={"huge" + (res === true ? " ok" : res === false ? " bad" : "")}
              value={val}
              readOnly={res !== null}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Javob…"
            />
            {res === null && (
              <button className="btn brand block" type="submit" disabled={!val.trim()}>
                Tekshirish
              </button>
            )}
          </form>
        )}

        {res !== null && (
          <div className={"ru-fb " + (res ? "ok" : "bad")} role="status">
            <b>{res ? "✓ To'g'ri!" : it.type !== "choice" && almost(val, it.answer) ? "Deyarli! Bitta harf xato" : "✗ Noto'g'ri"}</b>
            {!res && (
              <span>
                To&apos;g&apos;ri javob: <b lang="ru">{it.type === "choice" ? it.options[it.answer] : it.answer}</b>
              </span>
            )}
            {it.explain && <small>{it.explain}</small>}
            {!res && it.type !== "choice" && (
              <button className="link" type="button" onClick={override}>
                Men to&apos;g&apos;ri yozganman
              </button>
            )}
          </div>
        )}
        {res !== null && (
          <button className="btn brand block" onClick={next} autoFocus>
            {i + 1 >= items.length ? "Natija" : "Keyingisi →"}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function SetSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const { r, reload } = useRu();
  const s = r.sets.find((x) => x.id === id);
  if (!s) return null;
  return (
    <Runner
      title={s.title}
      items={s.items}
      onClose={() => {
        reload();
        onClose();
      }}
      onFinish={(score, total) => post({ action: "set.score", id: s.id, score, total }).catch(() => {})}
    />
  );
}

/** O'z so'zlaringizdan test (AI'siz) */
function WordQuiz({ onClose }: { onClose: () => void }) {
  const { r, reload } = useRu();
  const items = useMemo<RuItem[]>(() => {
    const pool = shuffle(r.words);
    // Ko'p xato qilinganlarni oldinga
    pool.sort((a, b) => b.lapses - a.lapses || a.ease - b.ease);
    const pick = shuffle(pool.slice(0, 14)).slice(0, 10);
    return pick.map((w, k) => {
      const others = shuffle(r.words.filter((x) => x.id !== w.id)).slice(0, 3);
      const kind = w.gender && k % 4 === 3 ? "gender" : k % 3 === 0 ? "type" : k % 2 ? "ru2uz" : "uz2ru";
      if (kind === "gender") {
        const opts = ["m", "f", "n", "pl"];
        return { type: "choice", q: `«${w.ru}» — qaysi rod?`, options: opts.map((g) => GENDER_LABEL[g]), answer: opts.indexOf(w.gender!) } as RuItem;
      }
      if (kind === "type") return { type: "translate", q: w.uz, answer: w.ru, accept: w.ru.split("/").map((x) => x.trim()), explain: w.example ?? undefined } as RuItem;
      const right = kind === "ru2uz" ? w.uz : w.ru;
      const opts = shuffle([right, ...others.map((x) => (kind === "ru2uz" ? x.uz : x.ru))]);
      return { type: "choice", q: kind === "ru2uz" ? `${w.ru} — tarjimasi?` : `«${w.uz}» ruscha qanday?`, options: opts, answer: opts.indexOf(right) } as RuItem;
    });
  }, [r.words]);
  return (
    <Runner
      title="So'z testi"
      items={items}
      onClose={() => {
        reload();
        onClose();
      }}
      onFinish={(score, total) => post({ action: "quiz.done", correct: score, total }).catch(() => {})}
    />
  );
}

/* ============================== Rasmdan dars ============================== */
async function shrink(file: File): Promise<{ data: string; type: "image/jpeg"; url: string }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((ok, bad) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => bad(new Error("Rasmni ochib bo'lmadi"));
    im.src = url;
  });
  const max = 1800;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  const data = c.toDataURL("image/jpeg", 0.85).split(",")[1];
  return { data, type: "image/jpeg", url };
}

const WAIT = ["Rasm o'qilmoqda…", "So'zlar ajratilmoqda…", "Qoida tushuntirilmoqda…", "Mashqlar tuzilmoqda…", "Deyarli tayyor…"];

function PhotoSheet({ onClose }: { onClose: () => void }) {
  const { r, run, open } = useRu();
  const [imgs, setImgs] = useState<{ data: string; type: "image/jpeg"; url: string }[]>([]);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [pack, setPack] = useState<RuPack | null>(null);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const known = useMemo(() => new Set(r.words.map((w) => w.ru.toLowerCase())), [r.words]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(WAIT.length - 1, s + 1)), 9000);
    return () => clearInterval(t);
  }, [busy]);

  const add = async (files: FileList | null) => {
    if (!files) return;
    setErr("");
    try {
      const out = await Promise.all(Array.from(files).slice(0, 4 - imgs.length).map(shrink));
      setImgs((x) => [...x, ...out].slice(0, 4));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const analyze = async () => {
    setBusy(true);
    setStep(0);
    setErr("");
    try {
      const res = await api<{ pack: RuPack }>("/api/ru/photo", "POST", { images: imgs.map(({ data, type }) => ({ data, type })), hint });
      setPack(res.pack);
      setKeep(new Set(res.pack.words.map((w, i) => (known.has(w.ru.toLowerCase()) ? -1 : i)).filter((i) => i >= 0)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!pack) return;
    setBusy(true);
    let setId: number | null = null;
    await run(async () => {
      const res = await post<{ setId: number | null; added: number }>({ action: "pack.save", pack, words: [...keep] });
      setId = res.setId;
    }, "Dars saqlandi 📚");
    setBusy(false);
    if (setId) open({ k: "set", id: setId });
    else onClose();
  };

  if (pack) {
    return (
      <Sheet title="Rasmdan olingan dars" onClose={onClose}>
        <div className="form">
          <div>
            <h3 style={{ margin: "0 0 4px" }}>{pack.topic}</h3>
            {pack.summary && <p style={{ margin: 0, color: "var(--muted)" }}>{pack.summary}</p>}
          </div>
          {pack.grammar.map((g, k) => (
            <GrammarCard key={k} g={g} />
          ))}
          {pack.words.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>So&apos;zlar · {keep.size}/{pack.words.length} tanlandi</b>
                <button className="link" onClick={() => setKeep(keep.size === pack.words.length ? new Set() : new Set(pack.words.map((_, i) => i)))}>
                  {keep.size === pack.words.length ? "Hech biri" : "Hammasi"}
                </button>
              </div>
              <div className="card flush" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
                {pack.words.map((w, k) => {
                  const dup = known.has(w.ru.toLowerCase());
                  return (
                    <label key={k} className="row" style={{ cursor: "pointer", minHeight: 48 }}>
                      <input
                        type="checkbox"
                        checked={keep.has(k)}
                        onChange={(e) => {
                          const n = new Set(keep);
                          if (e.target.checked) n.add(k);
                          else n.delete(k);
                          setKeep(n);
                        }}
                        style={{ width: 20, height: 20, accentColor: "var(--brand)" }}
                      />
                      <span className="body">
                        <span className="t" lang="ru">
                          {w.ru} {w.gender && <span className="ru-g">{GTAG[w.gender]}</span>}
                        </span>
                        <span className="m">
                          {w.uz}
                          {dup && <span className="pill">bor</span>}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {pack.homework && (
            <p style={{ margin: 0 }}>
              📌 <b>Uy vazifasi:</b> {pack.homework}
            </p>
          )}
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>✨ {pack.exercises.length} ta mashq tayyor — saqlagach darhol boshlaysiz.</p>
          <div className="foot">
            <button className="btn soft" onClick={() => setPack(null)} disabled={busy}>
              Orqaga
            </button>
            <button className="btn brand" onClick={save} disabled={busy}>
              {busy ? "Saqlanmoqda…" : "Saqlash va mashq"}
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="📷 Rasmdan dars" onClose={busy ? () => {} : onClose}>
      <div className="form">
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Darslik sahifasi, daftar yoki doskani rasmga oling (4 tagacha). AI yangi so&apos;zlarni, qoidani va mashqlarni ajratib, mustahkamlash uchun yangi mashqlar tuzadi.
        </p>
        <div className="ru-imgs">
          {imgs.map((im, k) => (
            <div key={k}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={`Rasm ${k + 1}`} />
              {!busy && (
                <button aria-label="Olib tashlash" onClick={() => setImgs(imgs.filter((_, j) => j !== k))}>
                  ×
                </button>
              )}
            </div>
          ))}
          {imgs.length < 4 && !busy && (
            <button className="ru-add" onClick={() => fileRef.current?.click()}>
              <b>＋</b>
              <span>{imgs.length ? "Yana rasm" : "Rasm tanlash"}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        <Field label="Izoh (ixtiyoriy)" htmlFor="ph-hint">
          <input id="ph-hint" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Masalan: 5-dars, faqat 3-mashq" disabled={busy} />
        </Field>
        {err && <p className="err">{err}</p>}
        {busy ? (
          <div className="ru-wait" role="status">
            <span className="spin" aria-hidden="true" />
            <b>{WAIT[step]}</b>
            <small>Odatda 30–90 soniya. Oynani yopmang.</small>
          </div>
        ) : (
          <button className="btn brand block" disabled={!imgs.length || !r.ai} onClick={analyze}>
            ✨ Tahlil qilish
          </button>
        )}
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Rasmni botga yuborsangiz ham bo&apos;ladi — dars avtomatik saqlanadi. Bugun yana {r.ai_left} ta AI so&apos;rov qoldi.</p>
      </div>
    </Sheet>
  );
}

/* ============================== AI mashq tuzish ============================== */
function GenSheet({ lessonId, onClose }: { lessonId?: number; onClose: () => void }) {
  const { r, run, open } = useRu();
  const [src, setSrc] = useState<string>(lessonId ? String(lessonId) : r.lessons[0] ? String(r.lessons[0].id) : "mix");
  const [focus, setFocus] = useState("");
  const [count, setCount] = useState("12");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const weak = r.words.filter((w) => w.lapses > 0).length;
  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      const body: Record<string, unknown> = { focus, count: Number(count) };
      if (src === "weak") body.mode = "weak";
      else if (src !== "mix") body.lesson_id = Number(src);
      const res = await api<{ id: number }>("/api/ru/gen", "POST", body);
      await run(async () => {}, "Mashqlar tayyor ✨");
      open({ k: "set", id: res.id });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Sheet title="✨ AI mashq" onClose={busy ? () => {} : onClose}>
      <div className="form">
        <Field label="Nima asosida?" htmlFor="gen-src">
          <select id="gen-src" value={src} onChange={(e) => setSrc(e.target.value)} disabled={busy}>
            {r.lessons.map((l) => (
              <option key={l.id} value={l.id}>
                📘 {l.topic} ({fmtDate(l.date)})
              </option>
            ))}
            <option value="mix">🔀 Aralash — barcha so&apos;zlarim</option>
            {weak > 0 && <option value="weak">🎯 Qiyin so&apos;zlarim ({weak} ta)</option>}
          </select>
        </Field>
        <Field label="Nimaga e'tibor bersin? (ixtiyoriy)" htmlFor="gen-f">
          <input id="gen-f" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Masalan: предложный падеж, fe'l tuslanishi" disabled={busy} />
        </Field>
        <Chips
          value={count}
          onChange={setCount}
          options={[
            { v: "8", t: "8 ta" },
            { v: "12", t: "12 ta" },
            { v: "20", t: "20 ta" },
          ]}
        />
        {err && <p className="err">{err}</p>}
        {busy ? (
          <div className="ru-wait" role="status">
            <span className="spin" aria-hidden="true" />
            <b>Mashqlar tuzilmoqda…</b>
            <small>10–30 soniya</small>
          </div>
        ) : (
          <button className="btn brand block" onClick={go} disabled={!r.ai || (src === "mix" && !r.words.length && !focus)}>
            Tuzish
          </button>
        )}
        {!r.ai && <p className="ru-warn">AI ulanmagan (ANTHROPIC_API_KEY).</p>}
      </div>
    </Sheet>
  );
}

/* ============================== So'zlar ============================== */
type WF = "all" | "due" | "hard" | "known";
function WordsTab() {
  const { r, open } = useRu();
  const [q, setQ] = useState("");
  const [f, setF] = useState<WF>("all");
  const today = todayStr();
  const list = r.words.filter((w) => {
    if (q && !(w.ru.toLowerCase().includes(q.toLowerCase()) || w.uz.toLowerCase().includes(q.toLowerCase()))) return false;
    if (f === "due") return w.due.slice(0, 10) <= today;
    if (f === "hard") return w.lapses > 0;
    if (f === "known") return w.ivl >= 21;
    return true;
  });
  if (!r.words.length)
    return (
      <div className="card">
        <Empty emoji="🔤" text="Hali so'z yo'q. Qo'lda qo'shing yoki dars rasmini yuklang — so'zlar avtomatik qo'shiladi." btn="So'z qo'shish" onAdd={() => open({ k: "word" })} />
      </div>
    );
  return (
    <>
      <input className="search" type="search" placeholder="Qidirish (ruscha yoki o'zbekcha)…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Chips
        value={f}
        onChange={setF}
        options={[
          { v: "all", t: `Hammasi · ${r.words.length}` },
          { v: "due", t: `Takrorlash · ${r.words.filter((w) => w.due.slice(0, 10) <= today).length}` },
          { v: "hard", t: `Qiyin · ${r.words.filter((w) => w.lapses > 0).length}` },
          { v: "known", t: `Yod · ${r.words.filter((w) => w.ivl >= 21).length}` },
        ]}
      />
      <div className="card flush">
        {list.length === 0 && <Empty emoji="🔍" text="Topilmadi" />}
        {list.slice(0, 300).map((w) => (
          <button key={w.id} className="row" style={{ width: "100%", background: "none", border: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }} onClick={() => open({ k: "word", w })}>
            <span className="body">
              <span className="t" lang="ru">
                {w.ru} {w.gender && <span className="ru-g">{GTAG[w.gender]}</span>}
              </span>
              <span className="m">{w.uz}</span>
            </span>
            <span className="ru-due">{w.reps === 0 ? "yangi" : w.due.slice(0, 10) <= today ? "bugun" : ivlLabel(Math.round((Date.parse(w.due) - Date.parse(today)) / 86400000))}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function WordForm({ w, onClose }: { w?: RuWord; onClose: () => void }) {
  const { run } = useRu();
  const { toast } = useStore();
  const [bulk, setBulk] = useState(false);
  const [text, setText] = useState("");
  const [ru, setRu] = useState(w?.ru ?? "");
  const [uz, setUz] = useState(w?.uz ?? "");
  const [g, setG] = useState<string>(w?.gender ?? "");
  const [ex, setEx] = useState(w?.example ?? "");
  const [del, setDel] = useState(false);
  const parsed = text
    .split("\n")
    .map((l) => l.split(/\s+[-–—=:]\s+|\t/))
    .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
    .map((p) => ({ ru: p[0].trim(), uz: p.slice(1).join(" - ").trim() }));
  const { busy, err, run: submit } = useSubmit(async () => {
    if (w) await run(() => post({ action: "word.update", id: w.id, ru, uz, gender: g || null, example: ex }), "Saqlandi");
    else if (bulk) {
      let res = { added: 0, skipped: 0 };
      await run(async () => {
        res = await post<{ added: number; skipped: number; ok: boolean }>({ action: "word.add", words: parsed });
      });
      toast(`${res.added} ta so'z qo'shildi${res.skipped ? `, ${res.skipped} tasi oldin bor edi` : ""}`);
    } else await run(() => post({ action: "word.add", ru, uz, gender: g || null, example: ex }), "So'z qo'shildi");
    onClose();
  });
  return (
    <Sheet title={w ? "So'z" : "Yangi so'z"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit({});
        }}
      >
        {!w && (
          <Seg
            label="Usul"
            value={bulk ? "b" : "o"}
            onChange={(v) => setBulk(v === "b")}
            options={[
              { v: "o", t: "Bitta" },
              { v: "b", t: "Ro'yxat" },
            ]}
          />
        )}
        {bulk && !w ? (
          <Field label="Har qatorda: слово — tarjima" htmlFor="wb" hint={`${parsed.length} ta so'z aniqlandi`}>
            <textarea id="wb" rows={8} lang="ru" data-autofocus value={text} onChange={(e) => setText(e.target.value)} placeholder={"книга — kitob\nчитать - o'qimoq\nшкола — maktab"} />
          </Field>
        ) : (
          <>
            <Field label="Ruscha" htmlFor="wr">
              <input id="wr" lang="ru" data-autofocus value={ru} onChange={(e) => setRu(e.target.value)} autoCapitalize="off" required />
            </Field>
            <Field label="Tarjimasi" htmlFor="wu">
              <input id="wu" value={uz} onChange={(e) => setUz(e.target.value)} required />
            </Field>
            <div className="field">
              <label>Rod (otlar uchun)</label>
              <Chips
                value={g}
                onChange={setG}
                options={[
                  { v: "", t: "—" },
                  { v: "m", t: "он" },
                  { v: "f", t: "она" },
                  { v: "n", t: "оно" },
                  { v: "pl", t: "мн.ч." },
                ]}
              />
            </div>
            <Field label="Misol gap" htmlFor="we">
              <input id="we" lang="ru" value={ex} onChange={(e) => setEx(e.target.value)} />
            </Field>
            {w && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                {w.reps} marta takrorlangan · {w.lapses} marta esdan chiqqan · keyingi: {fmtDate(w.due)}
              </p>
            )}
          </>
        )}
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} label={bulk && !w ? `${parsed.length} ta qo'shish` : "Saqlash"} onDelete={w ? () => setDel(true) : undefined} />
      </form>
      {del && w && (
        <Confirm
          text={`«${w.ru}» o'chiriladi.`}
          onClose={() => setDel(false)}
          onYes={async () => {
            await run(() => post({ action: "word.delete", id: w.id }), "O'chirildi");
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

/* ============================== Darslar ============================== */
function LessonsTab() {
  const { r, open } = useRu();
  if (!r.lessons.length)
    return (
      <div className="card">
        <Empty emoji="📘" text="Darslar shu yerda yig'iladi. Rasm yuklang yoki darsni qo'lda yozing." btn="📷 Rasmdan dars" onAdd={() => open({ k: "photo" })} />
      </div>
    );
  const count = (id: number) => r.words.filter((w) => w.lesson_id === id).length;
  return (
    <div className="card flush">
      {r.lessons.map((l) => (
        <button key={l.id} className="row" style={{ width: "100%", background: "none", border: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }} onClick={() => open({ k: "lesson", l })}>
          <span className="ru-ic">{l.source === "rasm" ? "📷" : "📘"}</span>
          <span className="body">
            <span className="t">{l.topic || "Dars"}</span>
            <span className="m">
              {fmtDate(l.date)} · {count(l.id)} so&apos;z{l.grammar.length ? ` · ${l.grammar.length} qoida` : ""}
              {l.homework && <span className="pill" style={l.hw_done ? undefined : { background: "color-mix(in srgb, var(--warn) 18%, transparent)" }}>{l.hw_done ? "✓ vazifa" : "vazifa"}</span>}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function GrammarCard({ g }: { g: { title: string; rule: string; examples?: { ru: string; uz: string }[] } }) {
  return (
    <div className="ru-rule">
      {g.title && <b>{g.title}</b>}
      {g.rule && <p>{g.rule}</p>}
      {g.examples?.map((e, k) => (
        <div key={k} className="ru-ex">
          <span lang="ru">{e.ru}</span>
          <small>{e.uz}</small>
        </div>
      ))}
    </div>
  );
}

function LessonView({ l, onClose }: { l: RuLesson; onClose: () => void }) {
  const { r, open, run } = useRu();
  const lesson = r.lessons.find((x) => x.id === l.id) ?? l;
  const words = r.words.filter((w) => w.lesson_id === l.id);
  const sets = r.sets.filter((s) => s.lesson_id === l.id);
  const [del, setDel] = useState(false);
  return (
    <Sheet title={lesson.topic || "Dars"} onClose={onClose}>
      <div className="form">
        <span style={{ color: "var(--muted)", fontSize: 14 }}>
          {fmtDate(lesson.date)} · {lesson.source === "rasm" ? "rasmdan" : "qo'lda"}
        </span>
        {lesson.summary && <p style={{ margin: 0 }}>{lesson.summary}</p>}
        {lesson.grammar.map((g, k) => (
          <GrammarCard key={k} g={g} />
        ))}
        {lesson.homework && (
          <label className="row" style={{ background: "var(--surface-2)", borderRadius: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!lesson.hw_done}
              onChange={(e) => run(() => post({ action: "lesson.hw", id: lesson.id, done: e.target.checked }), e.target.checked ? "Bajarildi ✅" : undefined)}
              style={{ width: 22, height: 22, accentColor: "var(--brand)" }}
            />
            <span className="body">
              <span className="t">📌 {lesson.homework}</span>
              <span className="m">Uy vazifasi</span>
            </span>
          </label>
        )}
        {lesson.notes && <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--muted)" }}>{lesson.notes}</p>}
        {words.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <b>So&apos;zlar · {words.length}</b>
            <div className="ru-chips">
              {words.map((w) => (
                <span key={w.id} lang="ru" title={w.uz}>
                  {w.ru} <small>— {w.uz}</small>
                </span>
              ))}
            </div>
          </div>
        )}
        {sets.length > 0 && (
          <div className="card flush" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
            {sets.map((s) => (
              <SetRow key={s.id} s={s} />
            ))}
          </div>
        )}
        <button className="btn brand block" onClick={() => open({ k: "gen", lessonId: lesson.id })}>
          ✨ Shu dars bo&apos;yicha yangi mashqlar
        </button>
        <div className="foot">
          <button className="btn soft left" onClick={() => setDel(true)} aria-label="O'chirish">
            <I.trash />
          </button>
          <button className="btn soft" onClick={() => open({ k: "lessonForm", l: lesson })}>
            Tahrirlash
          </button>
        </div>
      </div>
      {del && (
        <Sheet title="Dars o'chirilsinmi?" onClose={() => setDel(false)}>
          <div className="form">
            <p style={{ margin: 0, color: "var(--muted)" }}>Dars va uning mashqlari o&apos;chiriladi. So&apos;zlar bilan nima qilamiz?</p>
            <button className="btn soft block" onClick={() => run(() => post({ action: "lesson.delete", id: lesson.id }), "Dars o'chirildi").then(onClose)}>
              So&apos;zlar qolsin
            </button>
            <button className="btn block" style={{ background: "var(--bad)", color: "#fff" }} onClick={() => run(() => post({ action: "lesson.delete", id: lesson.id, with_words: true }), "Dars va so'zlar o'chirildi").then(onClose)}>
              So&apos;zlari bilan o&apos;chirish ({words.length})
            </button>
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

function LessonForm({ l, onClose }: { l?: RuLesson; onClose: () => void }) {
  const { run } = useRu();
  const [date, setDate] = useState(l?.date.slice(0, 10) ?? todayStr());
  const [topic, setTopic] = useState(l?.topic ?? "");
  const [grammar, setGrammar] = useState(l ? l.grammar.map((g) => [g.title, g.rule].filter(Boolean).join(": ")).join("\n\n") : "");
  const [hw, setHw] = useState(l?.homework ?? "");
  const [notes, setNotes] = useState(l?.notes ?? "");
  const [words, setWords] = useState("");
  const parsed = words
    .split("\n")
    .map((x) => x.split(/\s+[-–—=:]\s+|\t/))
    .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
    .map((p) => ({ ru: p[0].trim(), uz: p.slice(1).join(" - ").trim() }));
  const { busy, err, run: submit } = useSubmit(async () => {
    await run(async () => {
      // Tahrirlashda AI tuzgan qoidalar strukturasini saqlab qolamiz, agar matn o'zgarmagan bo'lsa
      const same = l && grammar === l.grammar.map((g) => [g.title, g.rule].filter(Boolean).join(": ")).join("\n\n");
      const res = await post<{ id: number; ok: boolean }>({ action: "lesson.save", id: l?.id, date, topic, grammar: same ? l!.grammar : grammar, homework: hw, hw_done: l?.hw_done ?? 0, notes });
      if (parsed.length) await post({ action: "word.add", words: parsed, lesson_id: res.id });
    }, "Dars saqlandi");
    onClose();
  });
  return (
    <Sheet title={l ? "Darsni tahrirlash" : "Yangi dars"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit({});
        }}
      >
        <div className="two">
          <Field label="Mavzu" htmlFor="lt">
            <input id="lt" data-autofocus value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Предложный падеж" required />
          </Field>
          <Field label="Sana" htmlFor="ld">
            <input id="ld" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Grammatika / qoida" htmlFor="lg">
          <textarea id="lg" rows={4} value={grammar} onChange={(e) => setGrammar(e.target.value)} placeholder="Где? — в/на + П.п.: в школе, на работе" />
        </Field>
        <Field label="Yangi so'zlar (har qatorda: слово — tarjima)" htmlFor="lw" hint={parsed.length ? `${parsed.length} ta so'z qo'shiladi` : undefined}>
          <textarea id="lw" rows={4} lang="ru" value={words} onChange={(e) => setWords(e.target.value)} placeholder={"школа — maktab\nработа — ish"} />
        </Field>
        <Field label="Uy vazifasi" htmlFor="lh">
          <input id="lh" value={hw} onChange={(e) => setHw(e.target.value)} placeholder="45-bet, 3-mashq" />
        </Field>
        <Field label="Izoh" htmlFor="ln">
          <textarea id="ln" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} />
      </form>
    </Sheet>
  );
}

/* ============================== Qoidalar (ma'lumotnoma) ============================== */
function GrammarTab() {
  const { r } = useRu();
  const [openId, setOpenId] = useState<string | null>(GRAMMAR[0].id);
  const mine = r.lessons.filter((l) => l.grammar.length);
  return (
    <>
      {GRAMMAR.map((s) => (
        <div key={s.id} className="card" style={{ display: "grid", gap: 12 }}>
          <button className="ru-acc" aria-expanded={openId === s.id} onClick={() => setOpenId(openId === s.id ? null : s.id)}>
            <span>
              {s.emoji} {s.title}
            </span>
            <span aria-hidden="true">{openId === s.id ? "−" : "+"}</span>
          </button>
          {openId === s.id &&
            s.tables.map((t) => (
              <div key={t.id} style={{ display: "grid", gap: 6 }}>
                <b>{t.title}</b>
                {t.intro && <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>{t.intro}</p>}
                <div className="ru-tbl">
                  <table>
                    <thead>
                      <tr>
                        {t.head.map((h, k) => (
                          <th key={k} lang="ru">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((row, k) => (
                        <tr key={k}>
                          {row.map((c, j) => (
                            <td key={j} lang="ru">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {t.note && <p className="ru-note">{t.note}</p>}
              </div>
            ))}
        </div>
      ))}
      {mine.length > 0 && (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>📘 Darslarimdagi qoidalar</h2>
          {mine.map((l) => (
            <div key={l.id} style={{ display: "grid", gap: 6 }}>
              <small style={{ color: "var(--muted)", fontWeight: 600 }}>
                {l.topic} · {fmtDate(l.date)}
              </small>
              {l.grammar.map((g, k) => (
                <GrammarCard key={k} g={g} />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============================== Sozlamalar ============================== */
function RuSettings({ me, setMe, onClose }: { me: Me; setMe: (m: Me) => void; onClose: () => void }) {
  const { toast } = useStore();
  const save = async (patch: Record<string, unknown>) => {
    const next = { ...me } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) next[k] = typeof v === "boolean" ? (v ? 1 : 0) : v;
    setMe(next as unknown as Me);
    await api("/api/me", "PATCH", patch).catch((e) => toast("Xatolik: " + (e as Error).message));
  };
  const times = Array.from({ length: 30 }, (_, i) => {
    const m = 8 * 60 + i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
  });
  return (
    <Sheet title="Rus tili sozlamalari" onClose={onClose}>
      <div className="form">
        <label className="row" style={{ background: "var(--surface-2)", borderRadius: 14, cursor: "pointer" }}>
          <span className="body">
            <span className="t">Takrorlash eslatmasi</span>
            <span className="m">Takrorlanadigan so&apos;z bo&apos;lsa va bugun hali mashq qilmagan bo&apos;lsangiz</span>
          </span>
          <input type="checkbox" checked={!!me.ru_remind} onChange={(e) => save({ ru_remind: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--brand)" }} />
        </label>
        {!!me.ru_remind && (
          <Field label="Eslatma vaqti" htmlFor="rut">
            <select id="rut" value={me.ru_remind_time} onChange={(e) => save({ ru_remind_time: e.target.value })}>
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        )}
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Botga dars rasmini yuborsangiz — dars, so&apos;zlar va mashqlar avtomatik qo&apos;shiladi. So&apos;z qo&apos;shish: <code>/soz книга - kitob</code>
        </p>
        <button className="btn soft" onClick={onClose}>
          Tayyor
        </button>
      </div>
    </Sheet>
  );
}

function fmtDate(d: string) {
  const s = d.slice(0, 10);
  const [y, m, day] = s.split("-").map(Number);
  const M = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
  return `${day}-${M[m - 1]}${y !== new Date().getFullYear() ? " " + y : ""}`;
}
