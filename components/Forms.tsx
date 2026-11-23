"use client";

import { useEffect, useRef, useState } from "react";
import type { Debt, Goal, Purchase } from "@/lib/types";
import { parseMoney, som, todayStr } from "@/lib/format";

/* ---------- Umumiy modal ---------- */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ---------- Summa kiritish (1 250 000 ko'rinishida) ---------- */
function MoneyInput({ id, value, onChange, required }: { id: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      required={required}
      value={value}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? som(Number(digits)) : "");
      }}
    />
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Foot({ onClose, busy, label = "Saqlash" }: { onClose: () => void; busy: boolean; label?: string }) {
  return (
    <div className="foot">
      <button type="button" className="btn ghost" onClick={onClose}>
        Bekor qilish
      </button>
      <button type="submit" className="btn acc" disabled={busy}>
        {busy ? "Saqlanmoqda…" : label}
      </button>
    </div>
  );
}

type SaveFn = (data: Record<string, unknown>) => Promise<void>;

function useSubmit(onSave: SaveFn) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (data: Record<string, unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await onSave(data);
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
      setBusy(false);
    }
  };
  return { busy, err, run };
}

/* ---------- Maqsad ---------- */
export function GoalForm({ initial, onSave, onClose }: { initial?: Goal; onSave: SaveFn; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial ? som(initial.target) : "");
  const [saved, setSaved] = useState(initial ? som(initial.saved) : "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const { busy, err, run } = useSubmit(onSave);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || parseMoney(target) <= 0) return;
        run({ name: name.trim(), target: parseMoney(target), saved: parseMoney(saved), deadline, note });
      }}
    >
      <Field label="Maqsad nomi" htmlFor="g-name">
        <input id="g-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Noutbuk" />
      </Field>
      <div className="two">
        <Field label="Kerakli summa (so'm)" htmlFor="g-target">
          <MoneyInput id="g-target" required value={target} onChange={setTarget} />
        </Field>
        <Field label="Hozir yig'ilgan" htmlFor="g-saved" hint={initial ? "Pul qo'shish tugmasidan foydalaning" : undefined}>
          <MoneyInput id="g-saved" value={saved} onChange={setSaved} />
        </Field>
      </div>
      <Field label="Muddat" htmlFor="g-deadline">
        <input id="g-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      <Field label="Izoh" htmlFor="g-note">
        <textarea id="g-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="err">{err}</p>}
      <Foot onClose={onClose} busy={busy} />
    </form>
  );
}

/* ---------- Qarz ---------- */
export function DebtForm({
  initial,
  direction: dir0,
  onSave,
  onClose,
}: {
  initial?: Debt;
  direction: "owe" | "lend";
  onSave: SaveFn;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState<"owe" | "lend">(initial?.direction ?? dir0);
  const [person, setPerson] = useState(initial?.person ?? "");
  const [amount, setAmount] = useState(initial ? som(initial.amount) : "");
  const [taken, setTaken] = useState(initial?.taken_date ?? todayStr());
  const [due, setDue] = useState(initial?.due_date ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const { busy, err, run } = useSubmit(onSave);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!person.trim() || parseMoney(amount) <= 0) return;
        run({ direction, person: person.trim(), amount: parseMoney(amount), taken_date: taken, due_date: due, note });
      }}
    >
      <div className="seg" role="group" aria-label="Qarz turi">
        <button type="button" aria-pressed={direction === "owe"} onClick={() => setDirection("owe")}>
          Men qarzdorman
        </button>
        <button type="button" aria-pressed={direction === "lend"} onClick={() => setDirection("lend")}>
          Menga qarzdor
        </button>
      </div>
      <Field label={direction === "owe" ? "Kimdan oldim" : "Kimga berdim"} htmlFor="d-person">
        <input id="d-person" required value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ism yoki tashkilot" />
      </Field>
      <Field label="Summa (so'm)" htmlFor="d-amount">
        <MoneyInput id="d-amount" required value={amount} onChange={setAmount} />
      </Field>
      <div className="two">
        <Field label={direction === "owe" ? "Olingan sana" : "Berilgan sana"} htmlFor="d-taken">
          <input id="d-taken" type="date" value={taken} onChange={(e) => setTaken(e.target.value)} />
        </Field>
        <Field label="Qaytarish muddati" htmlFor="d-due">
          <input id="d-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <Field label="Izoh" htmlFor="d-note">
        <textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="err">{err}</p>}
      <Foot onClose={onClose} busy={busy} />
    </form>
  );
}

/* ---------- Xarid ---------- */
export function PurchaseForm({ initial, onSave, onClose }: { initial?: Purchase; onSave: SaveFn; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? som(initial.price) : "");
  const [date, setDate] = useState(initial?.planned_date ?? "");
  const [priority, setPriority] = useState<Purchase["priority"]>(initial?.priority ?? "orta");
  const [note, setNote] = useState(initial?.note ?? "");
  const { busy, err, run } = useSubmit(onSave);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || parseMoney(price) <= 0) return;
        run({ name: name.trim(), price: parseMoney(price), planned_date: date, priority, note });
      }}
    >
      <Field label="Nima olish kerak" htmlFor="p-name">
        <input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Qishki kurtka" />
      </Field>
      <div className="two">
        <Field label="Narxi (so'm)" htmlFor="p-price">
          <MoneyInput id="p-price" required value={price} onChange={setPrice} />
        </Field>
        <Field label="Qachon olaman" htmlFor="p-date">
          <input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Muhimligi" htmlFor="p-pr">
        <select id="p-pr" value={priority} onChange={(e) => setPriority(e.target.value as Purchase["priority"])}>
          <option value="yuqori">Yuqori — juda kerak</option>
          <option value="orta">O'rta</option>
          <option value="past">Past — kutsa bo'ladi</option>
        </select>
      </Field>
      <Field label="Izoh (do'kon, havola…)" htmlFor="p-note">
        <textarea id="p-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="err">{err}</p>}
      <Foot onClose={onClose} busy={busy} />
    </form>
  );
}

/* ---------- To'lov / pul qo'shish ---------- */
export function PayForm({
  kind,
  remaining,
  onSave,
  onClose,
}: {
  kind: "goal" | "owe" | "lend";
  remaining: number;
  onSave: SaveFn;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [withdraw, setWithdraw] = useState(false);
  const { busy, err, run } = useSubmit(onSave);
  const label = kind === "goal" ? "Summa" : kind === "owe" ? "To'langan summa" : "Qaytarilgan summa";
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const v = parseMoney(amount);
        if (v <= 0) return;
        run({ amount: withdraw ? -v : v, date, note });
      }}
    >
      {kind === "goal" && (
        <div className="seg" role="group" aria-label="Amal">
          <button type="button" aria-pressed={!withdraw} onClick={() => setWithdraw(false)}>
            Qo&apos;shish
          </button>
          <button type="button" aria-pressed={withdraw} onClick={() => setWithdraw(true)}>
            Yechib olish
          </button>
        </div>
      )}
      <Field label={label + " (so'm)"} htmlFor="pay-amount" hint={remaining > 0 ? `Qolgan: ${som(remaining)} so'm` : undefined}>
        <MoneyInput id="pay-amount" required value={amount} onChange={setAmount} />
      </Field>
      {remaining > 0 && !withdraw && (
        <button type="button" className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => setAmount(som(remaining))}>
          Hammasini ({som(remaining)})
        </button>
      )}
      <Field label="Sana" htmlFor="pay-date">
        <input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Izoh" htmlFor="pay-note">
        <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="err">{err}</p>}
      <Foot onClose={onClose} busy={busy} />
    </form>
  );
}

export function Confirm({ text, onYes, onClose }: { text: string; onYes: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="form">
      <p style={{ margin: 0 }}>{text}</p>
      <div className="foot">
        <button className="btn ghost" onClick={onClose}>
          Yo&apos;q
        </button>
        <button
          className="btn danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onYes();
          }}
        >
          Ha, o&apos;chirish
        </button>
      </div>
    </div>
  );
}
