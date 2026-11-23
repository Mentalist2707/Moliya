"use client";

import { useState } from "react";
import type { Habit, Task } from "@/lib/types";
import { daysLeft, muddatLabel, sana, todayStr } from "@/lib/format";
import { api, Bar, Check, Chips, Empty, Seg, useStore } from "./ui";
import { HabitForm, TaskForm } from "./forms";
import { I } from "./icons";

type Filter = "faol" | "bugun" | "bajarilgan";

export function taskGroups(tasks: Task[]) {
  const g: { key: string; title: string; items: Task[]; tone?: string }[] = [
    { key: "late", title: "Muddati o'tgan", items: [], tone: "var(--bad)" },
    { key: "today", title: "Bugun", items: [] },
    { key: "tomorrow", title: "Ertaga", items: [] },
    { key: "week", title: "Shu hafta", items: [] },
    { key: "later", title: "Keyinroq", items: [] },
    { key: "none", title: "Muddatsiz", items: [] },
  ];
  for (const t of tasks) {
    const d = daysLeft(t.due_date);
    const i = d === null ? 5 : d < 0 ? 0 : d === 0 ? 1 : d === 1 ? 2 : d <= 7 ? 3 : 4;
    g[i].items.push(t);
  }
  const rank = { yuqori: 0, orta: 1, past: 2 };
  for (const x of g) x.items.sort((a, b) => rank[a.priority] - rank[b.priority]);
  return g.filter((x) => x.items.length);
}

export function TaskRow({ t, onOpen }: { t: Task; onOpen: (t: Task) => void }) {
  const { act, haptic } = useStore();
  const m = muddatLabel(t.due_date);
  return (
    <div className={"row click" + (t.done ? " done" : "")} onClick={() => onOpen(t)}>
      <Check
        on={!!t.done}
        label={t.title}
        round
        color={t.priority === "yuqori" ? "var(--bad)" : undefined}
        onClick={() => {
          haptic(t.done ? "light" : "success");
          act(() => api(`/api/tasks/${t.id}`, "PATCH", { done: t.done ? 0 : 1 }), t.done ? undefined : "Bajarildi ✓");
        }}
      />
      <div className="body">
        <span className="t">{t.title}</span>
        {(t.due_date || t.priority === "yuqori" || t.note) && (
          <span className="m">
            {t.priority === "yuqori" && !t.done && <span className="pill bad">Muhim</span>}
            {t.due_date && !t.done && <span className={"pill " + m.tone}>{m.tone === "" ? sana(t.due_date) : m.text}</span>}
            {t.note && <span>📝</span>}
          </span>
        )}
      </div>
    </div>
  );
}

export function HabitCheckRow({ h, on, onOpen }: { h: Habit; on: boolean; onOpen: (h: Habit) => void }) {
  const { act, haptic } = useStore();
  return (
    <div className={"row click" + (on ? " done" : "")} onClick={() => onOpen(h)}>
      <Check
        on={on}
        label={h.name}
        color="var(--habit)"
        onClick={() => {
          haptic(on ? "light" : "success");
          act(() => api("/api/habit-logs", "POST", { habit_id: h.id, date: todayStr(), on: !on }));
        }}
      />
      <div className="body">
        <span className="t">
          {h.emoji ? h.emoji + " " : ""}
          {h.name}
        </span>
      </div>
    </div>
  );
}

export default function Tasks() {
  const { d, act } = useStore();
  const [seg, setSeg] = useState<"todo" | "daily">("todo");
  const [filter, setFilter] = useState<Filter>("faol");
  const [quick, setQuick] = useState("");
  const [open, setOpen] = useState<Task | "new" | null>(null);
  const [hOpen, setHOpen] = useState<Habit | "new" | null>(null);

  const today = todayStr();
  const active = d.tasks.filter((t) => !t.done);
  const done = d.tasks.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  const list = filter === "faol" ? active : filter === "bugun" ? active.filter((t) => (daysLeft(t.due_date) ?? 99) <= 0) : done;

  const daily = d.habits.filter((h) => h.kind === "daily" && !h.archived);
  const doneToday = new Set(d.habit_logs.filter((l) => l.date.slice(0, 10) === today).map((l) => l.habit_id));
  const dailyDone = daily.filter((h) => doneToday.has(h.id)).length;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Vazifalar</h1>
          <p>
            {active.length} ta faol · {dailyDone}/{daily.length} kunlik bajarildi
          </p>
        </div>
      </div>
      <Seg
        label="Bo'lim"
        value={seg}
        onChange={setSeg}
        options={[
          { v: "todo", t: "To-do" },
          { v: "daily", t: "Kunlik vazifalar" },
        ]}
      />

      {seg === "todo" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = quick.trim();
              if (!t) return;
              setQuick("");
              act(() => api("/api/tasks", "POST", { title: t, priority: "orta", due_date: filter === "bugun" ? today : null }), "Qo'shildi");
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              className="search"
              style={{ backgroundImage: "none", paddingLeft: 14 }}
              aria-label="Tez qo'shish"
              placeholder="Yangi vazifa yozing va Enter…"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
            <button className="btn" type="submit" aria-label="Qo'shish">
              <I.plus />
            </button>
          </form>
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { v: "faol", t: `Faol · ${active.length}` },
              { v: "bugun", t: "Bugun" },
              { v: "bajarilgan", t: `Bajarilgan · ${done.length}` },
            ]}
          />
          {list.length === 0 ? (
            <div className="card">
              <Empty
                emoji={filter === "bajarilgan" ? "🗂️" : "🎉"}
                text={filter === "bajarilgan" ? "Hali bajarilgan vazifa yo'q" : "Hammasi bajarilgan!"}
                btn={filter !== "bajarilgan" ? "Vazifa qo'shish" : undefined}
                onAdd={() => setOpen("new")}
              />
            </div>
          ) : filter === "bajarilgan" ? (
            <div className="card flush rows">
              {list.slice(0, 100).map((t) => (
                <TaskRow key={t.id} t={t} onOpen={setOpen} />
              ))}
            </div>
          ) : (
            taskGroups(list).map((g) => (
              <div key={g.key} className="card flush">
                <h2 style={g.tone ? { color: g.tone } : undefined}>
                  {g.title} <span className="pill">{g.items.length}</span>
                </h2>
                <div className="rows">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} t={t} onOpen={setOpen} />
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {seg === "daily" && (
        <div className="card flush">
          <div style={{ padding: "12px 12px 4px", display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Bugun</span>
              <span className="num">
                {dailyDone}/{daily.length}
              </span>
            </div>
            <Bar pct={daily.length ? (dailyDone / daily.length) * 100 : 0} color="var(--habit)" />
          </div>
          {daily.length === 0 ? (
            <Empty emoji="🔁" text="Har kuni qiladigan ishlaringizni qo'shing: dori ichish, mashq, so'z yodlash…" btn="Qo'shish" onAdd={() => setHOpen("new")} />
          ) : (
            <div className="rows">
              {daily.map((h) => (
                <HabitCheckRow key={h.id} h={h} on={doneToday.has(h.id)} onOpen={setHOpen} />
              ))}
            </div>
          )}
        </div>
      )}

      <button className="fab" aria-label="Qo'shish" onClick={() => (seg === "todo" ? setOpen("new") : setHOpen("new"))}>
        <I.plus />
      </button>
      {open && <TaskForm initial={open === "new" ? undefined : open} defaultDue={filter === "bugun" ? today : undefined} onClose={() => setOpen(null)} />}
      {hOpen && <HabitForm kind="daily" initial={hOpen === "new" ? undefined : hOpen} onClose={() => setHOpen(null)} />}
    </>
  );
}
