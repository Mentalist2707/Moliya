"use client";

/**
 * Rus tili 2.0 — o'yin uslubidagi so'z yodlash:
 *  O'rganish: kunlik maqsad, streak, daraja, bitta "Davom etish" tugmasi va bosqichlar yo'li
 *  Lug'at:    barcha so'zlar, qidiruv, tahrirlash
 *  Natijalar: haftalik XP, aniqlik, qiyin so'zlar
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { todayStr } from "@/lib/format";
import {
  buildUnits, GENDER_LABEL, isDueReview, ruStreak, shuffle, STATE_LABEL, wordState, xpLevel,
  type RuData, type RuUnit, type RuWord, type WordState,
} from "@/lib/ru";
import { api, Chips, Confirm, Empty, Field, Foot, Seg, Sheet, useStore, useSubmit } from "./ui";
import { I } from "./icons";
import type { Me } from "./Settings";
import { autoplay, canSpeak, post, setAutoplay, speak } from "./ruCtx";
import Session, { setSfx, sfxOn, type SessionKind } from "./RuSession";

type Sub = "learn" | "dict" | "stats";
type Run = { kind: SessionKind; title: string; words: RuWord[] };

const GTAG: Record<string, string> = { m: "м", f: "ж", n: "ср", pl: "мн" };
const dayAdd = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export default function Russian({ me, setMe }: { me: Me | null; setMe: (m: Me) => void }) {
  const { toast } = useStore();
  const [r, setR] = useState<RuData | null>(null);
  const [err, setErr] = useState("");
  const [sub, setSub] = useState<Sub>("learn");
  const [run, setRun] = useState<Run | null>(null);
  const [settings, setSettings] = useState(false);
  const [edit, setEdit] = useState<RuWord | "new" | null>(null);

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

  const today = todayStr();
  const units = useMemo(() => (r ? buildUnits(r.words, r.lessons) : []), [r]);
  const xpToday = Number(r?.log.find((l) => l.date.slice(0, 10) === today)?.xp ?? 0);
  const xpTotal = r?.log.reduce((a, l) => a + Number(l.xp ?? 0), 0) ?? 0;
  const goal = me?.ru_daily_xp || 50;

  if (err) return <div className="card"><Empty emoji="⚠️" text={err} btn="Qayta urinish" onAdd={reload} /></div>;
  if (!r) return <div className="card"><Empty emoji="⏳" text="Yuklanmoqda…" /></div>;

  const start = (kind: SessionKind, title: string, words: RuWord[]) => {
    if (!words.length) return toast("Bu yerda hozircha so'z yo'q");
    setRun({ kind, title, words });
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Rus tili</h1>
          <p>
            {r.words.length} ta so&apos;z · {units.length} ta bo&apos;lim
          </p>
        </div>
        <button className="more" aria-label="Sozlamalar" onClick={() => setSettings(true)}>
          <I.gear />
        </button>
      </div>
      <Seg
        label="Bo'lim"
        value={sub}
        onChange={setSub}
        options={[
          { v: "learn", t: "O'rganish" },
          { v: "dict", t: "Lug'at" },
          { v: "stats", t: "Natijalar" },
        ]}
      />
      {sub === "learn" && <Learn r={r} units={units} today={today} xpToday={xpToday} xpTotal={xpTotal} goal={goal} start={start} />}
      {sub === "dict" && <Dict r={r} units={units} onEdit={setEdit} start={start} />}
      {sub === "stats" && <Stats r={r} today={today} xpTotal={xpTotal} goal={goal} start={start} />}
      {sub === "dict" && (
        <button className="fab" aria-label="So'z qo'shish" onClick={() => setEdit("new")}>
          <I.plus />
        </button>
      )}

      {run && (
        <Session
          {...run}
          pool={r.words}
          goal={goal}
          xpToday={xpToday}
          onSaved={reload}
          onClose={() => {
            setRun(null);
            reload();
          }}
        />
      )}
      {edit && <WordForm w={edit === "new" ? undefined : edit} units={units} onClose={() => setEdit(null)} onSaved={reload} />}
      {settings && me && <RuSettings me={me} setMe={setMe} onClose={() => setSettings(false)} />}
    </>
  );
}

/* ============================== O'rganish ============================== */

function Learn({
  r, units, today, xpToday, xpTotal, goal, start,
}: {
  r: RuData; units: RuUnit[]; today: string; xpToday: number; xpTotal: number; goal: number;
  start: (k: SessionKind, t: string, w: RuWord[]) => void;
}) {
  const { toast } = useStore();
  const { streak } = ruStreak(r.log, today);
  const lv = xpLevel(xpTotal);
  const due = r.words.filter((w) => isDueReview(w, today)).sort((a, b) => a.due.localeCompare(b.due) || a.ivl - b.ivl);
  const hard = r.words.filter((w) => w.lapses > 0 && w.reps > 0).sort((a, b) => b.lapses - a.lapses);
  const learned = r.words.filter((w) => w.reps > 0);
  const nextNode = units.flatMap((u) => u.nodes.filter((n) => n.state === "open").map((n) => ({ u, n })))[0];
  const pct = Math.min(100, (xpToday / goal) * 100);

  // Asosiy tugma: avval takrorlash (xotira so'nmasin), keyin yangi bosqich
  const main = due.length
    ? { t: "Takrorlash", s: `${Math.min(due.length, 12)} ta so'z esdan chiqyapti`, go: () => start("review", "Takrorlash", due.slice(0, 12)) }
    : nextNode
      ? { t: "Davom etish", s: `${nextNode.u.title} · ${nextNode.n.idx + 1}-bosqich`, go: () => start("learn", `${nextNode.n.idx + 1}-bosqich`, nextNode.n.words.filter((w) => w.reps === 0)) }
      : learned.length
        ? { t: "Mashq qilish", s: "Hammasi o'rganilgan — mustahkamlaymiz", go: () => start("practice", "Mashq", shuffle(learned).slice(0, 8)) }
        : null;

  return (
    <>
      <div className="card ru-hero">
        <div className="ru-ring" style={{ "--p": pct } as React.CSSProperties} aria-label={`Bugun ${xpToday} / ${goal} XP`}>
          <div>
            <b className="num">{xpToday}</b>
            <small>/{goal} XP</small>
          </div>
        </div>
        <div className="ru-hero-side">
          <div className={"ru-streak" + (streak ? " on" : "")}>
            <span aria-hidden="true">🔥</span>
            <b>{streak}</b>
            <small>kun ketma-ket</small>
          </div>
          <div className="ru-level">
            <span className="ru-lv">{lv.level}</span>
            <div style={{ flex: 1, display: "grid", gap: 4 }}>
              <small>
                {lv.level}-daraja · {lv.into}/{lv.need} XP
              </small>
              <div className="rs-prog thin">
                <b style={{ width: (lv.into / lv.need) * 100 + "%" }} />
              </div>
            </div>
          </div>
          <small className="ru-tip">
            {pct >= 100 ? "🎯 Bugungi maqsad bajarildi! Zo'r!" : streak && xpToday === 0 ? "Streak'ni yo'qotmang — bitta sessiya yetadi" : `Maqsadgacha ${Math.max(0, goal - xpToday)} XP`}
          </small>
        </div>
      </div>

      {main && (
        <button className="ru-cta" onClick={main.go}>
          <span>
            <b>{main.t}</b>
            <small>{main.s}</small>
          </span>
          <span className="ru-cta-go" aria-hidden="true">
            ▶
          </span>
        </button>
      )}

      <div className="ru-quick">
        <button disabled={!due.length} onClick={() => start("review", "Takrorlash", due.slice(0, 12))}>
          <b>🔁</b>
          <span>Takrorlash</span>
          <small>{due.length ? `${due.length} ta` : "yo'q"}</small>
        </button>
        <button disabled={!hard.length} onClick={() => start("practice", "Qiyin so'zlar", hard.slice(0, 8))}>
          <b>🎯</b>
          <span>Xatolarim</span>
          <small>{hard.length ? `${hard.length} ta` : "yo'q"}</small>
        </button>
        <button disabled={learned.length < 4} onClick={() => start("practice", "Tezkor mashq", shuffle(learned).slice(0, 8))}>
          <b>⚡</b>
          <span>Tezkor</span>
          <small>8 ta so&apos;z</small>
        </button>
      </div>

      {!units.length && (
        <div className="card">
          <Empty emoji="📷" text="Hali so'z yo'q. Lug'at rasmini yuboring yoki «Lug'at» bo'limida qo'lda qo'shing." />
        </div>
      )}

      {units.map((u, ui) => (
        <section key={u.id ?? "x"} className="ru-unit" style={{ "--u": `var(${UNIT_COLORS[ui % UNIT_COLORS.length]})` } as React.CSSProperties}>
          <header>
            <div>
              <small>{ui + 1}-bo&apos;lim</small>
              <h2>{u.title}</h2>
            </div>
            <span className="ru-unit-n num">
              {u.learned}/{u.words.length}
            </span>
          </header>
          <div className="ru-path">
            {u.nodes.map((n) => {
              const label = `${n.idx + 1}-bosqich: ${n.words.map((w) => w.ru).join(", ")}`;
              return (
                <div key={n.idx} className="ru-node-wrap" style={{ "--x": PATH_X[n.idx % PATH_X.length] } as React.CSSProperties}>
                  {n.state === "open" && <span className="ru-start">BOSHLASH</span>}
                  <button
                    className={"ru-node " + n.state}
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      if (n.state === "locked") return toast("🔒 Avval oldingi bosqichni tugating");
                      if (n.state === "open") start("learn", `${n.idx + 1}-bosqich`, n.words.filter((w) => w.reps === 0));
                      else start("practice", `${n.idx + 1}-bosqich · takror`, n.words);
                    }}
                  >
                    {n.state === "done" ? "★" : n.state === "locked" ? "🔒" : n.idx + 1}
                    {n.state === "open" && n.done > 0 && (
                      <i className="ru-node-arc" style={{ "--p": (n.done / n.words.length) * 100 } as React.CSSProperties} />
                    )}
                  </button>
                </div>
              );
            })}
            <div className="ru-node-wrap" style={{ "--x": PATH_X[u.nodes.length % PATH_X.length] } as React.CSSProperties}>
              <span className={"ru-chest" + (u.learned === u.words.length ? " open" : "")} aria-label="Bo'lim yakuni">
                {u.learned === u.words.length ? "🏆" : "🎁"}
              </span>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

const UNIT_COLORS = ["--brand", "--tasks", "--money", "--books", "--habit", "--notes"];
const PATH_X = ["0px", "52px", "78px", "52px", "0px", "-52px", "-78px", "-52px"];

/* ============================== Lug'at ============================== */

type Filter = "all" | WordState | "hard";

function Dict({ r, units, onEdit, start }: { r: RuData; units: RuUnit[]; onEdit: (w: RuWord) => void; start: (k: SessionKind, t: string, w: RuWord[]) => void }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const match = (w: RuWord) => {
    if (f === "hard" ? w.lapses === 0 : f !== "all" && wordState(w) !== f) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return w.ru.toLowerCase().includes(s) || w.uz.toLowerCase().includes(s);
  };
  const groups = units.map((u) => ({ u, ws: u.words.filter(match) })).filter((g) => g.ws.length);
  const count = (s: Filter) => r.words.filter((w) => (s === "all" ? true : s === "hard" ? w.lapses > 0 : wordState(w) === s)).length;

  return (
    <>
      <input className="ru-search" type="search" placeholder="🔍 So'z qidirish (ruscha yoki o'zbekcha)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />
      <Chips
        value={f}
        onChange={setF}
        options={[
          { v: "all", t: `Hammasi ${count("all")}` },
          { v: "new", t: `Yangi ${count("new")}` },
          { v: "learning", t: `O'rganilmoqda ${count("learning")}` },
          { v: "known", t: `Yod ${count("known")}` },
          { v: "hard", t: `Qiyin ${count("hard")}` },
        ]}
      />
      {!groups.length && (
        <div className="card">
          <Empty emoji="🔍" text={r.words.length ? "Hech narsa topilmadi" : "Hali so'z yo'q"} />
        </div>
      )}
      {groups.map(({ u, ws }) => {
        const learned = ws.filter((w) => w.reps > 0);
        return (
          <div className="card flush" key={u.id ?? "x"}>
            <h2>
              <span style={{ fontSize: 16 }}>{u.title}</span>
              {learned.length >= 4 && (
                <button className="link" onClick={() => start("practice", u.title, shuffle(learned).slice(0, 10))}>
                  Mashq ▶
                </button>
              )}
            </h2>
            {ws.map((w) => {
              const st = wordState(w);
              return (
                <div key={w.id} className="row ru-row" role="button" tabIndex={0} onClick={() => onEdit(w)} onKeyDown={(e) => e.key === "Enter" && onEdit(w)}>
                  <button
                    className="ru-say"
                    aria-label={`${w.ru} — tinglash`}
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(w.ru);
                    }}
                  >
                    🔊
                  </button>
                  <span className="body">
                    <span className="t">
                      {w.ru} {w.gender && <small className="ru-g">{GTAG[w.gender]}</small>}
                    </span>
                    <span className="m">{w.uz}</span>
                  </span>
                  {w.lapses > 0 && <span className="pill bad" title="Xatolar soni">✗{w.lapses}</span>}
                  <span className={"ru-st " + st}>{STATE_LABEL[st]}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function WordForm({ w, units, onClose, onSaved }: { w?: RuWord; units: RuUnit[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [del, setDel] = useState(false);
  const { busy, err, run } = useSubmit(async (d) => {
    if (w) await post({ action: "word.update", id: w.id, ...d });
    else {
      const res = await post<{ added: number }>({ action: "word.add", ...d, lesson_id: d.lesson_id ? Number(d.lesson_id) : null });
      if (!res.added) throw new Error("Bu so'z lug'atda bor");
    }
    toast(w ? "Saqlandi" : "So'z qo'shildi");
    onSaved();
    onClose();
  });
  if (del && w)
    return (
      <Confirm
        text={`«${w.ru}» lug'atdan o'chiriladi.`}
        onClose={() => setDel(false)}
        onYes={async () => {
          await post({ action: "word.delete", id: w.id });
          onSaved();
          onClose();
        }}
      />
    );
  return (
    <Sheet title={w ? "So'zni tahrirlash" : "Yangi so'z"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          run(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <Field label="Ruscha" htmlFor="wru">
          <input id="wru" name="ru" defaultValue={w?.ru} required lang="ru" autoComplete="off" placeholder="книга" />
        </Field>
        <Field label="O'zbekcha" htmlFor="wuz" hint="Bir nechta ma'no bo'lsa vergul bilan: yechim, qaror">
          <input id="wuz" name="uz" defaultValue={w?.uz} required autoComplete="off" placeholder="kitob" />
        </Field>
        <Field label="Rod" htmlFor="wg">
          <select id="wg" name="gender" defaultValue={w?.gender ?? ""}>
            <option value="">—</option>
            {Object.entries(GENDER_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Misol gap (ixtiyoriy)" htmlFor="wex">
          <input id="wex" name="example" defaultValue={w?.example ?? ""} lang="ru" autoComplete="off" placeholder="Я читаю книгу." />
        </Field>
        {!w && units.some((u) => u.id) && (
          <Field label="Bo'lim" htmlFor="wl">
            <select id="wl" name="lesson_id" defaultValue={units.filter((u) => u.id).at(-1)?.id ?? ""}>
              {units
                .filter((u) => u.id)
                .map((u) => (
                  <option key={u.id} value={u.id!}>
                    {u.title}
                  </option>
                ))}
              <option value="">Boshqa so&apos;zlar</option>
            </select>
          </Field>
        )}
        {w && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            {STATE_LABEL[wordState(w)]} · {w.reps} marta takrorlangan · {w.lapses} xato · keyingi: {w.due.slice(0, 10)}
          </p>
        )}
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={w ? () => setDel(true) : undefined} />
      </form>
    </Sheet>
  );
}

/* ============================== Natijalar ============================== */

function Stats({ r, today, xpTotal, goal, start }: { r: RuData; today: string; xpTotal: number; goal: number; start: (k: SessionKind, t: string, w: RuWord[]) => void }) {
  const { streak } = ruStreak(r.log, today);
  const byDay = new Map(r.log.map((l) => [l.date.slice(0, 10), l]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = dayAdd(today, i - 6);
    return { d, xp: Number(byDay.get(d)?.xp ?? 0), rev: Number(byDay.get(d)?.reviews ?? 0) };
  });
  const maxXp = Math.max(goal, ...week.map((w) => w.xp));
  const last30 = r.log.filter((l) => l.date.slice(0, 10) > dayAdd(today, -30));
  const rev30 = last30.reduce((a, l) => a + l.reviews, 0);
  const acc = rev30 ? Math.round((last30.reduce((a, l) => a + l.correct, 0) / rev30) * 100) : null;
  // Eng uzun streak
  const days = [...byDay.values()].filter((l) => l.reviews > 0).map((l) => l.date.slice(0, 10)).sort();
  let best = 0;
  let cur = 0;
  days.forEach((d, i) => {
    cur = i && dayAdd(days[i - 1], 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
  });
  const st = { new: 0, learning: 0, known: 0 } as Record<WordState, number>;
  r.words.forEach((w) => st[wordState(w)]++);
  const hard = r.words.filter((w) => w.lapses > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 8);
  const lv = xpLevel(xpTotal);
  const WD = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
  const total = r.words.length || 1;

  return (
    <>
      <div className="ru-tiles">
        <div>
          <small>Jami XP</small>
          <b className="num">{xpTotal}</b>
        </div>
        <div>
          <small>Daraja</small>
          <b>{lv.level}</b>
        </div>
        <div>
          <small>Streak</small>
          <b>🔥 {streak}</b>
        </div>
        <div>
          <small>Rekord</small>
          <b>{best} kun</b>
        </div>
      </div>

      <div className="card">
        <h2>Shu hafta</h2>
        <div className="ru-week" role="img" aria-label={week.map((w) => `${w.d}: ${w.xp} XP`).join(", ")}>
          <i className="ru-goal-line" style={{ bottom: `calc(${(goal / maxXp) * 100}% * .82 + 22px)` }} />
          {week.map((w) => (
            <div key={w.d} className={w.d === today ? "today" : ""}>
              <span className="num">{w.xp || ""}</span>
              <b style={{ height: `${(w.xp / maxXp) * 100}%`, opacity: w.xp >= goal ? 1 : 0.55 }} />
              <small>{WD[new Date(w.d + "T00:00:00Z").getUTCDay()]}</small>
            </div>
          ))}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Chiziq — kunlik maqsad ({goal} XP){acc !== null ? ` · 30 kunda aniqlik ${acc}%` : ""}
        </p>
      </div>

      <div className="card">
        <h2>So&apos;zlar</h2>
        <div className="ru-stack" aria-hidden="true">
          <b className="known" style={{ width: (st.known / total) * 100 + "%" }} />
          <b className="learning" style={{ width: (st.learning / total) * 100 + "%" }} />
        </div>
        <div className="ru-legend">
          <span>
            <i className="known" /> Yod: <b>{st.known}</b>
          </span>
          <span>
            <i className="learning" /> O&apos;rganilmoqda: <b>{st.learning}</b>
          </span>
          <span>
            <i /> Yangi: <b>{st.new}</b>
          </span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>«Yod» — 3 haftadan ko&apos;p vaqt esda turgan so&apos;zlar.</p>
      </div>

      {!!hard.length && (
        <div className="card flush">
          <h2>
            <span>Qiyin so&apos;zlar</span>
            <button className="link" onClick={() => start("practice", "Qiyin so'zlar", hard)}>
              Mashq ▶
            </button>
          </h2>
          {hard.map((w) => (
            <div key={w.id} className="row">
              <span className="body">
                <span className="t">{w.ru}</span>
                <span className="m">{w.uz}</span>
              </span>
              <span className="pill bad">✗{w.lapses}</span>
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
  const [ap, setAp] = useState(autoplay());
  const [sfx, setS] = useState(sfxOn());
  const Toggle = ({ t, m, on, set }: { t: string; m: string; on: boolean; set: (v: boolean) => void }) => (
    <label className="row" style={{ background: "var(--surface-2)", borderRadius: 14, cursor: "pointer" }}>
      <span className="body">
        <span className="t">{t}</span>
        <span className="m">{m}</span>
      </span>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--brand)" }} />
    </label>
  );
  return (
    <Sheet title="Rus tili sozlamalari" onClose={onClose}>
      <div className="form">
        <Field label="Kunlik maqsad" htmlFor="rxp" hint="1 ta sessiya ≈ 60–150 XP">
          <select id="rxp" value={me.ru_daily_xp || 50} onChange={(e) => save({ ru_daily_xp: Number(e.target.value) })}>
            {[
              [20, "Yengil"],
              [50, "Oddiy"],
              [100, "Jiddiy"],
              [150, "Kuchli"],
              [250, "Ekstremal"],
            ].map(([n, t]) => (
              <option key={n} value={n}>
                {t} — {n} XP
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kuniga yangi so'z (bot eslatmasi uchun)" htmlFor="rdn">
          <select id="rdn" value={me.ru_daily_new ?? 15} onChange={(e) => save({ ru_daily_new: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n} ta
              </option>
            ))}
          </select>
        </Field>
        {canSpeak() && (
          <Toggle
            t="🔊 So'zni avtomatik o'qish"
            m="Ruscha talaffuzni eshitasiz"
            on={ap}
            set={(v) => {
              setAp(v);
              setAutoplay(v);
            }}
          />
        )}
        <Toggle
          t="🎵 Ovoz effektlari"
          m="To'g'ri/xato javobda qisqa signal"
          on={sfx}
          set={(v) => {
            setS(v);
            setSfx(v);
          }}
        />
        <Toggle t="⏰ Telegram eslatmasi" m="Bugun hali mashq qilmagan bo'lsangiz" on={!!me.ru_remind} set={(v) => save({ ru_remind: v })} />
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
          Botda: <code>/test</code> — 5 ta savol, <code>/soz книга - kitob</code> — so&apos;z qo&apos;shish, <code>/rus</code> — bugungi holat.
        </p>
        <button className="btn soft" onClick={onClose}>
          Tayyor
        </button>
      </div>
    </Sheet>
  );
}
