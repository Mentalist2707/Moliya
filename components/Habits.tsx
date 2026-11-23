"use client";

import { useState } from "react";
import type { Habit } from "@/lib/types";
import { HAFTA_QISQA, parseDate, todayStr } from "@/lib/format";
import { bestStreak, countLast, logSet, streak } from "@/lib/habits";
import { api, Empty, MoreBtn, useStore } from "./ui";
import { HabitForm } from "./forms";
import { I } from "./icons";

export default function Habits() {
  const { d, act, haptic } = useStore();
  const [open, setOpen] = useState<Habit | "new" | null>(null);
  const habits = d.habits.filter((h) => h.kind === "habit" && !h.archived);
  const today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => todayStr(i - 6));
  const doneToday = habits.filter((h) => d.habit_logs.some((l) => l.habit_id === h.id && l.date.slice(0, 10) === today)).length;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Odatlar</h1>
          <p>
            Bugun {doneToday}/{habits.length} bajarildi
          </p>
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="card">
          <Empty emoji="🌱" text="Yaxshi odatni boshlang — har kuni belgilang va ketma-ket kunlar zanjirini uzmang." btn="Odat qo'shish" onAdd={() => setOpen("new")} />
        </div>
      ) : (
        <div className="list">
          {habits.map((h) => {
            const set = logSet(d.habit_logs, h.id);
            const s = streak(set);
            return (
              <div key={h.id} className="card habit">
                <div className="ico" aria-hidden="true">
                  {h.emoji || "✨"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{h.name}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    30 kunda {countLast(set, 30)} marta · rekord {bestStreak(set)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div className="streak" style={{ color: s ? "var(--habit)" : "var(--muted)" }}>
                    {s ? "🔥" : ""}
                    {s}
                    <small>kun</small>
                  </div>
                  <MoreBtn onClick={() => setOpen(h)} />
                </div>
                <div className="dots">
                  {days.map((day) => {
                    const on = set.has(day);
                    return (
                      <button
                        key={day}
                        className={"dot" + (on ? " on" : "") + (day === today ? " today" : "")}
                        aria-pressed={on}
                        aria-label={`${h.name}, ${day}`}
                        onClick={() => {
                          haptic(on ? "light" : "success");
                          act(() => api("/api/habit-logs", "POST", { habit_id: h.id, date: day, on: !on }));
                        }}
                      >
                        <span>
                          {parseDate(day).getDate()}
                          <small>{HAFTA_QISQA[parseDate(day).getDay()]}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="fab" aria-label="Odat qo'shish" onClick={() => setOpen("new")} style={{ background: "var(--habit)" }}>
        <I.plus />
      </button>
      {open && <HabitForm kind="habit" initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
    </>
  );
}
