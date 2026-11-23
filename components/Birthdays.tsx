"use client";

import { useState } from "react";
import type { Birthday } from "@/lib/types";
import { nextBirthday } from "@/lib/calendar";
import { OYLAR, todayStr } from "@/lib/format";
import { api, Confirm, Empty, Field, Foot, Sheet, useStore, useSubmit } from "./ui";
import { I } from "./icons";

export const bdayWhen = (n: number) => (n === 0 ? "Bugun 🎉" : n === 1 ? "Ertaga" : `${n} kundan keyin`);

export default function Birthdays() {
  const { d } = useStore();
  const [open, setOpen] = useState<Birthday | "new" | null>(null);
  const today = todayStr();
  const list = d.birthdays.map((b) => ({ b, n: nextBirthday(b, today) })).sort((a, b) => a.n.left - b.n.left);

  return (
    <>
      <div className="card flush">
        {list.length === 0 ? (
          <Empty emoji="🎂" text="Yaqinlaringizning tug'ilgan kunlarini qo'shing — bot bir kun oldin va o'sha kuni ertalab eslatadi." btn="Qo'shish" onAdd={() => setOpen("new")} />
        ) : (
          <div className="rows">
            {list.map(({ b, n }) => (
              <div key={b.id} className="row click" onClick={() => setOpen(b)}>
                <div className="ico" style={{ fontSize: 13, fontWeight: 800, display: "grid", lineHeight: 1.05, textAlign: "center" }}>
                  {b.day}
                  <span style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)" }}>{OYLAR[b.month - 1].slice(0, 3)}</span>
                </div>
                <div className="body">
                  <span className="t">{b.name}</span>
                  <span className="m">
                    <span className={"pill " + (n.left === 0 ? "good" : n.left <= 7 ? "warn" : "")}>{bdayWhen(n.left)}</span>
                    {n.age ? <span>{n.age} yoshga to&apos;ladi</span> : null}
                    {b.note && <span>{b.note}</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="fab" aria-label="Tug'ilgan kun qo'shish" onClick={() => setOpen("new")} style={{ background: "var(--notes)" }}>
        <I.plus />
      </button>
      {open && <BirthdayForm initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
    </>
  );
}

function BirthdayForm({ initial, onClose }: { initial?: Birthday; onClose: () => void }) {
  const { act } = useStore();
  const [name, setName] = useState(initial?.name ?? "");
  const [day, setDay] = useState(String(initial?.day ?? ""));
  const [month, setMonth] = useState(String(initial?.month ?? new Date().getMonth() + 1));
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [ask, setAsk] = useState(false);
  const { busy, err, run } = useSubmit(async (b) => {
    await act(() => (initial ? api(`/api/birthdays/${initial.id}`, "PATCH", b) : api("/api/birthdays", "POST", b)), "Saqlandi");
    onClose();
  });
  return (
    <Sheet title={initial ? initial.name : "Tug'ilgan kun"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const dd = Number(day);
          if (!name.trim() || !(dd >= 1 && dd <= 31)) return;
          const y = Number(year);
          run({ name: name.trim(), day: dd, month: Number(month), year: y >= 1900 && y <= 2100 ? y : null, note });
        }}
      >
        <Field label="Kim" htmlFor="bd-name">
          <input id="bd-name" data-autofocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Onam" />
        </Field>
        <div className="two" style={{ gridTemplateColumns: "minmax(0,0.7fr) minmax(0,1.3fr) minmax(0,1fr)" }}>
          <Field label="Kun" htmlFor="bd-day">
            <input id="bd-day" inputMode="numeric" required value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
          <Field label="Oy" htmlFor="bd-month">
            <select id="bd-month" value={month} onChange={(e) => setMonth(e.target.value)}>
              {OYLAR.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Yil (ixtiyoriy)" htmlFor="bd-year">
            <input id="bd-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1975" />
          </Field>
        </div>
        <Field label="Izoh (sovg'a g'oyasi…)" htmlFor="bd-note">
          <input id="bd-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={initial ? () => setAsk(true) : undefined} />
      </form>
      {ask && initial && (
        <Confirm
          text={`${initial.name} o'chiriladi.`}
          onClose={() => setAsk(false)}
          onYes={async () => {
            await act(() => api(`/api/birthdays/${initial.id}`, "DELETE"), "O'chirildi");
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
