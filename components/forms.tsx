"use client";

import { useState } from "react";
import type { Book, Debt, Goal, Habit, Note, Priority, Purchase, Task, Tx } from "@/lib/types";
import { EXPENSE_CATS, INCOME_CATS } from "@/lib/categories";
import { som, todayStr } from "@/lib/format";
import { api, Chips, Confirm, Field, Foot, MoneyInput, parseMoney, Seg, Sheet, useStore, useSubmit } from "./ui";

type Base = { onClose: () => void };

/** Saqlash: yangi bo'lsa POST, bor bo'lsa PATCH */
function useSave(table: string, id: number | undefined, onClose: () => void, msg: string) {
  const { act } = useStore();
  return async (b: Record<string, unknown>) => {
    await act(() => (id ? api(`/api/${table}/${id}`, "PATCH", b) : api(`/api/${table}`, "POST", b)), msg);
    onClose();
  };
}

function useDelete(table: string, id: number | undefined, onClose: () => void) {
  const { act } = useStore();
  const [ask, setAsk] = useState(false);
  const el = ask && id ? (
    <Confirm
      text="Bu yozuv butunlay o'chiriladi."
      onClose={() => setAsk(false)}
      onYes={async () => {
        await act(() => api(`/api/${table}/${id}`, "DELETE"), "O'chirildi");
        setAsk(false);
        onClose();
      }}
    />
  ) : null;
  return { open: id ? () => setAsk(true) : undefined, el };
}

const PRI: { v: Priority; t: string }[] = [
  { v: "yuqori", t: "🔴 Muhim" },
  { v: "orta", t: "O'rta" },
  { v: "past", t: "Past" },
];

/* ---------------- Vazifa ---------------- */
export function TaskForm({ initial, onClose, defaultDue }: Base & { initial?: Task; defaultDue?: string }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [due, setDue] = useState(initial?.due_date ?? defaultDue ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "orta");
  const [note, setNote] = useState(initial?.note ?? "");
  const save = useSave("tasks", initial?.id, onClose, "Vazifa saqlandi");
  const del = useDelete("tasks", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  const quick = [
    { t: "Bugun", v: todayStr() },
    { t: "Ertaga", v: todayStr(1) },
    { t: "1 haftada", v: todayStr(7) },
    { t: "Muddatsiz", v: "" },
  ];
  return (
    <Sheet title={initial ? "Vazifa" : "Yangi vazifa"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) run({ title: title.trim(), due_date: due, priority, note });
        }}
      >
        <Field label="Nima qilish kerak" htmlFor="t-title">
          <input id="t-title" data-autofocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Laboratoriya hisobotini topshirish" />
        </Field>
        <Field label="Muddat" htmlFor="t-due">
          <div className="chips">
            {quick.map((q) => (
              <button key={q.t} type="button" aria-pressed={due === q.v} onClick={() => setDue(q.v)}>
                {q.t}
              </button>
            ))}
          </div>
          <input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Muhimligi" htmlFor="t-pr">
          <Chips value={priority} options={PRI} onChange={setPriority} />
        </Field>
        <Field label="Izoh" htmlFor="t-note">
          <textarea id="t-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

/* ---------------- Kunlik vazifa / Odat ---------------- */
const EMOJIS = ["💪", "📖", "🏃", "💧", "🧘", "🇬🇧", "🛏️", "🍎", "🧪", "✍️", "🙏", "🚭", "💊", "🧹", "💻", "🎯"];

export function HabitForm({ initial, kind, onClose }: Base & { initial?: Habit; kind: "daily" | "habit" }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? (kind === "habit" ? "💪" : ""));
  const save = useSave("habits", initial?.id, onClose, "Saqlandi");
  const del = useDelete("habits", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  return (
    <Sheet title={initial ? "Tahrirlash" : kind === "daily" ? "Yangi kunlik vazifa" : "Yangi odat"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) run({ name: name.trim(), emoji, kind: initial?.kind ?? kind });
        }}
      >
        <Field
          label="Nomi"
          htmlFor="h-name"
          hint={kind === "daily" ? "Har kuni ertalab ro'yxat qaytadan boshlanadi" : "Har kuni belgilang — ketma-ket kunlar (streak) hisoblanadi"}
        >
          <input
            id="h-name"
            data-autofocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "daily" ? "Masalan: Dorilarni ichish" : "Masalan: 20 bet kitob o'qish"}
          />
        </Field>
        <Field label="Belgi" htmlFor="h-emoji">
          <div className="chips" id="h-emoji">
            {EMOJIS.map((e) => (
              <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(emoji === e ? "" : e)} style={{ fontSize: 18 }}>
                {e}
              </button>
            ))}
          </div>
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

/* ---------------- Kirim / chiqim ---------------- */
export function TxForm({ initial, type: t0 = "chiqim", onClose }: Base & { initial?: Tx; type?: "kirim" | "chiqim" }) {
  const [type, setType] = useState<"kirim" | "chiqim">(initial?.type ?? t0);
  const [amount, setAmount] = useState(initial ? som(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [note, setNote] = useState(initial?.note ?? "");
  const save = useSave("transactions", initial?.id, onClose, type === "kirim" ? "Kirim yozildi" : "Xarajat yozildi");
  const del = useDelete("transactions", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  const cats = type === "kirim" ? INCOME_CATS : EXPENSE_CATS;
  return (
    <Sheet title={initial ? "Tahrirlash" : type === "kirim" ? "Kirim" : "Xarajat"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseMoney(amount);
          if (v > 0) run({ type, amount: v, category: category || "Boshqa", date, note });
        }}
      >
        <Seg
          label="Turi"
          value={type}
          onChange={(v) => {
            setType(v);
            setCategory("");
          }}
          options={[
            { v: "chiqim", t: "Xarajat" },
            { v: "kirim", t: "Kirim" },
          ]}
        />
        <Field label="Summa (so'm)" htmlFor="x-amount">
          <MoneyInput id="x-amount" huge required value={amount} onChange={setAmount} />
        </Field>
        <Field label="Kategoriya" htmlFor="x-cat">
          <div className="chips" id="x-cat">
            {cats.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </Field>
        <div className="two">
          <Field label="Sana" htmlFor="x-date">
            <input id="x-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Izoh" htmlFor="x-note">
            <input id="x-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: tushlik" />
          </Field>
        </div>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

/* ---------------- Qarz ---------------- */
export function DebtForm({ initial, direction: dir0, onClose }: Base & { initial?: Debt; direction: "owe" | "lend" }) {
  const [direction, setDirection] = useState<"owe" | "lend">(initial?.direction ?? dir0);
  const [person, setPerson] = useState(initial?.person ?? "");
  const [amount, setAmount] = useState(initial ? som(initial.amount) : "");
  const [taken, setTaken] = useState(initial?.taken_date ?? todayStr());
  const [due, setDue] = useState(initial?.due_date ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const save = useSave("debts", initial?.id, onClose, "Qarz saqlandi");
  const del = useDelete("debts", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  return (
    <Sheet title={initial ? "Qarzni tahrirlash" : "Yangi qarz"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (person.trim() && parseMoney(amount) > 0)
            run({ direction, person: person.trim(), amount: parseMoney(amount), taken_date: taken, due_date: due, note });
        }}
      >
        <Seg
          label="Qarz turi"
          value={direction}
          onChange={setDirection}
          options={[
            { v: "owe", t: "Men qarzdorman" },
            { v: "lend", t: "Menga qarzdor" },
          ]}
        />
        <Field label={direction === "owe" ? "Kimdan oldim" : "Kimga berdim"} htmlFor="d-person">
          <input id="d-person" required value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ism" />
        </Field>
        <Field label="Summa (so'm)" htmlFor="d-amount">
          <MoneyInput id="d-amount" huge required value={amount} onChange={setAmount} />
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
          <input id="d-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

/* ---------------- Maqsad ---------------- */
export function GoalForm({ initial, onClose }: Base & { initial?: Goal }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial ? som(initial.target) : "");
  const [saved, setSaved] = useState(initial ? som(initial.saved) : "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const save = useSave("goals", initial?.id, onClose, "Maqsad saqlandi");
  const del = useDelete("goals", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  return (
    <Sheet title={initial ? "Maqsad" : "Yangi maqsad"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && parseMoney(target) > 0)
            run({ name: name.trim(), target: parseMoney(target), ...(initial ? {} : { saved: parseMoney(saved) }), deadline, note });
        }}
      >
        <Field label="Maqsad nomi" htmlFor="g-name">
          <input id="g-name" data-autofocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Noutbuk" />
        </Field>
        <div className="two">
          <Field label="Kerakli summa" htmlFor="g-target">
            <MoneyInput id="g-target" required value={target} onChange={setTarget} />
          </Field>
          {!initial && (
            <Field label="Hozir yig'ilgan" htmlFor="g-saved">
              <MoneyInput id="g-saved" value={saved} onChange={setSaved} />
            </Field>
          )}
        </div>
        <Field label="Muddat" htmlFor="g-deadline">
          <input id="g-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <Field label="Izoh" htmlFor="g-note">
          <input id="g-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

/* ---------------- Xarid ---------------- */
export function PurchaseForm({ initial, onClose }: Base & { initial?: Purchase }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? som(initial.price) : "");
  const [date, setDate] = useState(initial?.planned_date ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "orta");
  const [note, setNote] = useState(initial?.note ?? "");
  const save = useSave("purchases", initial?.id, onClose, "Saqlandi");
  const del = useDelete("purchases", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  return (
    <Sheet title={initial ? "Xarid" : "Olishim kerak"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && parseMoney(price) > 0) run({ name: name.trim(), price: parseMoney(price), planned_date: date, priority, note });
        }}
      >
        <Field label="Nima" htmlFor="p-name">
          <input id="p-name" data-autofocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Qishki kurtka" />
        </Field>
        <div className="two">
          <Field label="Narxi" htmlFor="p-price">
            <MoneyInput id="p-price" required value={price} onChange={setPrice} />
          </Field>
          <Field label="Qachon" htmlFor="p-date">
            <input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Muhimligi" htmlFor="p-pr">
          <Chips value={priority} options={PRI} onChange={setPriority} />
        </Field>
        <Field label="Izoh (do'kon, havola)" htmlFor="p-note">
          <input id="p-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

/* ---------------- To'lov / pul qo'shish ---------------- */
export function PayForm({
  kind,
  refId,
  name,
  remaining,
  onClose,
}: Base & { kind: "goal" | "owe" | "lend"; refId: number; name: string; remaining: number }) {
  const { act } = useStore();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [withdraw, setWithdraw] = useState(false);
  const [alsoTx, setAlsoTx] = useState(kind !== "goal");
  const { busy, err, run } = useSubmit(async (b) => {
    await act(async () => {
      await api("/api/payments", "POST", { ...b, kind: kind === "goal" ? "goal" : "debt", ref_id: refId });
      // Qarz to'lovini kirim-chiqimga ham yozish
      if (alsoTx && kind !== "goal") {
        await api("/api/transactions", "POST", {
          type: kind === "owe" ? "chiqim" : "kirim",
          amount: b.amount,
          category: "Boshqa",
          date: b.date,
          note: kind === "owe" ? `Qarz to'lovi: ${name}` : `Qarz qaytdi: ${name}`,
        });
      }
    }, "Yozib qo'yildi");
    onClose();
  });
  const title = kind === "goal" ? `${name}` : kind === "owe" ? `${name}ga to'lov` : `${name} qaytardi`;
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseMoney(amount);
          if (v > 0) run({ amount: withdraw ? -v : v, date, note });
        }}
      >
        {kind === "goal" && (
          <Seg
            label="Amal"
            value={withdraw ? "w" : "a"}
            onChange={(v) => setWithdraw(v === "w")}
            options={[
              { v: "a", t: "Qo'shish" },
              { v: "w", t: "Yechib olish" },
            ]}
          />
        )}
        <Field label="Summa (so'm)" htmlFor="pay-amount" hint={remaining > 0 ? `Qolgan: ${som(remaining)} so'm` : undefined}>
          <MoneyInput id="pay-amount" huge required value={amount} onChange={setAmount} />
        </Field>
        {remaining > 0 && !withdraw && (
          <button type="button" className="btn sm soft" style={{ justifySelf: "start" }} onClick={() => setAmount(som(remaining))}>
            Hammasi: {som(remaining)}
          </button>
        )}
        <div className="two">
          <Field label="Sana" htmlFor="pay-date">
            <input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Izoh" htmlFor="pay-note">
            <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {kind !== "goal" && (
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={alsoTx} onChange={(e) => setAlsoTx(e.target.checked)} style={{ width: 20, height: 20 }} />
            Kirim-chiqimga ham yozilsin
          </label>
        )}
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} />
      </form>
    </Sheet>
  );
}

/* ---------------- Eslatma ---------------- */
export const NOTE_COLORS = ["", "#ff5a1f", "#f2b632", "#35c98f", "#3cc9d6", "#6b95ff", "#ff7aa0"];

export function NoteEditor({ initial, onClose }: Base & { initial?: Note }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [pinned, setPinned] = useState(!!initial?.pinned);
  const save = useSave("notes", initial?.id, onClose, "Eslatma saqlandi");
  const del = useDelete("notes", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  return (
    <Sheet onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() || body.trim()) run({ title: title.trim(), body, color, pinned: pinned ? 1 : 0 });
          else onClose();
        }}
      >
        <input
          aria-label="Sarlavha"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sarlavha"
          style={{ border: 0, background: "none", fontSize: 22, fontWeight: 800, padding: "4px 0", outline: "none", letterSpacing: "-0.02em" }}
        />
        <div className="field">
          <textarea
            aria-label="Matn"
            data-autofocus
            className="tall"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Fikr, ro'yxat, konspekt…"
          />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div className="colors" role="group" aria-label="Rang">
            {NOTE_COLORS.map((c) => (
              <button key={c || "none"} type="button" aria-label={c || "Rangsiz"} aria-pressed={color === c} onClick={() => setColor(c)} style={{ background: c || "var(--surface-2)" }} />
            ))}
          </div>
          <button type="button" className="btn sm soft" aria-pressed={pinned} onClick={() => setPinned(!pinned)}>
            {pinned ? "📌 Qadalgan" : "Qadash"}
          </button>
        </div>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

/* ---------------- Kitob ---------------- */
const GENRES = ["Badiiy", "Ilmiy", "Biznes", "Shaxsiy rivojlanish", "Diniy", "Tarix", "Biologiya", "Darslik", "She'riyat"];

export function BookForm({ initial, onClose, defaultStatus }: Base & { initial?: Book; defaultStatus?: Book["status"] }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [genre, setGenre] = useState(initial?.genre ?? "");
  const [status, setStatus] = useState<Book["status"]>(initial?.status ?? defaultStatus ?? "reja");
  const [finished, setFinished] = useState(initial?.finished ?? (defaultStatus === "oqidim" ? todayStr() : ""));
  const [total, setTotal] = useState(initial?.total_pages ? String(initial.total_pages) : "");
  const [current, setCurrent] = useState(initial ? String(initial.current_page) : "");
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");
  const save = useSave("books", initial?.id, onClose, "Kitob saqlandi");
  const del = useDelete("books", initial?.id, onClose);
  const { busy, err, run } = useSubmit(save);
  return (
    <Sheet title={initial ? "Kitob" : "Yangi kitob"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const t = Number(total) || null;
          let cur = Number(current) || 0;
          if (status === "oqidim" && t) cur = t;
          const b: Record<string, unknown> = { title: title.trim(), author, genre: genre.trim() || null, status, total_pages: t, current_page: cur, rating: rating || null, note };
          if (status === "oqiyapman" && !initial?.started) b.started = todayStr();
          if (status === "oqidim") b.finished = finished || null;
          else b.finished = null;
          run(b);
        }}
      >
        <Field label="Kitob nomi" htmlFor="b-title">
          <input id="b-title" data-autofocus required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="two">
          <Field label="Muallif" htmlFor="b-author">
            <input id="b-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Janr" htmlFor="b-genre">
            <input id="b-genre" list="genres" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Masalan: Badiiy" />
            <datalist id="genres">
              {GENRES.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
        </div>
        <Seg
          label="Holat"
          value={status}
          onChange={(v) => {
            setStatus(v);
            if (v === "oqidim" && !finished) setFinished(todayStr());
          }}
          options={[
            { v: "reja", t: "O'qimoqchiman" },
            { v: "oqiyapman", t: "O'qiyapman" },
            { v: "oqidim", t: "O'qidim" },
          ]}
        />
        {status === "oqidim" && (
          <Field label="Qachon o'qib tugatdingiz" htmlFor="b-fin" hint="Eski kitoblar uchun taxminiy sana ham bo'ladi — yil bo'yicha javonga joylashadi">
            <input id="b-fin" type="date" value={finished} onChange={(e) => setFinished(e.target.value)} />
          </Field>
        )}
        <div className="two">
          <Field label="Jami bet" htmlFor="b-total">
            <input id="b-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Hozirgi bet" htmlFor="b-cur">
            <input id="b-cur" inputMode="numeric" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <Field label="Baho" htmlFor="b-rate">
          <div className="stars" id="b-rate">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} yulduz`} className={n <= rating ? "on" : ""} onClick={() => setRating(n === rating ? 0 : n)}>
                ★
              </button>
            ))}
          </div>
        </Field>
        <Field label="Fikrlar, iqtiboslar" htmlFor="b-note">
          <textarea id="b-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={del.open} />
      </form>
      {del.el}
    </Sheet>
  );
}

export function PageForm({ book, onClose }: Base & { book: Book }) {
  const { act } = useStore();
  const [page, setPage] = useState(String(book.current_page || ""));
  const { busy, err, run } = useSubmit(async (b) => {
    await act(() => api(`/api/books/${book.id}`, "PATCH", b), "Yangilandi");
    onClose();
  });
  return (
    <Sheet title={book.title} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          let p = Number(page) || 0;
          const b: Record<string, unknown> = {};
          if (book.total_pages) p = Math.min(p, book.total_pages);
          b.current_page = p;
          if (book.status === "reja") {
            b.status = "oqiyapman";
            b.started = todayStr();
          }
          if (book.total_pages && p >= book.total_pages) {
            b.status = "oqidim";
            b.finished = todayStr();
          }
          run(b);
        }}
      >
        <Field label="Qaysi betdasiz?" htmlFor="pg" hint={book.total_pages ? `Jami ${book.total_pages} bet` : undefined}>
          <input id="pg" className="huge" inputMode="numeric" data-autofocus value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <div className="chips">
          {[10, 20, 50].map((n) => (
            <button key={n} type="button" onClick={() => setPage(String((Number(page) || 0) + n))}>
              +{n} bet
            </button>
          ))}
        </div>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} />
      </form>
    </Sheet>
  );
}
