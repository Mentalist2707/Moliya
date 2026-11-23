"use client";

import { useEffect, useMemo, useState } from "react";
import type { Book } from "@/lib/types";
import { readingStats, etaMinutes, hm, LEVELS } from "@/lib/reading";
import { todayStr } from "@/lib/format";
import { api, Bar, Confirm, Empty, Field, Foot, Sheet, useStore, useSubmit } from "./ui";
import { BookCover } from "./BookCover";
import type { Me } from "./Settings";

/* ================= O'qish markazi (Kutubxona tepasidagi karta) ================= */
export function ReadingHub({ me, setMe }: { me: Me | null; setMe: (m: Me) => void }) {
  const { d } = useStore();
  const today = todayStr();
  const st = useMemo(() => readingStats(d, today), [d, today]);
  const [sheet, setSheet] = useState<null | "timer" | "badges" | "quotes" | "goals">(null);
  const goal = me?.read_goal || 0;
  const yearGoal = me?.read_year_goal || 0;
  const dayOfYear = Math.floor((Date.parse(today) - Date.parse(today.slice(0, 4) + "-01-01")) / 86400000) + 1;
  const expected = yearGoal ? (yearGoal * dayOfYear) / 365 : 0;
  const diff = Math.round((st.year.books - expected) * 10) / 10;
  const earned = st.badges.filter((b) => b.have).length;
  useNewBadges(st.badges);

  const R = 30;
  const C = 2 * Math.PI * R;
  const pct = goal ? Math.min(1, st.todayPages / goal) : st.readToday ? 1 : 0;

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="ring" style={{ width: 76, height: 76, flex: "none" }} role="img" aria-label={`Bugun ${st.todayPages} sahifa`}>
            <svg viewBox="0 0 76 76">
              <circle cx="38" cy="38" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
              <circle cx="38" cy="38" r={R} fill="none" stroke="var(--books)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
            </svg>
            <div className="lab" style={{ fontSize: 18 }}>
              {st.todayPages}
              <small>{goal ? `/${goal}` : "bet"}</small>
            </div>
          </div>
          <div style={{ flex: 1, display: "grid", gap: 2 }}>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: st.streak ? "var(--brand)" : "var(--muted)" }}>
              🔥 {st.streak} kun
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {st.readToday ? "Bugun o'qildi — zanjir davom etyapti" : st.streak ? "Bugun o'qisangiz zanjir davom etadi" : "Bugun o'qib, streakni boshlang"}
              {st.best > st.streak ? ` · rekord ${st.best}` : ""}
            </span>
          </div>
        </div>

        <button className="btn brand block" onClick={() => setSheet("timer")}>
          ⏱ O&apos;qishni boshlash
        </button>

        <button
          onClick={() => setSheet("badges")}
          style={{ border: 0, background: "var(--surface-2)", borderRadius: 14, padding: 12, display: "grid", gap: 6, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}
        >
          <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 700 }}>
            <span>
              {st.lvl.emoji} {st.lvl.n}-daraja · {st.lvl.name}
            </span>
            <span className="num" style={{ color: "var(--muted)", fontWeight: 600, fontSize: 13 }}>
              {st.xp} XP
            </span>
          </span>
          <Bar pct={st.lvl.pct} color="var(--books)" />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {st.lvl.next ? `${st.lvl.next.name} darajasiga ${st.lvl.next.xp - st.xp} XP` : "Eng yuqori daraja!"} · 🏅 {earned}/{st.badges.length} nishon
          </span>
        </button>

        {yearGoal > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 700 }}>
              <span>
                {st.year.year} challenge: {st.year.books}/{yearGoal} kitob
              </span>
              <span style={{ color: diff >= 0 ? "var(--money)" : "var(--warn)", fontSize: 13 }}>
                {diff >= 0 ? `rejadan ${diff} oldinda` : `rejadan ${Math.abs(diff)} orqada`}
              </span>
            </div>
            <div className="bar" style={{ position: "relative", height: 10 }}>
              <b style={{ width: Math.min(100, (st.year.books / yearGoal) * 100) + "%", background: "var(--books)" }} />
              <i style={{ position: "absolute", top: -3, bottom: -3, width: 2, background: "var(--ink)", left: Math.min(100, (expected / yearGoal) * 100) + "%" }} aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="acts">
          <button className="btn sm soft" onClick={() => setSheet("quotes")}>
            💬 Iqtiboslar · {d.quotes.length}
          </button>
          <button className="btn sm soft" onClick={() => setSheet("badges")}>
            🏅 Nishonlar
          </button>
          <button className="btn sm soft" onClick={() => setSheet("goals")}>
            🎯 Maqsadlar
          </button>
        </div>
      </div>

      {sheet === "timer" && <TimerSheet onClose={() => setSheet(null)} pph={st.pph} />}
      {sheet === "badges" && <BadgesSheet st={st} onClose={() => setSheet(null)} />}
      {sheet === "quotes" && <QuotesSheet onClose={() => setSheet(null)} />}
      {sheet === "goals" && me && <GoalsSheet me={me} setMe={setMe} onClose={() => setSheet(null)} />}
    </>
  );
}

/* ================= Yangi nishon olinganda tabrik ================= */
function useNewBadges(badges: { id: string; emoji: string; title: string; have: boolean }[]) {
  const { toast } = useStore();
  const ids = badges.filter((b) => b.have).map((b) => b.id).join(",");
  useEffect(() => {
    try {
      const key = "moliya_badges_seen";
      const raw = localStorage.getItem(key);
      const have = ids ? ids.split(",") : [];
      if (raw === null) {
        localStorage.setItem(key, ids); // birinchi marta — jim saqlaymiz
        return;
      }
      const seen = new Set(raw.split(",").filter(Boolean));
      const fresh = have.filter((x) => !seen.has(x));
      if (fresh.length) {
        const b = badges.find((x) => x.id === fresh[0])!;
        toast(`🏅 Yangi nishon: ${b.emoji} ${b.title}!`);
        localStorage.setItem(key, ids);
      }
    } catch {
      /* localStorage yo'q — muhim emas */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
}

/* ================= Fokus taymer ================= */
type TimerState = { bookId: number; start: number; paused: number; pausedAt: number | null };
const TKEY = "moliya_read_timer";
const loadT = (): TimerState | null => {
  try {
    return JSON.parse(localStorage.getItem(TKEY) || "null");
  } catch {
    return null;
  }
};
const saveT = (t: TimerState | null) => {
  try {
    if (t) localStorage.setItem(TKEY, JSON.stringify(t));
    else localStorage.removeItem(TKEY);
  } catch {
    /* */
  }
};

function TimerSheet({ onClose, pph }: { onClose: () => void; pph: number | null }) {
  const { d } = useStore();
  const reading = d.books.filter((b) => b.status === "oqiyapman");
  const options = reading.length ? reading : d.books.filter((b) => b.status === "reja");
  const [t, setT] = useState<TimerState | null>(() => loadT());
  const [bookId, setBookId] = useState<number>(t?.bookId ?? options[0]?.id ?? 0);
  const [now, setNow] = useState(Date.now());
  const [finish, setFinish] = useState(false);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const book = d.books.find((b) => b.id === (t?.bookId ?? bookId));
  const elapsed = t ? Math.max(0, (t.pausedAt ?? now) - t.start - t.paused) : 0;
  const sec = Math.floor(elapsed / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const FOCUS = 25 * 60;
  const R = 90;
  const C = 2 * Math.PI * R;
  const set = (x: TimerState | null) => {
    saveT(x);
    setT(x);
  };

  if (!options.length) {
    return (
      <Sheet title="O'qish taymeri" onClose={onClose}>
        <Empty emoji="📚" text="Avval «O'qiyapman» yoki «O'qimoqchiman» ro'yxatiga kitob qo'shing." />
      </Sheet>
    );
  }
  if (finish && book) {
    return <PageForm book={book} minutes={Math.max(1, Math.round(sec / 60))} onClose={() => (set(null), onClose())} title="Qaysi sahifaga yetdingiz?" />;
  }
  return (
    <Sheet title="O'qish taymeri" onClose={onClose}>
      <div className="form" style={{ justifyItems: "center" }}>
        {!t && (
          <div className="field" style={{ width: "100%" }}>
            <label htmlFor="tb">Kitob</label>
            <select id="tb" value={bookId} onChange={(e) => setBookId(Number(e.target.value))}>
              {options.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                  {b.total_pages ? ` (${b.current_page}/${b.total_pages})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="ring" style={{ width: 210, height: 210 }}>
          <svg viewBox="0 0 210 210">
            <circle cx="105" cy="105" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
            <circle
              cx="105"
              cy="105"
              r={R}
              fill="none"
              stroke={sec >= FOCUS ? "var(--money)" : "var(--books)"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(1, sec / FOCUS))}
            />
          </svg>
          <div className="lab" style={{ fontSize: 44 }}>
            <span className="num">
              {mm}:{ss}
            </span>
            <small>{sec >= FOCUS ? "25 daqiqa! 🎉" : t?.pausedAt ? "pauza" : t ? "fokus: 25 daq" : "tayyor"}</small>
          </div>
        </div>
        {book && (
          <div style={{ textAlign: "center", fontSize: 14, color: "var(--muted)" }}>
            <b style={{ color: "var(--ink)" }}>{book.title}</b>
            {book.total_pages ? ` · ${book.current_page}/${book.total_pages}` : ""}
            {etaMinutes(book, pph) !== null && <div>Tugashiga ≈ {hm(etaMinutes(book, pph)!)} (tezligingiz {Math.round(pph!)} bet/soat)</div>}
          </div>
        )}
        <div className="acts" style={{ justifyContent: "center", width: "100%" }}>
          {!t ? (
            <button className="btn brand" style={{ minWidth: 200 }} onClick={() => set({ bookId, start: Date.now(), paused: 0, pausedAt: null })}>
              ▶ Boshlash
            </button>
          ) : (
            <>
              {t.pausedAt ? (
                <button className="btn soft" onClick={() => set({ ...t, paused: t.paused + (Date.now() - t.pausedAt!), pausedAt: null })}>
                  ▶ Davom
                </button>
              ) : (
                <button className="btn soft" onClick={() => set({ ...t, pausedAt: Date.now() })}>
                  ⏸ Pauza
                </button>
              )}
              <button className="btn brand" onClick={() => setFinish(true)}>
                ✓ Tugatdim
              </button>
              <button className="btn soft" onClick={() => set(null)} aria-label="Bekor qilish">
                ✕
              </button>
            </>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>Taymer ilovani yopsangiz ham davom etadi.</p>
      </div>
    </Sheet>
  );
}

/* ================= Sahifa yangilash + kitob tugaganda xulosa ================= */
export function PageForm({ book, onClose, minutes = 0, title }: { book: Book; onClose: () => void; minutes?: number; title?: string }) {
  const { act, d } = useStore();
  const [page, setPage] = useState(String(book.current_page || ""));
  const [done, setDone] = useState<{ delta: number; finished: boolean } | null>(null);
  const { busy, err, run } = useSubmit(async (b) => {
    let r: { delta: number; finished: boolean } = { delta: 0, finished: false };
    await act(async () => {
      r = await api("/api/reading", "POST", { book_id: book.id, page: b.page, minutes, date: todayStr() });
    }, undefined);
    setDone(r);
    if (!r.finished) onClose();
  });
  const fresh = d.books.find((x) => x.id === book.id) ?? book;
  if (done?.finished) return <ReflectionForm book={fresh} onClose={onClose} celebrate />;
  return (
    <Sheet title={title ?? book.title} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          run({ page: Number(page) || 0 });
        }}
      >
        <Field label="Qaysi betdasiz?" htmlFor="pg" hint={book.total_pages ? `Jami ${book.total_pages} bet · hozir ${book.current_page}` : undefined}>
          <input id="pg" className="huge" inputMode="numeric" data-autofocus value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <div className="chips">
          {[5, 10, 20, 50].map((n) => (
            <button key={n} type="button" onClick={() => setPage(String((Number(page) || 0) + n))}>
              +{n} bet
            </button>
          ))}
          {book.total_pages ? (
            <button type="button" onClick={() => setPage(String(book.total_pages))}>
              Tugatdim
            </button>
          ) : null}
        </div>
        {minutes > 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>⏱ {minutes} daqiqa o&apos;qidingiz</p>}
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} />
      </form>
    </Sheet>
  );
}

/** Kitob tugaganda: baho + 3 savol */
export function ReflectionForm({ book, onClose, celebrate }: { book: Book; onClose: () => void; celebrate?: boolean }) {
  const { act } = useStore();
  const [rating, setRating] = useState(book.rating || 0);
  const [learned, setLearned] = useState(book.learned ?? "");
  const [apply, setApply] = useState(book.apply ?? "");
  const [recommend, setRecommend] = useState(book.recommend ?? "");
  const { busy, err, run } = useSubmit(async (b) => {
    await act(() => api(`/api/books/${book.id}`, "PATCH", b), "Xulosa saqlandi 📝");
    onClose();
  });
  return (
    <Sheet title={celebrate ? "🎉 Kitob tugadi!" : "Xulosa"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          run({ rating: rating || null, learned, apply, recommend });
        }}
      >
        {celebrate && (
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 64, flex: "none" }}>
              <BookCover b={book} big />
            </div>
            <div>
              <b>{book.title}</b>
              <div style={{ fontSize: 14, color: "var(--muted)" }}>Tabriklaymiz! +50 XP. Fikrlaringizni yozib qo&apos;ying — o&apos;qiganingiz yodda qoladi.</div>
            </div>
          </div>
        )}
        <div className="field">
          <label>Baho</label>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} yulduz`} className={n <= rating ? "on" : ""} onClick={() => setRating(n === rating ? 0 : n)}>
                ★
              </button>
            ))}
          </div>
        </div>
        <Field label="1. Nima o'rgandim?" htmlFor="rf1">
          <textarea id="rf1" value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="Asosiy g'oya, eng esda qolgan fikr…" />
        </Field>
        <Field label="2. Qaysi g'oyani hayotga tatbiq qilaman?" htmlFor="rf2">
          <textarea id="rf2" value={apply} onChange={(e) => setApply(e.target.value)} />
        </Field>
        <Field label="3. Kimga tavsiya qilaman?" htmlFor="rf3">
          <input id="rf3" value={recommend} onChange={(e) => setRecommend(e.target.value)} placeholder="Masalan: talabalarga, akamga…" />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} label="Saqlash" />
      </form>
    </Sheet>
  );
}

/* ================= Nishonlar ================= */
function BadgesSheet({ st, onClose }: { st: ReturnType<typeof readingStats>; onClose: () => void }) {
  return (
    <Sheet title="Daraja va nishonlar" onClose={onClose}>
      <div className="form">
        <div style={{ display: "grid", gap: 6 }}>
          <b>
            {st.lvl.emoji} {st.lvl.n}-daraja · {st.lvl.name} · {st.xp} XP
          </b>
          <Bar pct={st.lvl.pct} color="var(--books)" />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>XP: har sahifa 1 · har kitob 50 · iqtibos 5 · eng uzun streakning har kuni 10</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {LEVELS.map((l, i) => (
              <span key={l.name} className={"pill " + (i + 1 <= st.lvl.n ? "good" : "")} title={`${l.xp} XP`}>
                {l.emoji} {l.name}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {st.badges.map((b) => (
            <div
              key={b.id}
              style={{
                padding: 12,
                borderRadius: 16,
                background: b.have ? "color-mix(in srgb, var(--books) 12%, var(--surface))" : "var(--surface-2)",
                border: b.have ? "1.5px solid var(--books)" : "1.5px solid transparent",
                opacity: b.have ? 1 : 0.65,
                display: "grid",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 28, filter: b.have ? "none" : "grayscale(1)" }}>{b.emoji}</span>
              <b style={{ fontSize: 14 }}>{b.title}</b>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{b.desc}</span>
              {!b.have && b.need > 1 && <Bar pct={(Math.min(b.v, b.need) / b.need) * 100} color="var(--books)" />}
              {!b.have && b.need > 1 && (
                <span className="num" style={{ fontSize: 11, color: "var(--muted)" }}>
                  {Math.min(b.v, b.need)}/{b.need}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/* ================= Iqtiboslar ================= */
function QuotesSheet({ onClose }: { onClose: () => void }) {
  const { d, act } = useStore();
  const [adding, setAdding] = useState(d.quotes.length === 0);
  const [text, setText] = useState("");
  const [bookId, setBookId] = useState<number | "">(d.books.find((b) => b.status === "oqiyapman")?.id ?? "");
  const [page, setPage] = useState("");
  const [del, setDel] = useState<number | null>(null);
  const title = (id: number | null) => d.books.find((b) => b.id === id)?.title;
  return (
    <Sheet title="Iqtiboslar" onClose={onClose}>
      <div className="form">
        {adding ? (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!text.trim()) return;
              await act(() => api("/api/quotes", "POST", { text: text.trim(), book_id: bookId || null, page: Number(page) || null }), "Iqtibos saqlandi 💬");
              setText("");
              setPage("");
              setAdding(false);
            }}
          >
            <div className="field">
              <label htmlFor="qt">Yoqqan jumla</label>
              <textarea id="qt" data-autofocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Kitobdan ko'chiring…" />
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="qb">Kitob</label>
                <select id="qb" value={bookId} onChange={(e) => setBookId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">—</option>
                  {d.books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="qpg">Sahifa</label>
                <input id="qpg" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div className="foot">
              {d.quotes.length > 0 && (
                <button type="button" className="btn soft" onClick={() => setAdding(false)}>
                  Bekor
                </button>
              )}
              <button type="submit" className="btn brand">
                Saqlash
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Bot har kuni ertalab iqtiboslaringizdan birini eslatadi.</p>
          </form>
        ) : (
          <button className="btn brand" onClick={() => setAdding(true)}>
            + Iqtibos qo&apos;shish
          </button>
        )}
        {d.quotes.map((q) => (
          <figure key={q.id} style={{ margin: 0, padding: 14, borderRadius: 16, background: "var(--surface-2)", borderLeft: "4px solid var(--books)", position: "relative" }}>
            <blockquote style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap", paddingRight: 28 }}>«{q.text}»</blockquote>
            {(q.book_id || q.page) && (
              <figcaption style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                — {title(q.book_id) ?? "Kitob"}
                {q.page ? `, ${q.page}-bet` : ""}
              </figcaption>
            )}
            <button className="more" aria-label="O'chirish" onClick={() => setDel(q.id)} style={{ position: "absolute", top: 6, right: 6, width: 32, height: 32 }}>
              ×
            </button>
          </figure>
        ))}
      </div>
      {del !== null && (
        <Confirm
          text="Iqtibos o'chiriladi."
          onClose={() => setDel(null)}
          onYes={async () => {
            await act(() => api(`/api/quotes/${del}`, "DELETE"), "O'chirildi");
            setDel(null);
          }}
        />
      )}
    </Sheet>
  );
}

/* ================= Maqsadlar va eslatma ================= */
function GoalsSheet({ me, setMe, onClose }: { me: Me; setMe: (m: Me) => void; onClose: () => void }) {
  const { toast } = useStore();
  const save = async (patch: Record<string, unknown>) => {
    const next = { ...me } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) next[k] = typeof v === "boolean" ? (v ? 1 : 0) : v;
    setMe(next as unknown as Me);
    await api("/api/me", "PATCH", patch).catch((e) => toast("Xatolik: " + (e as Error).message));
  };
  const times = Array.from({ length: 12 }, (_, i) => {
    const m = 18 * 60 + i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
  });
  return (
    <Sheet title="O'qish maqsadlari" onClose={onClose}>
      <div className="form">
        <div className="field">
          <label htmlFor="rg1">Kunlik maqsad</label>
          <select id="rg1" value={me.read_goal} onChange={(e) => save({ read_goal: Number(e.target.value) })}>
            {[0, 5, 10, 15, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n ? `${n} sahifa / kun` : "Belgilanmagan"}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rg2">{new Date().getFullYear()} yil challenge</label>
          <select id="rg2" value={me.read_year_goal} onChange={(e) => save({ read_year_goal: Number(e.target.value) })}>
            {[0, 6, 12, 20, 24, 30, 36, 52, 100].map((n) => (
              <option key={n} value={n}>
                {n ? `${n} ta kitob${n === 12 ? " (oyiga 1)" : n === 52 ? " (haftasiga 1)" : ""}` : "Belgilanmagan"}
              </option>
            ))}
          </select>
        </div>
        <label className="row" style={{ background: "var(--surface-2)", borderRadius: 14, cursor: "pointer" }}>
          <span className="body">
            <span className="t">Kechki eslatma</span>
            <span className="m">Bugun hali o&apos;qimagan bo&apos;lsangiz — «streak uzilmasin»</span>
          </span>
          <input type="checkbox" checked={!!me.read_remind} onChange={(e) => save({ read_remind: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--brand)" }} />
        </label>
        {!!me.read_remind && (
          <div className="field">
            <label htmlFor="rg3">Eslatma vaqti</label>
            <select id="rg3" value={me.read_remind_time} onChange={(e) => save({ read_remind_time: e.target.value })}>
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
        <label className="row" style={{ background: "var(--surface-2)", borderRadius: 14, cursor: "pointer" }}>
          <span className="body">
            <span className="t">Ertalabki iqtibos</span>
            <span className="m">Saqlagan iqtiboslaringizdan biri har kuni ertalab</span>
          </span>
          <input type="checkbox" checked={!!me.quote_morning} onChange={(e) => save({ quote_morning: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--brand)" }} />
        </label>
        <button className="btn soft" onClick={onClose}>
          Tayyor
        </button>
      </div>
    </Sheet>
  );
}

/* ================= Keyin nima o'qiy? ================= */
export function RandomPick({ onClose }: { onClose: () => void }) {
  const { d, act } = useStore();
  const list = d.books.filter((b) => b.status === "reja");
  const [i, setI] = useState(() => Math.floor(Math.random() * Math.max(1, list.length)));
  const b = list[i % Math.max(1, list.length)];
  return (
    <Sheet title="🎲 Keyin nima o'qiy?" onClose={onClose}>
      {!b ? (
        <Empty emoji="📚" text="«O'qimoqchiman» ro'yxati bo'sh. Avval o'qimoqchi bo'lgan kitoblaringizni qo'shing." />
      ) : (
        <div className="form" style={{ justifyItems: "center", textAlign: "center" }}>
          <div style={{ width: 120 }}>
            <BookCover b={b} big />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 20 }}>{b.title}</h3>
            {(b.author || b.genre) && <div style={{ color: "var(--muted)" }}>{[b.author, b.genre].filter(Boolean).join(" · ")}</div>}
            {b.total_pages ? <div style={{ color: "var(--muted)", fontSize: 14 }}>{b.total_pages} sahifa</div> : null}
          </div>
          <div className="acts" style={{ justifyContent: "center" }}>
            {list.length > 1 && (
              <button className="btn soft" onClick={() => setI((x) => x + 1 + Math.floor(Math.random() * (list.length - 1)))}>
                🎲 Boshqasi
              </button>
            )}
            <button
              className="btn brand"
              onClick={async () => {
                await act(() => api(`/api/books/${b.id}`, "PATCH", { status: "oqiyapman", started: todayStr() }), "Yaxshi mutolaa! 📖");
                onClose();
              }}
            >
              Shuni boshlayman
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ================= Yil yakuni ================= */
export function YearCard() {
  const { d } = useStore();
  const st = useMemo(() => readingStats(d, todayStr()), [d]);
  const y = st.year;
  if (!y.books && !y.pages) return null;
  const items = [
    { k: "Kitob", v: String(y.books) },
    { k: "Sahifa", v: y.pages.toLocaleString("ru-RU") },
    { k: "Eng uzun streak", v: `${st.bestYear} kun` },
    { k: "O'qish vaqti", v: y.minutes ? hm(y.minutes) : "—" },
  ];
  return (
    <div className="card" style={{ background: "linear-gradient(135deg, var(--books), #6b4b8a)", color: "#fff", display: "grid", gap: 12 }}>
      <span style={{ fontWeight: 700, opacity: 0.85 }}>📊 {y.year} yil yakuni</span>
      <div className="grid4" style={{ gap: 8 }}>
        {items.map((it) => (
          <div key={it.k} style={{ background: "rgb(255 255 255 / .14)", borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }} className="num">
              {it.v}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{it.k}</div>
          </div>
        ))}
      </div>
      {(y.favGenre || y.topBook) && (
        <div style={{ fontSize: 14, opacity: 0.95 }}>
          {y.favGenre && (
            <>
              Sevimli janr: <b>{y.favGenre}</b>
            </>
          )}
          {y.favGenre && y.topBook && " · "}
          {y.topBook && (
            <>
              Eng yaxshi kitob: <b>{y.topBook.title}</b>
              {y.topBook.rating ? ` ${"★".repeat(y.topBook.rating)}` : ""}
            </>
          )}
        </div>
      )}
    </div>
  );
}
