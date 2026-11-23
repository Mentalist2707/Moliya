"use client";

import { useState } from "react";
import type { Bill } from "@/lib/types";
import { billStatus } from "@/lib/calendar";
import { EXPENSE_CATS } from "@/lib/categories";
import { sana, som, todayStr } from "@/lib/format";
import { api, Confirm, Empty, Field, Foot, MoneyInput, parseMoney, Sheet, useStore, useSubmit } from "./ui";
import { I } from "./icons";

export const whenText = (n: number) => (n === 0 ? "Bugun" : n === 1 ? "Ertaga" : n < 0 ? `${-n} kun o'tdi` : `${n} kundan keyin`);

export function BillRow({ b, onOpen }: { b: Bill; onOpen: (b: Bill) => void }) {
  const { act, haptic } = useStore();
  const today = todayStr();
  const s = billStatus(b, today);
  const tone = !b.active ? "" : s.overdue ? "bad" : s.left <= Math.max(1, b.remind_days) ? "warn" : s.paidThisMonth ? "good" : "";
  return (
    <div className="row click" onClick={() => onOpen(b)} style={!b.active ? { opacity: 0.5 } : undefined}>
      <div className="ico" style={{ fontWeight: 800, fontSize: 14 }}>
        {b.day}
      </div>
      <div className="body">
        <span className="t">{b.name}</span>
        <span className="m">
          {b.active ? (
            <span className={"pill " + tone}>{s.paidThisMonth ? `To'langan · keyingi ${sana(s.due)}` : `${whenText(s.left)} · ${sana(s.due)}`}</span>
          ) : (
            <span className="pill">To&apos;xtatilgan</span>
          )}
          <span>{b.category}</span>
        </span>
      </div>
      <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
        <span className="amt">{b.amount ? som(b.amount) : "—"}</span>
        {b.active && !s.paidThisMonth && (
          <button
            className="btn sm brand"
            style={{ minHeight: 32, padding: "0 10px", fontSize: 13 }}
            onClick={(e) => {
              e.stopPropagation();
              haptic("success");
              act(() => api("/api/bill-pay", "POST", { id: b.id, date: today, add_tx: true }), "To'landi ✓ — xarajatga yozildi");
            }}
          >
            To&apos;ladim
          </button>
        )}
      </div>
    </div>
  );
}

export default function Bills() {
  const { d } = useStore();
  const [open, setOpen] = useState<Bill | "new" | null>(null);
  const today = todayStr();
  const active = d.bills.filter((b) => b.active);
  const monthTotal = active.reduce((a, b) => a + b.amount, 0);
  const left = active.filter((b) => !billStatus(b, today).paidThisMonth).reduce((a, b) => a + b.amount, 0);
  const sorted = [...d.bills].sort((a, b) => b.active - a.active || billStatus(a, today).left - billStatus(b, today).left);

  return (
    <>
      <div className="grid2">
        <div className="kpi" style={{ "--c": "var(--brand)" } as React.CSSProperties}>
          <span className="k">Oylik to&apos;lovlar</span>
          <span className="v">{som(monthTotal)}</span>
          <span className="s">{active.length} ta</span>
        </div>
        <div className="kpi" style={{ "--c": "var(--bad)" } as React.CSSProperties}>
          <span className="k">Shu oy qoldi</span>
          <span className="v">{som(left)}</span>
          <span className="s">to&apos;lanmagan</span>
        </div>
      </div>
      <div className="card flush">
        {d.bills.length === 0 ? (
          <Empty emoji="📅" text="Internet, telefon, ijara, kontrakt, kredit — har oy to'lanadiganlarni qo'shing. Bot muddatdan oldin eslatadi." btn="To'lov qo'shish" onAdd={() => setOpen("new")} />
        ) : (
          <div className="rows">
            {sorted.map((b) => (
              <BillRow key={b.id} b={b} onOpen={setOpen} />
            ))}
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>«To&apos;ladim» bosilganda summa avtomatik ravishda xarajatlarga yoziladi.</p>
      <button className="fab" aria-label="To'lov qo'shish" onClick={() => setOpen("new")}>
        <I.plus />
      </button>
      {open && <BillForm initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
    </>
  );
}

function BillForm({ initial, onClose }: { initial?: Bill; onClose: () => void }) {
  const { act } = useStore();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amount ? som(initial.amount) : "");
  const [day, setDay] = useState(String(initial?.day ?? new Date().getDate()));
  const [category, setCategory] = useState(initial?.category ?? "Kommunal");
  const [remind, setRemind] = useState(String(initial?.remind_days ?? 1));
  const [activeOn, setActiveOn] = useState(initial ? !!initial.active : true);
  const [ask, setAsk] = useState(false);
  const { busy, err, run } = useSubmit(async (b) => {
    await act(() => (initial ? api(`/api/bills/${initial.id}`, "PATCH", b) : api("/api/bills", "POST", b)), "Saqlandi");
    onClose();
  });
  return (
    <Sheet title={initial ? initial.name : "Oylik to'lov"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const dd = Number(day);
          if (!name.trim() || !(dd >= 1 && dd <= 31)) return;
          run({ name: name.trim(), amount: parseMoney(amount), day: dd, category, remind_days: Number(remind), active: activeOn ? 1 : 0 });
        }}
      >
        <Field label="Nomi" htmlFor="bl-name">
          <input id="bl-name" data-autofocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Internet, Kontrakt, Kredit" />
        </Field>
        <div className="two">
          <Field label="Summa (so'm)" htmlFor="bl-amount">
            <MoneyInput id="bl-amount" value={amount} onChange={setAmount} />
          </Field>
          <Field label="Har oyning nechanchi kuni" htmlFor="bl-day">
            <input id="bl-day" inputMode="numeric" required value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
        </div>
        <div className="two">
          <Field label="Kategoriya" htmlFor="bl-cat">
            <select id="bl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Qachon eslatsin" htmlFor="bl-rem">
            <select id="bl-rem" value={remind} onChange={(e) => setRemind(e.target.value)}>
              <option value="0">O&apos;sha kuni</option>
              <option value="1">1 kun oldin</option>
              <option value="3">3 kun oldin</option>
              <option value="7">1 hafta oldin</option>
            </select>
          </Field>
        </div>
        {initial && (
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={activeOn} onChange={(e) => setActiveOn(e.target.checked)} style={{ width: 20, height: 20 }} />
            Faol (o&apos;chirsangiz eslatma kelmaydi)
          </label>
        )}
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={initial ? () => setAsk(true) : undefined} />
      </form>
      {ask && initial && (
        <Confirm
          text={`«${initial.name}» o'chiriladi.`}
          onClose={() => setAsk(false)}
          onYes={async () => {
            await act(() => api(`/api/bills/${initial.id}`, "DELETE"), "O'chirildi");
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
