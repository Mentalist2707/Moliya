"use client";

import { useMemo, useState } from "react";
import type { Debt, Goal, Payment, Purchase, Tx } from "@/lib/types";
import { daysLeft, muddatLabel, OYLAR, sana, sanaNisbiy, som, somShort } from "@/lib/format";
import { api, Bar, Check, Chips, Empty, MoreBtn, Seg, useStore, ActionMenu } from "./ui";
import { DebtForm, GoalForm, PayForm, PurchaseForm, TxForm } from "./forms";
import { I } from "./icons";

import Crypto from "./Crypto";

type Sub = "tx" | "crypto" | "debts" | "goals" | "buy";

export default function Finance({ sub, setSub }: { sub: Sub; setSub: (s: Sub) => void }) {
  return (
    <>
      <div className="ph">
        <div>
          <h1>Moliya</h1>
        </div>
      </div>
      <Seg
        label="Moliya bo'limi"
        value={sub}
        onChange={setSub}
        options={[
          { v: "tx", t: "Kirim-chiqim" },
          { v: "crypto", t: "Kripto" },
          { v: "debts", t: "Qarzlar" },
          { v: "goals", t: "Maqsadlar" },
          { v: "buy", t: "Xaridlar" },
        ]}
      />
      {sub === "tx" && <Transactions />}
      {sub === "crypto" && <Crypto />}
      {sub === "debts" && <Debts />}
      {sub === "goals" && <Goals />}
      {sub === "buy" && <Purchases />}
    </>
  );
}

/* ================= Kirim-chiqim ================= */
function Transactions() {
  const { d } = useStore();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [open, setOpen] = useState<Tx | "chiqim" | "kirim" | null>(null);
  const [cat, setCat] = useState<string>("");

  const key = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}`;
  const month = d.transactions.filter((t) => t.date.slice(0, 7) === key);
  const income = month.filter((t) => t.type === "kirim").reduce((a, t) => a + t.amount, 0);
  const expense = month.filter((t) => t.type === "chiqim").reduce((a, t) => a + t.amount, 0);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of month) if (t.type === "chiqim") m.set(t.category, (m.get(t.category) || 0) + t.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [month]);
  const maxCat = byCat[0]?.[1] || 1;

  const shown = cat ? month.filter((t) => t.category === cat && t.type === "chiqim") : month;
  const days = useMemo(() => {
    const g = new Map<string, Tx[]>();
    for (const t of shown) {
      const k = t.date.slice(0, 10);
      g.set(k, [...(g.get(k) || []), t]);
    }
    return [...g.entries()];
  }, [shown]);

  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const dayOfMonth = isCurrent ? now.getDate() : new Date(ym.y, ym.m + 1, 0).getDate();
  const shift = (n: number) => {
    setCat("");
    setYm(({ y, m }) => {
      const dt = new Date(y, m + n, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="monthnav">
          <button aria-label="Oldingi oy" onClick={() => shift(-1)}>
            <I.left />
          </button>
          <span>
            {OYLAR[ym.m][0].toUpperCase() + OYLAR[ym.m].slice(1)} {ym.y !== now.getFullYear() ? ym.y : ""}
          </span>
          <button aria-label="Keyingi oy" onClick={() => shift(1)} disabled={isCurrent} style={isCurrent ? { opacity: 0.4 } : undefined}>
            <I.right />
          </button>
        </div>
        <div className="acts">
          <button className="btn sm soft" onClick={() => setOpen("kirim")} style={{ color: "var(--money)" }}>
            <I.down /> Kirim
          </button>
          <button className="btn sm soft" onClick={() => setOpen("chiqim")} style={{ color: "var(--bad)" }}>
            <I.up /> Xarajat
          </button>
        </div>
      </div>

      <div className="grid3">
        <div className="kpi" style={{ "--c": "var(--money)" } as React.CSSProperties}>
          <span className="k">Kirim</span>
          <span className="v">{somShort(income)}</span>
        </div>
        <div className="kpi" style={{ "--c": "var(--bad)" } as React.CSSProperties}>
          <span className="k">Xarajat</span>
          <span className="v">{somShort(expense)}</span>
          <span className="s">kuniga ≈ {somShort(expense / Math.max(1, dayOfMonth))}</span>
        </div>
        <div className="kpi" style={{ "--c": "var(--ink)" } as React.CSSProperties}>
          <span className="k">Qoldiq</span>
          <span className={"v" + (income - expense < 0 ? " bad" : "")}>{somShort(income - expense)}</span>
        </div>
      </div>

      {byCat.length > 0 && (
        <div className="card">
          <h2>
            Xarajatlar kategoriyalar bo&apos;yicha
            {cat && (
              <button className="link" onClick={() => setCat("")}>
                Hammasi
              </button>
            )}
          </h2>
          <div className="cats">
            {byCat.map(([c, v]) => (
              <button
                key={c}
                className="cat"
                onClick={() => setCat(cat === c ? "" : c)}
                style={{ border: 0, background: "none", padding: 0, textAlign: "left", opacity: cat && cat !== c ? 0.45 : 1 }}
              >
                <span style={{ fontWeight: 600 }}>{c}</span>
                <span className="num">
                  {som(v)} <span style={{ color: "var(--muted)" }}>· {Math.round((v / expense) * 100)}%</span>
                </span>
                <Bar pct={(v / maxCat) * 100} color="var(--bad)" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card flush">
        {days.length === 0 ? (
          <Empty emoji="🧾" text="Bu oyda yozuv yo'q. Xarajatlarni yozib borsangiz, pul qayerga ketayotgani ko'rinadi." btn="Xarajat qo'shish" onAdd={() => setOpen("chiqim")} />
        ) : (
          days.map(([day, items]) => {
            const net = items.reduce((a, t) => a + (t.type === "kirim" ? t.amount : -t.amount), 0);
            return (
              <div key={day}>
                <div className="daygroup">
                  <span>{sanaNisbiy(day)}</span>
                  <span className="num">{net > 0 ? "+" + som(net) : som(net)}</span>
                </div>
                <div className="rows">
                  {items.map((t) => (
                    <div key={t.id} className="row click" onClick={() => setOpen(t)}>
                      <div className={"ico " + (t.type === "kirim" ? "in" : "out")}>{t.type === "kirim" ? <I.down /> : <I.up />}</div>
                      <div className="body">
                        <span className="t">{t.note || t.category}</span>
                        <span className="m">{t.note ? t.category : ""}</span>
                      </div>
                      <span className={"amt" + (t.type === "kirim" ? " in" : "")}>
                        {t.type === "kirim" ? "+" : "−"}
                        {som(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button className="fab" aria-label="Xarajat qo'shish" onClick={() => setOpen("chiqim")}>
        <I.plus />
      </button>
      {open && (
        <TxForm initial={typeof open === "object" ? open : undefined} type={typeof open === "string" ? open : undefined} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

/* ================= To'lovlar tarixi ================= */
function History({ pays }: { pays: Payment[] }) {
  const { act } = useStore();
  if (!pays.length) return null;
  return (
    <details>
      <summary style={{ cursor: "pointer", fontSize: 14, color: "var(--muted)", minHeight: 32, display: "flex", alignItems: "center" }}>
        To&apos;lovlar tarixi ({pays.length})
      </summary>
      <div className="rows" style={{ fontSize: 14 }}>
        {pays.map((p) => (
          <div key={p.id} className="row" style={{ minHeight: 44, padding: "4px 0" }}>
            <span className="num" style={{ width: 70 }}>
              {sana(p.date)}
            </span>
            <span className="body" style={{ color: "var(--muted)" }}>
              {p.note}
            </span>
            <span className="amt">
              {p.amount > 0 ? "+" : ""}
              {som(p.amount)}
            </span>
            <button className="more" aria-label="Bekor qilish" onClick={() => act(() => api(`/api/payments?id=${p.id}`, "DELETE"), "Bekor qilindi")}>
              ×
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}

/* ================= Qarzlar ================= */
function Debts() {
  const { d } = useStore();
  const [dir, setDir] = useState<"owe" | "lend">("owe");
  const [showClosed, setShowClosed] = useState(false);
  const [open, setOpen] = useState<Debt | "new" | null>(null);
  const [pay, setPay] = useState<Debt | null>(null);
  const [menu, setMenu] = useState<Debt | null>(null);

  const left = (x: Debt) => Math.max(0, x.amount - x.paid);
  const owe = d.debts.filter((x) => x.direction === "owe");
  const lend = d.debts.filter((x) => x.direction === "lend");
  const oweLeft = owe.reduce((a, x) => a + left(x), 0);
  const lendLeft = lend.reduce((a, x) => a + left(x), 0);
  const all = dir === "owe" ? owe : lend;
  const closedCount = all.filter((x) => !left(x)).length;
  const list = all.filter((x) => showClosed || left(x) > 0);

  return (
    <>
      <div className="grid2">
        <button className="kpi" style={{ "--c": "var(--bad)", outline: dir === "owe" ? "2px solid var(--ink)" : undefined } as React.CSSProperties} onClick={() => setDir("owe")}>
          <span className="k">Qarzlarim</span>
          <span className="v">{som(oweLeft)}</span>
          <span className="s">{owe.filter((x) => left(x)).length} ta faol</span>
        </button>
        <button className="kpi" style={{ "--c": "var(--money)", outline: dir === "lend" ? "2px solid var(--ink)" : undefined } as React.CSSProperties} onClick={() => setDir("lend")}>
          <span className="k">Menga qarzlar</span>
          <span className="v">{som(lendLeft)}</span>
          <span className="s">{lend.filter((x) => left(x)).length} ta faol</span>
        </button>
      </div>

      {closedCount > 0 && (
        <Chips
          value={showClosed ? "all" : "active"}
          onChange={(v) => setShowClosed(v === "all")}
          options={[
            { v: "active", t: "Faol" },
            { v: "all", t: `Hammasi (+${closedCount} yopilgan)` },
          ]}
        />
      )}

      {list.length === 0 ? (
        <div className="card">
          <Empty emoji={dir === "owe" ? "🙌" : "🤝"} text={dir === "owe" ? "Faol qarzingiz yo'q" : "Sizga hech kim qarzdor emas"} btn="Qarz qo'shish" onAdd={() => setOpen("new")} />
        </div>
      ) : (
        <div className="list">
          {list.map((x) => {
            const l = left(x);
            const m = muddatLabel(x.due_date, !l);
            return (
              <div key={x.id} className="card item" style={!l ? { opacity: 0.6 } : undefined}>
                <div className="hd">
                  <div>
                    <h3>{x.person}</h3>
                    <div className="sub">
                      {[x.taken_date && `${dir === "owe" ? "Olingan" : "Berilgan"}: ${sana(x.taken_date)}`, x.due_date && `Muddat: ${sana(x.due_date)}`]
                        .filter(Boolean)
                        .join(" · ") || "Muddatsiz"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                    <div className="big">
                      {som(l)}
                      <small>qoldi · {som(x.amount)} dan</small>
                    </div>
                    <MoreBtn onClick={() => setMenu(x)} />
                  </div>
                </div>
                <Bar pct={(x.paid / x.amount) * 100} color="var(--money)" />
                <div className="meta">
                  <span className={"pill " + m.tone}>{m.text}</span>
                  {x.paid > 0 && (
                    <span className="num">
                      {dir === "owe" ? "To'langan" : "Qaytgan"}: {som(x.paid)}
                    </span>
                  )}
                  {l > 0 && (
                    <button className="btn sm brand" style={{ marginLeft: "auto" }} onClick={() => setPay(x)}>
                      {dir === "owe" ? "To'lov qildim" : "Qaytardi"}
                    </button>
                  )}
                </div>
                {x.note && <p className="note-txt">{x.note}</p>}
                <History pays={d.payments.filter((p) => p.kind === "debt" && p.ref_id === x.id)} />
              </div>
            );
          })}
        </div>
      )}

      <button className="fab" aria-label="Qarz qo'shish" onClick={() => setOpen("new")}>
        <I.plus />
      </button>
      {open && <DebtForm direction={dir} initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
      {pay && <PayForm kind={dir} refId={pay.id} name={pay.person} remaining={left(pay)} onClose={() => setPay(null)} />}
      {menu && (
        <ActionMenu
          title={menu.person}
          onClose={() => setMenu(null)}
          items={[
            { label: "Tahrirlash", icon: <I.edit />, onClick: () => setOpen(menu) },
            ...(left(menu) > 0 ? [{ label: dir === "owe" ? "To'lov qo'shish" : "Qaytarilgan summa", icon: <I.plus />, onClick: () => setPay(menu) }] : []),
          ]}
        />
      )}
    </>
  );
}

/* ================= Maqsadlar ================= */
function Goals() {
  const { d } = useStore();
  const [open, setOpen] = useState<Goal | "new" | null>(null);
  const [pay, setPay] = useState<Goal | null>(null);
  const saved = d.goals.reduce((a, g) => a + g.saved, 0);
  const target = d.goals.reduce((a, g) => a + g.target, 0);

  return (
    <>
      {d.goals.length > 0 && (
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>Jami yig&apos;ilgan</span>
            <span className="num" style={{ fontWeight: 700 }}>
              {som(saved)} / {som(target)}
            </span>
          </div>
          <Bar pct={target ? (saved / target) * 100 : 0} color="var(--money)" />
        </div>
      )}
      {d.goals.length === 0 ? (
        <div className="card">
          <Empty emoji="🎯" text="Nimaga pul yig'yapsiz? Maqsad qo'ying — oyiga qancha ajratish kerakligini hisoblab beraman." btn="Maqsad qo'shish" onAdd={() => setOpen("new")} />
        </div>
      ) : (
        <div className="list">
          {d.goals.map((g) => {
            const pct = Math.min(100, (g.saved / g.target) * 100);
            const complete = g.saved >= g.target;
            const need = Math.max(0, g.target - g.saved);
            const dl = daysLeft(g.deadline);
            const perMonth = dl && dl > 0 && need > 0 ? need / Math.max(1, dl / 30.4) : 0;
            const m = muddatLabel(g.deadline, complete);
            return (
              <div key={g.id} className="card item">
                <div className="hd">
                  <div>
                    <h3>{g.name}</h3>
                    <div className="sub">{g.deadline ? `Muddat: ${sana(g.deadline, true)}` : "Muddatsiz"}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                    <div className="big">
                      {Math.round(pct)}%<small>{som(g.saved)}</small>
                    </div>
                    <MoreBtn onClick={() => setOpen(g)} />
                  </div>
                </div>
                <Bar pct={pct} color={complete ? "var(--money)" : "var(--brand)"} />
                <div className="meta">
                  <span className={"pill " + m.tone}>{m.text}</span>
                  {need > 0 && <span className="num">Yana {som(need)}</span>}
                  {perMonth > 0 && <span className="num">Oyiga ≈ {som(perMonth)}</span>}
                  <button className="btn sm brand" style={{ marginLeft: "auto" }} onClick={() => setPay(g)}>
                    Pul qo&apos;shish
                  </button>
                </div>
                {g.note && <p className="note-txt">{g.note}</p>}
                <History pays={d.payments.filter((p) => p.kind === "goal" && p.ref_id === g.id)} />
              </div>
            );
          })}
        </div>
      )}
      <button className="fab" aria-label="Maqsad qo'shish" onClick={() => setOpen("new")}>
        <I.plus />
      </button>
      {open && <GoalForm initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
      {pay && <PayForm kind="goal" refId={pay.id} name={pay.name} remaining={Math.max(0, pay.target - pay.saved)} onClose={() => setPay(null)} />}
    </>
  );
}

/* ================= Xaridlar ================= */
function Purchases() {
  const { d, act, haptic } = useStore();
  const [open, setOpen] = useState<Purchase | "new" | null>(null);
  const [showBought, setShowBought] = useState(false);
  const toBuy = d.purchases.filter((p) => !p.bought);
  const bought = d.purchases.filter((p) => p.bought);
  const total = toBuy.reduce((a, p) => a + p.price, 0);
  const list = showBought ? bought : toBuy;
  const pr = { yuqori: 0, orta: 1, past: 2 };

  return (
    <>
      <div className="grid2">
        <div className="kpi" style={{ "--c": "var(--brand)" } as React.CSSProperties}>
          <span className="k">Kerakli summa</span>
          <span className="v">{som(total)}</span>
          <span className="s">{toBuy.length} ta narsa</span>
        </div>
        <div className="kpi" style={{ "--c": "var(--bad)" } as React.CSSProperties}>
          <span className="k">Juda kerak</span>
          <span className="v">{som(toBuy.filter((p) => p.priority === "yuqori").reduce((a, p) => a + p.price, 0))}</span>
          <span className="s">{toBuy.filter((p) => p.priority === "yuqori").length} ta narsa</span>
        </div>
      </div>
      <Chips
        value={showBought ? "b" : "t"}
        onChange={(v) => setShowBought(v === "b")}
        options={[
          { v: "t", t: `Olinmagan · ${toBuy.length}` },
          { v: "b", t: `Olingan · ${bought.length}` },
        ]}
      />
      <div className="card flush">
        {list.length === 0 ? (
          <Empty emoji="🛍️" text={showBought ? "Hali hech narsa olinmagan" : "Olishingiz kerak bo'lgan narsalarni yozib qo'ying"} btn={showBought ? undefined : "Qo'shish"} onAdd={() => setOpen("new")} />
        ) : (
          <div className="rows">
            {[...list]
              .sort((a, b) => pr[a.priority] - pr[b.priority] || (a.planned_date || "9").localeCompare(b.planned_date || "9"))
              .map((p) => {
                const m = muddatLabel(p.planned_date);
                return (
                  <div key={p.id} className={"row click" + (p.bought ? " done" : "")} onClick={() => setOpen(p)}>
                    <Check
                      on={!!p.bought}
                      label={p.name}
                      color="var(--money)"
                      onClick={() => {
                        haptic("success");
                        act(() => api(`/api/purchases/${p.id}`, "PATCH", { bought: p.bought ? 0 : 1 }), p.bought ? "Ro'yxatga qaytdi" : "Olindi ✓");
                      }}
                    />
                    <div className="body">
                      <span className="t">{p.name}</span>
                      <span className="m">
                        {p.priority === "yuqori" && !p.bought && <span className="pill bad">Juda kerak</span>}
                        {p.planned_date && !p.bought && <span className={"pill " + m.tone}>{m.tone ? m.text : sana(p.planned_date)}</span>}
                        {p.note && <span>{p.note}</span>}
                      </span>
                    </div>
                    <span className="amt">{som(p.price)}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
      <button className="fab" aria-label="Xarid qo'shish" onClick={() => setOpen("new")}>
        <I.plus />
      </button>
      {open && <PurchaseForm initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
    </>
  );
}
