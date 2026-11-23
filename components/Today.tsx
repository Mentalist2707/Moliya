"use client";

import { useState } from "react";
import type { Habit, Task } from "@/lib/types";
import { daysLeft, greeting, HAFTA, muddatLabel, OYLAR, som, somShort, todayStr } from "@/lib/format";
import { logSet, streak } from "@/lib/habits";
import { api, Bar, Empty, Sheet, useStore } from "./ui";
import { BookForm, DebtForm, HabitForm, NoteEditor, PageForm, TaskForm, TxForm } from "./forms";
import { HabitCheckRow, TaskRow } from "./Tasks";
import { BookCover } from "./Books";
import { I } from "./icons";
import type { Tab } from "@/lib/nav";
import { Avatar, type Me } from "./Settings";
import { leftText, nextPrayer, PNAME, PrayerChecks, usePrayer } from "./Namoz";
import { usd, usePortfolio } from "./Crypto";

type Quick = "task" | "chiqim" | "kirim" | "note" | "debt" | "book" | "daily" | null;

export default function Today({ go, me, openSettings }: { go: (t: Tab, sub?: string) => void; me: Me | null; openSettings: () => void }) {
  const name = me?.first_name || undefined;
  const { d, act, haptic } = useStore();
  const [quickMenu, setQuickMenu] = useState(false);
  const [quick, setQuick] = useState<Quick>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [habit, setHabit] = useState<Habit | null>(null);
  const [page, setPage] = useState<number | null>(null);

  const now = new Date();
  const today = todayStr();
  const month = today.slice(0, 7);

  // Bugungi vazifalar: muddati bugun/o'tgan va bajarilmagan + bugun bajarilganlar
  const todays = d.tasks.filter((t) => {
    const dl = daysLeft(t.due_date);
    if (!t.done) return dl !== null && dl <= 0;
    return (t.done_at || "").slice(0, 10) === today && t.due_date !== null && (daysLeft(t.due_date) ?? 1) <= 0;
  });
  const important = d.tasks.filter((t) => !t.done && t.priority === "yuqori" && !t.due_date).slice(0, 3);
  const daily = d.habits.filter((h) => h.kind === "daily" && !h.archived);
  const habits = d.habits.filter((h) => h.kind === "habit" && !h.archived);
  const doneSet = new Set(d.habit_logs.filter((l) => l.date.slice(0, 10) === today).map((l) => l.habit_id));

  const totalItems = todays.length + daily.length + habits.length;
  const doneItems = todays.filter((t) => t.done).length + daily.filter((h) => doneSet.has(h.id)).length + habits.filter((h) => doneSet.has(h.id)).length;
  const pct = totalItems ? doneItems / totalItems : 0;

  // Moliya
  const monthTx = d.transactions.filter((t) => t.date.slice(0, 7) === month);
  const spentMonth = monthTx.filter((t) => t.type === "chiqim").reduce((a, t) => a + t.amount, 0);
  const incomeMonth = monthTx.filter((t) => t.type === "kirim").reduce((a, t) => a + t.amount, 0);
  const spentToday = monthTx.filter((t) => t.type === "chiqim" && t.date.slice(0, 10) === today).reduce((a, t) => a + t.amount, 0);
  const left = (x: { amount: number; paid: number }) => Math.max(0, x.amount - x.paid);
  const oweLeft = d.debts.filter((x) => x.direction === "owe").reduce((a, x) => a + left(x), 0);
  const lendLeft = d.debts.filter((x) => x.direction === "lend").reduce((a, x) => a + left(x), 0);
  const dueDebts = d.debts.filter((x) => left(x) > 0 && x.due_date && (daysLeft(x.due_date) ?? 99) <= 7);

  const reading = d.books.filter((b) => b.status === "oqiyapman").slice(0, 2);
  const pinned = d.notes.filter((n) => n.pinned).slice(0, 2);

  const prayer = usePrayer(today);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nx = prayer.data ? nextPrayer(prayer.data.times, nowMin) : null;
  const pf = usePortfolio(d.holdings.length > 0);

  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <>
      <div className="card hero" style={{ position: "relative" }}>
        {me && (
          <button
            onClick={openSettings}
            aria-label="Sozlamalar"
            style={{ position: "absolute", top: 14, right: 14, border: 0, background: "none", padding: 0, borderRadius: "50%" }}
          >
            <Avatar me={me} size={36} />
          </button>
        )}
        <div className="ring" role="img" aria-label={`Bugun ${Math.round(pct * 100)}% bajarildi`}>
          <svg viewBox="0 0 112 112">
            <circle cx="56" cy="56" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
            <circle
              cx="56"
              cy="56"
              r={R}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset .5s ease" }}
            />
          </svg>
          <div className="lab">
            {doneItems}/{totalItems}
            <small>bajarildi</small>
          </div>
        </div>
        <div>
          <h1 style={{ paddingRight: 40 }}>
            {greeting()}
            {name ? `, ${name}` : ""}!
          </h1>
          <p>
            {HAFTA[now.getDay()]}, {now.getDate()}-{OYLAR[now.getMonth()]}
            {totalItems > 0 && doneItems === totalItems ? " · Bugungi reja to'liq bajarildi 🎉" : ""}
          </p>
        </div>
      </div>

      <div className="grid4">
        <button className="kpi" style={{ "--c": "var(--bad)" } as React.CSSProperties} onClick={() => go("moliya", "tx")}>
          <span className="k">Bugun sarf</span>
          <span className="v">{somShort(spentToday)}</span>
          <span className="s">oyda {somShort(spentMonth)}</span>
        </button>
        <button className="kpi" style={{ "--c": "var(--money)" } as React.CSSProperties} onClick={() => go("moliya", "tx")}>
          <span className="k">Oy qoldig&apos;i</span>
          <span className={"v" + (incomeMonth - spentMonth < 0 ? " bad" : "")}>{somShort(incomeMonth - spentMonth)}</span>
          <span className="s">kirim {somShort(incomeMonth)}</span>
        </button>
        <button className="kpi" style={{ "--c": "var(--warn)" } as React.CSSProperties} onClick={() => go("moliya", "debts")}>
          <span className="k">Qarzlarim</span>
          <span className="v">{somShort(oweLeft)}</span>
          <span className="s">menga: {somShort(lendLeft)}</span>
        </button>
        <button className="kpi" style={{ "--c": "var(--tasks)" } as React.CSSProperties} onClick={() => go("vazifalar")}>
          <span className="k">Faol vazifalar</span>
          <span className="v">{d.tasks.filter((t) => !t.done).length}</span>
          <span className="s">{todays.filter((t) => !t.done).length} tasi bugun</span>
        </button>
      </div>

      {pf.data && pf.data.items.length > 0 && (
        <button className="card" onClick={() => go("moliya", "crypto")} style={{ border: 0, textAlign: "left", display: "grid", gap: 4, cursor: "pointer", font: "inherit", color: "inherit" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>💰 Kripto portfel</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {usd(pf.data.value, 2)}
            </span>
            <span className="num" style={{ fontWeight: 800, color: pf.data.dayPnl >= 0 ? "var(--money)" : "var(--bad)" }}>
              {pf.data.dayPnl >= 0 ? "+" : ""}
              {usd(pf.data.dayPnl)} ({pf.data.dayPct >= 0 ? "+" : ""}
              {pf.data.dayPct.toFixed(2)}%)
            </span>
          </span>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>kechagidan · {pf.data.items.map((i) => i.symbol).join(", ")}</span>
        </button>
      )}

      {prayer.data && nx && (
        <div className="card flush" style={{ "--c": "var(--habit)" } as React.CSSProperties}>
          <h2>
            <span>
              🕌 {PNAME[nx.key]} <span className="num">{nx.at}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginLeft: 8 }}>{leftText(nx.left)} qoldi</span>
            </span>
            <button className="link" onClick={() => go("namoz")}>
              Namoz
            </button>
          </h2>
          <PrayerChecks date={today} compact />
        </div>
      )}

      <div className="card flush" style={{ "--c": "var(--tasks)" } as React.CSSProperties}>
        <h2>
          Bugungi vazifalar
          <button className="link" onClick={() => go("vazifalar")}>
            Hammasi
          </button>
        </h2>
        {todays.length + important.length === 0 ? (
          <Empty emoji="☕" text="Bugunga muddatli vazifa yo'q" btn="Vazifa qo'shish" onAdd={() => setQuick("task")} />
        ) : (
          <div className="rows">
            {[...todays.filter((t) => !t.done), ...important, ...todays.filter((t) => t.done)].map((t) => (
              <TaskRow key={t.id} t={t} onOpen={setTask} />
            ))}
          </div>
        )}
      </div>

      {(daily.length > 0 || habits.length > 0) && (
        <div className="card flush" style={{ "--c": "var(--habit)" } as React.CSSProperties}>
          <h2>
            Kunlik va odatlar
            <button className="link" onClick={() => go("odatlar")}>
              Odatlar
            </button>
          </h2>
          <div className="rows">
            {daily.map((h) => (
              <HabitCheckRow key={h.id} h={h} on={doneSet.has(h.id)} onOpen={setHabit} />
            ))}
            {habits.map((h) => {
              const s = streak(logSet(d.habit_logs, h.id));
              const on = doneSet.has(h.id);
              return (
                <div key={h.id} className={"row click" + (on ? " done" : "")} onClick={() => go("odatlar")}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={h.name}
                    className="check"
                    style={{ "--c": "var(--habit)" } as React.CSSProperties}
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic(on ? "light" : "success");
                      act(() => api("/api/habit-logs", "POST", { habit_id: h.id, date: today, on: !on }));
                    }}
                  >
                    <I.check />
                  </button>
                  <div className="body">
                    <span className="t">
                      {h.emoji ? h.emoji + " " : ""}
                      {h.name}
                    </span>
                  </div>
                  {s > 0 && <span className="pill good">🔥 {s} kun</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dueDebts.length > 0 && (
        <div className="card flush" style={{ "--c": "var(--warn)" } as React.CSSProperties}>
          <h2>
            Qarz muddatlari
            <button className="link" onClick={() => go("moliya", "debts")}>
              Qarzlar
            </button>
          </h2>
          <div className="rows">
            {dueDebts.map((x) => {
              const m = muddatLabel(x.due_date);
              return (
                <div key={x.id} className="row click" onClick={() => go("moliya", "debts")}>
                  <div className={"ico " + (x.direction === "owe" ? "out" : "in")}>{x.direction === "owe" ? <I.up /> : <I.down />}</div>
                  <div className="body">
                    <span className="t">{x.person}</span>
                    <span className="m">
                      {x.direction === "owe" ? "Men qaytarishim kerak" : "Menga qaytarishi kerak"} <span className={"pill " + m.tone}>{m.text}</span>
                    </span>
                  </div>
                  <span className="amt">{som(left(x))}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reading.length > 0 && (
        <div className="card" style={{ "--c": "var(--books)" } as React.CSSProperties}>
          <h2>
            O&apos;qilmoqda
            <button className="link" onClick={() => go("kitoblar")}>
              Kitoblar
            </button>
          </h2>
          <div className="list">
            {reading.map((b) => (
              <div key={b.id} className="book" style={{ cursor: "pointer" }} onClick={() => setPage(b.id)}>
                <BookCover b={b} />
                <div className="item" style={{ gap: 8 }}>
                  <div>
                    <h3>{b.title}</h3>
                    {b.author && <div className="sub">{b.author}</div>}
                  </div>
                  <Bar pct={b.total_pages ? (b.current_page / b.total_pages) * 100 : 0} color="var(--books)" />
                  <div className="meta">
                    <span className="num">
                      {b.current_page}
                      {b.total_pages ? ` / ${b.total_pages}` : ""} bet
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--books)", fontWeight: 600 }}>Betni yangilash →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="card" style={{ "--c": "var(--notes)" } as React.CSSProperties}>
          <h2>
            Qadalgan eslatmalar
            <button className="link" onClick={() => go("eslatmalar")}>
              Hammasi
            </button>
          </h2>
          <div className="masonry" style={{ columns: "2 200px" }}>
            {pinned.map((n) => (
              <button key={n.id} className="note" style={{ "--nc": n.color || undefined, boxShadow: "none", background: "var(--surface-2)" } as React.CSSProperties} onClick={() => go("eslatmalar")}>
                {n.title && <h3>{n.title}</h3>}
                <p style={{ WebkitLineClamp: 4 }}>{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="fab" aria-label="Tez qo'shish" onClick={() => setQuickMenu(true)}>
        <I.plus />
      </button>

      {quickMenu && (
        <Sheet title="Qo'shish" onClose={() => setQuickMenu(false)}>
          <div className="grid2">
            {(
              [
                ["task", "✅", "Vazifa"],
                ["chiqim", "🔴", "Xarajat"],
                ["kirim", "🟢", "Kirim"],
                ["note", "📝", "Eslatma"],
                ["debt", "🤝", "Qarz"],
                ["book", "📚", "Kitob"],
                ["daily", "🔁", "Kunlik vazifa"],
              ] as [Quick, string, string][]
            ).map(([k, e, t]) => (
              <button
                key={k}
                className="kpi"
                style={{ background: "var(--surface-2)", boxShadow: "none", minHeight: 74, alignContent: "center" }}
                onClick={() => {
                  setQuickMenu(false);
                  setQuick(k);
                }}
              >
                <span style={{ fontSize: 22 }}>{e}</span>
                <span style={{ fontWeight: 700 }}>{t}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {quick === "task" && <TaskForm defaultDue={today} onClose={() => setQuick(null)} />}
      {(quick === "chiqim" || quick === "kirim") && <TxForm type={quick} onClose={() => setQuick(null)} />}
      {quick === "note" && <NoteEditor onClose={() => setQuick(null)} />}
      {quick === "debt" && <DebtForm direction="owe" onClose={() => setQuick(null)} />}
      {quick === "book" && <BookForm onClose={() => setQuick(null)} />}
      {quick === "daily" && <HabitForm kind="daily" onClose={() => setQuick(null)} />}
      {task && <TaskForm initial={task} onClose={() => setTask(null)} />}
      {habit && <HabitForm kind={habit.kind} initial={habit} onClose={() => setHabit(null)} />}
      {page !== null && d.books.find((b) => b.id === page) && <PageForm book={d.books.find((b) => b.id === page)!} onClose={() => setPage(null)} />}
    </>
  );
}
