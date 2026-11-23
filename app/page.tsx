"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AllData, Debt, Goal, Payment, Purchase } from "@/lib/types";
import { daysLeft, muddatLabel, sana, som } from "@/lib/format";
import { Confirm, DebtForm, GoalForm, Modal, PayForm, PurchaseForm } from "@/components/Forms";

type Tab = "umumiy" | "maqsadlar" | "qarzlarim" | "qarzdorlar" | "xaridlar";
const TABS: { id: Tab; label: string }[] = [
  { id: "umumiy", label: "Umumiy" },
  { id: "maqsadlar", label: "Maqsadlar" },
  { id: "qarzlarim", label: "Qarzlarim" },
  { id: "qarzdorlar", label: "Menga qarzlar" },
  { id: "xaridlar", label: "Xaridlar" },
];

type ModalState =
  | { t: "goal"; item?: Goal }
  | { t: "debt"; dir: "owe" | "lend"; item?: Debt }
  | { t: "purchase"; item?: Purchase }
  | { t: "pay"; kind: "goal" | "owe" | "lend"; id: number; remaining: number; name: string }
  | { t: "del"; table: "goals" | "debts" | "purchases"; id: number; name: string }
  | null;

async function api(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || "Server xatosi");
  }
  return r.json();
}

const EMPTY: AllData = { goals: [], debts: [], purchases: [], payments: [] };

export default function Home() {
  const [data, setData] = useState<AllData | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState<Tab>("umumiy");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api("/api/data", "GET"));
      setLoadErr("");
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const fromHash = location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", "#" + t);
  };

  const done = async (msg: string) => {
    setModal(null);
    setToast(msg);
    await load();
  };

  const d = data ?? EMPTY;
  const owe = d.debts.filter((x) => x.direction === "owe");
  const lend = d.debts.filter((x) => x.direction === "lend");

  const s = useMemo(() => {
    const left = (x: Debt) => Math.max(0, x.amount - x.paid);
    const oweLeft = owe.reduce((a, x) => a + left(x), 0);
    const lendLeft = lend.reduce((a, x) => a + left(x), 0);
    const goalSaved = d.goals.reduce((a, g) => a + g.saved, 0);
    const goalTarget = d.goals.reduce((a, g) => a + g.target, 0);
    const toBuy = d.purchases.filter((p) => !p.bought);
    const buyTotal = toBuy.reduce((a, p) => a + p.price, 0);
    return { oweLeft, lendLeft, goalSaved, goalTarget, buyTotal, buyCount: toBuy.length };
  }, [d, owe, lend]);

  const counts: Record<Tab, number> = {
    umumiy: 0,
    maqsadlar: d.goals.length,
    qarzlarim: owe.filter((x) => x.paid < x.amount).length,
    qarzdorlar: lend.filter((x) => x.paid < x.amount).length,
    xaridlar: d.purchases.filter((p) => !p.bought).length,
  };

  const paysFor = (kind: "goal" | "debt", id: number) => d.payments.filter((p) => p.kind === kind && p.ref_id === id);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <p className="brand">
            <i aria-hidden="true" />
            Moliya
          </p>
          <nav className="tabs" role="tablist" aria-label="Bo'limlar">
            {TABS.map((t) => (
              <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
                {t.label}
                {counts[t.id] > 0 && <span className="n">{counts[t.id]}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap">
        {loadErr && (
          <div className="empty">
            Ma&apos;lumotlarni yuklab bo&apos;lmadi: {loadErr}
            <button className="btn" onClick={load}>
              Qayta urinish
            </button>
          </div>
        )}
        {!data && !loadErr && <p className="loading">Yuklanmoqda…</p>}

        {data && tab === "umumiy" && (
          <Overview d={d} s={s} owe={owe} lend={lend} go={go} add={setModal} />
        )}

        {data && tab === "maqsadlar" && (
          <section>
            <SecHead
              title="Maqsadlar"
              sub={`Yig'ilgan: ${som(s.goalSaved)} / ${som(s.goalTarget)} so'm`}
              btn="+ Yangi maqsad"
              onAdd={() => setModal({ t: "goal" })}
            />
            {d.goals.length === 0 ? (
              <Empty text="Hali maqsad yo'q. Nimaga pul yig'yapsiz?" btn="Maqsad qo'shish" onAdd={() => setModal({ t: "goal" })} />
            ) : (
              <div className="list">
                {d.goals.map((g) => {
                  const pct = Math.min(100, (g.saved / g.target) * 100);
                  const complete = g.saved >= g.target;
                  const m = muddatLabel(g.deadline, complete);
                  const dl = daysLeft(g.deadline);
                  const need = Math.max(0, g.target - g.saved);
                  const perMonth = dl && dl > 0 && need > 0 ? need / Math.max(1, dl / 30.4) : 0;
                  return (
                    <article key={g.id} className="card">
                      <div className="hd">
                        <div>
                          <h3>{g.name}</h3>
                          <div className="sub">Muddat: {sana(g.deadline)}</div>
                        </div>
                        <div className="money">
                          {som(g.saved)}
                          <small>/ {som(g.target)} so&apos;m</small>
                        </div>
                      </div>
                      <div className={"meter" + (complete ? " good" : "")} aria-label={`${Math.round(pct)}%`}>
                        <b style={{ width: pct + "%" }} />
                      </div>
                      <div className="meta">
                        <span className={"pill " + m.tone}>{m.text}</span>
                        <span className="num">{Math.round(pct)}%</span>
                        {need > 0 && <span className="num">Yana kerak: {som(need)} so&apos;m</span>}
                        {perMonth > 0 && <span className="num">Oyiga ≈ {som(perMonth)} so&apos;m</span>}
                      </div>
                      {g.note && <p className="note">{g.note}</p>}
                      <History pays={paysFor("goal", g.id)} onDel={async (id) => { await api(`/api/payments?id=${id}`, "DELETE"); await load(); }} />
                      <div className="acts">
                        <button className="btn acc sm" onClick={() => setModal({ t: "pay", kind: "goal", id: g.id, remaining: need, name: g.name })}>
                          Pul qo&apos;shish
                        </button>
                        <button className="btn ghost sm" onClick={() => setModal({ t: "goal", item: g })}>Tahrirlash</button>
                        <button className="btn ghost sm" onClick={() => setModal({ t: "del", table: "goals", id: g.id, name: g.name })}>O&apos;chirish</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {data && (tab === "qarzlarim" || tab === "qarzdorlar") && (() => {
          const dir = tab === "qarzlarim" ? "owe" : "lend";
          const all = dir === "owe" ? owe : lend;
          const list = all.filter((x) => showDone || x.paid < x.amount);
          const doneCount = all.length - all.filter((x) => x.paid < x.amount).length;
          return (
            <section>
              <SecHead
                title={dir === "owe" ? "Qarzlarim" : "Menga qarzlar"}
                sub={dir === "owe" ? `Qaytarishim kerak: ${som(s.oweLeft)} so'm` : `Olishim kerak: ${som(s.lendLeft)} so'm`}
                btn="+ Qarz qo'shish"
                onAdd={() => setModal({ t: "debt", dir })}
              />
              {doneCount > 0 && (
                <div className="filters">
                  <button className="chip" aria-pressed={!showDone} onClick={() => setShowDone(false)}>Faol</button>
                  <button className="chip" aria-pressed={showDone} onClick={() => setShowDone(true)}>Hammasi (+{doneCount} yopilgan)</button>
                </div>
              )}
              {list.length === 0 ? (
                <Empty
                  text={dir === "owe" ? "Faol qarzingiz yo'q. Zo'r!" : "Sizga hech kim qarzdor emas."}
                  btn="Qarz qo'shish"
                  onAdd={() => setModal({ t: "debt", dir })}
                />
              ) : (
                <div className="list">
                  {list.map((x) => {
                    const left = Math.max(0, x.amount - x.paid);
                    const closed = left === 0;
                    const m = muddatLabel(x.due_date, closed);
                    return (
                      <article key={x.id} className={"card" + (closed ? " done" : "")}>
                        <div className="hd">
                          <div>
                            <h3>{x.person}</h3>
                            <div className="sub">
                              {dir === "owe" ? "Olingan" : "Berilgan"}: {sana(x.taken_date)} · Muddat: {sana(x.due_date)}
                            </div>
                          </div>
                          <div className="money">
                            {som(left)}
                            <small>qoldi · jami {som(x.amount)}</small>
                          </div>
                        </div>
                        <div className="meter good"><b style={{ width: Math.min(100, (x.paid / x.amount) * 100) + "%" }} /></div>
                        <div className="meta">
                          <span className={"pill " + m.tone}>{m.text}</span>
                          <span className="num">{dir === "owe" ? "To'langan" : "Qaytarilgan"}: {som(x.paid)} so&apos;m</span>
                        </div>
                        {x.note && <p className="note">{x.note}</p>}
                        <History pays={paysFor("debt", x.id)} onDel={async (id) => { await api(`/api/payments?id=${id}`, "DELETE"); await load(); }} />
                        <div className="acts">
                          {!closed && (
                            <button className="btn acc sm" onClick={() => setModal({ t: "pay", kind: dir, id: x.id, remaining: left, name: x.person })}>
                              {dir === "owe" ? "To'lov qildim" : "Qaytardi"}
                            </button>
                          )}
                          <button className="btn ghost sm" onClick={() => setModal({ t: "debt", dir, item: x })}>Tahrirlash</button>
                          <button className="btn ghost sm" onClick={() => setModal({ t: "del", table: "debts", id: x.id, name: x.person })}>O&apos;chirish</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {data && tab === "xaridlar" && (() => {
          const list = d.purchases.filter((p) => showDone || !p.bought);
          const boughtCount = d.purchases.filter((p) => p.bought).length;
          const prLabel = { yuqori: "Juda kerak", orta: "O'rta", past: "Kutsa bo'ladi" } as const;
          const prTone = { yuqori: "bad", orta: "warn", past: "mut" } as const;
          return (
            <section>
              <SecHead
                title="Olishim kerak bo'lgan narsalar"
                sub={`${s.buyCount} ta narsa · jami ${som(s.buyTotal)} so'm`}
                btn="+ Narsa qo'shish"
                onAdd={() => setModal({ t: "purchase" })}
              />
              {boughtCount > 0 && (
                <div className="filters">
                  <button className="chip" aria-pressed={!showDone} onClick={() => setShowDone(false)}>Olinmagan</button>
                  <button className="chip" aria-pressed={showDone} onClick={() => setShowDone(true)}>Hammasi (+{boughtCount} olingan)</button>
                </div>
              )}
              {list.length === 0 ? (
                <Empty text="Ro'yxat bo'sh. Nima olishni rejalashtiryapsiz?" btn="Narsa qo'shish" onAdd={() => setModal({ t: "purchase" })} />
              ) : (
                <div className="list">
                  {list.map((p) => {
                    const m = muddatLabel(p.planned_date, !!p.bought);
                    return (
                      <article key={p.id} className={"card" + (p.bought ? " done" : "")}>
                        <div className="hd">
                          <div>
                            <h3>{p.name}</h3>
                            <div className="sub">Rejadagi sana: {sana(p.planned_date)}</div>
                          </div>
                          <div className="money">{som(p.price)}<small>so&apos;m</small></div>
                        </div>
                        <div className="meta">
                          <span className={"pill " + m.tone}>{p.bought ? "Olindi" : m.text}</span>
                          {!p.bought && <span className={"pill " + prTone[p.priority]}>{prLabel[p.priority]}</span>}
                        </div>
                        {p.note && <p className="note">{p.note}</p>}
                        <div className="acts">
                          <button
                            className={"btn sm " + (p.bought ? "ghost" : "acc")}
                            onClick={async () => {
                              await api(`/api/purchases/${p.id}`, "PATCH", { bought: p.bought ? 0 : 1 });
                              await done(p.bought ? "Qaytadan ro'yxatga qo'shildi" : "Olindi deb belgilandi");
                            }}
                          >
                            {p.bought ? "Olinmagan qilish" : "Oldim ✓"}
                          </button>
                          <button className="btn ghost sm" onClick={() => setModal({ t: "purchase", item: p })}>Tahrirlash</button>
                          <button className="btn ghost sm" onClick={() => setModal({ t: "del", table: "purchases", id: p.id, name: p.name })}>O&apos;chirish</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}
      </main>

      {modal?.t === "goal" && (
        <Modal title={modal.item ? "Maqsadni tahrirlash" : "Yangi maqsad"} onClose={() => setModal(null)}>
          <GoalForm
            initial={modal.item}
            onClose={() => setModal(null)}
            onSave={async (b) => {
              if (modal.item) await api(`/api/goals/${modal.item.id}`, "PATCH", b);
              else await api("/api/goals", "POST", b);
              await done("Maqsad saqlandi");
            }}
          />
        </Modal>
      )}
      {modal?.t === "debt" && (
        <Modal title={modal.item ? "Qarzni tahrirlash" : "Yangi qarz"} onClose={() => setModal(null)}>
          <DebtForm
            initial={modal.item}
            direction={modal.dir}
            onClose={() => setModal(null)}
            onSave={async (b) => {
              if (modal.item) await api(`/api/debts/${modal.item.id}`, "PATCH", b);
              else await api("/api/debts", "POST", b);
              await done("Qarz saqlandi");
            }}
          />
        </Modal>
      )}
      {modal?.t === "purchase" && (
        <Modal title={modal.item ? "Tahrirlash" : "Olishim kerak bo'lgan narsa"} onClose={() => setModal(null)}>
          <PurchaseForm
            initial={modal.item}
            onClose={() => setModal(null)}
            onSave={async (b) => {
              if (modal.item) await api(`/api/purchases/${modal.item.id}`, "PATCH", b);
              else await api("/api/purchases", "POST", b);
              await done("Saqlandi");
            }}
          />
        </Modal>
      )}
      {modal?.t === "pay" && (
        <Modal
          title={modal.kind === "goal" ? `${modal.name}: pul` : modal.kind === "owe" ? `${modal.name}ga to'lov` : `${modal.name} qaytardi`}
          onClose={() => setModal(null)}
        >
          <PayForm
            kind={modal.kind}
            remaining={modal.remaining}
            onClose={() => setModal(null)}
            onSave={async (b) => {
              await api("/api/payments", "POST", { ...b, kind: modal.kind === "goal" ? "goal" : "debt", ref_id: modal.id });
              await done("Yozib qo'yildi");
            }}
          />
        </Modal>
      )}
      {modal?.t === "del" && (
        <Modal title="O'chirilsinmi?" onClose={() => setModal(null)}>
          <Confirm
            text={`«${modal.name}» va uning to'lovlar tarixi butunlay o'chiriladi.`}
            onClose={() => setModal(null)}
            onYes={async () => {
              await api(`/api/${modal.table}/${modal.id}`, "DELETE");
              await done("O'chirildi");
            }}
          />
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

/* ---------- Umumiy ko'rinish ---------- */
function Overview({
  d,
  s,
  owe,
  lend,
  go,
  add,
}: {
  d: AllData;
  s: { oweLeft: number; lendLeft: number; goalSaved: number; goalTarget: number; buyTotal: number; buyCount: number };
  owe: Debt[];
  lend: Debt[];
  go: (t: Tab) => void;
  add: (m: ModalState) => void;
}) {
  const net = s.lendLeft - s.oweLeft;
  const max = Math.max(s.lendLeft, s.oweLeft, 1);

  type Up = { date: string; title: string; sub: string; amount: number; tab: Tab; tone: string };
  const ups: Up[] = [];
  for (const x of owe) if (x.due_date && x.paid < x.amount) ups.push({ date: x.due_date, title: x.person, sub: "Qarzimni qaytarish", amount: x.amount - x.paid, tab: "qarzlarim", tone: "bad" });
  for (const x of lend) if (x.due_date && x.paid < x.amount) ups.push({ date: x.due_date, title: x.person, sub: "Menga qaytarishi kerak", amount: x.amount - x.paid, tab: "qarzdorlar", tone: "good" });
  for (const g of d.goals) if (g.deadline && g.saved < g.target) ups.push({ date: g.deadline, title: g.name, sub: "Maqsad muddati", amount: g.target - g.saved, tab: "maqsadlar", tone: "" });
  for (const p of d.purchases) if (p.planned_date && !p.bought) ups.push({ date: p.planned_date, title: p.name, sub: "Xarid", amount: p.price, tab: "xaridlar", tone: "" });
  ups.sort((a, b) => a.date.localeCompare(b.date));
  const soon = ups.filter((u) => (daysLeft(u.date) ?? 999) <= 45).slice(0, 8);

  const isEmpty = !d.goals.length && !d.debts.length && !d.purchases.length;

  return (
    <section>
      <div className="hero">
        <div>
          <h1>Sof qarz holati</h1>
          <p className={"big" + (net < 0 ? " neg" : "")}>
            {net > 0 ? "+" : ""}
            {som(net)}
            <small>so&apos;m</small>
          </p>
          <p>
            {net === 0
              ? "Olishim va berishim kerak bo'lgan qarzlar teng."
              : net > 0
              ? "Sizga qaytarilishi kerak bo'lgan pul qarzlaringizdan ko'p."
              : "Qarzlaringiz sizga qaytarilishi kerak bo'lgan puldan ko'p."}
          </p>
        </div>
        <div className="duel">
          <div className="row">
            <div className="lab"><span>Menga qarzdorlar</span><span>{som(s.lendLeft)}</span></div>
            <div className="bar"><b style={{ width: (s.lendLeft / max) * 100 + "%" }} /></div>
          </div>
          <div className="row">
            <div className="lab"><span>Mening qarzlarim</span><span>{som(s.oweLeft)}</span></div>
            <div className="bar acc"><b style={{ width: (s.oweLeft / max) * 100 + "%" }} /></div>
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat k="Qarzlarim" v={som(s.oweLeft)} s={`${owe.filter((x) => x.paid < x.amount).length} ta faol`} />
        <Stat k="Menga qarzlar" v={som(s.lendLeft)} s={`${lend.filter((x) => x.paid < x.amount).length} ta faol`} />
        <Stat
          k="Maqsadlarga yig'ilgan"
          v={som(s.goalSaved)}
          s={s.goalTarget ? `${Math.round((s.goalSaved / s.goalTarget) * 100)}% · ${som(s.goalTarget)} dan` : "maqsad yo'q"}
        />
        <Stat k="Xaridlar uchun kerak" v={som(s.buyTotal)} s={`${s.buyCount} ta narsa`} />
      </div>

      {isEmpty ? (
        <div className="empty">
          Boshlash uchun birinchi yozuvni qo&apos;shing.
          <div className="acts" style={{ justifyContent: "center" }}>
            <button className="btn acc" onClick={() => add({ t: "goal" })}>+ Maqsad</button>
            <button className="btn" onClick={() => add({ t: "debt", dir: "owe" })}>+ Qarzim</button>
            <button className="btn" onClick={() => add({ t: "debt", dir: "lend" })}>+ Menga qarz</button>
            <button className="btn ghost" onClick={() => add({ t: "purchase" })}>+ Xarid</button>
          </div>
        </div>
      ) : (
        <>
          <div className="sechead">
            <div>
              <h2 className="sec">Yaqin muddatlar</h2>
              <p>Keyingi 45 kun va o&apos;tib ketganlar</p>
            </div>
          </div>
          {soon.length === 0 ? (
            <p className="loading" style={{ padding: "8px 0" }}>Yaqin orada muddat yo&apos;q.</p>
          ) : (
            <div className="upcoming">
              {soon.map((u, i) => {
                const m = muddatLabel(u.date);
                return (
                  <button key={i} className="up" style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }} onClick={() => go(u.tab)}>
                    <span className="when">
                      {sana(u.date)}
                      <br />
                      <span className={"pill " + m.tone} style={{ fontSize: 12 }}>{m.text}</span>
                    </span>
                    <span className="what">
                      {u.title}
                      <small>{u.sub}</small>
                    </span>
                    <span className="amt" style={u.tone ? { color: `var(--${u.tone})` } : undefined}>{som(u.amount)} so&apos;m</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}

function SecHead({ title, sub, btn, onAdd }: { title: string; sub: string; btn: string; onAdd: () => void }) {
  return (
    <div className="sechead">
      <div>
        <h2 className="sec">{title}</h2>
        <p>{sub}</p>
      </div>
      <button className="btn acc" onClick={onAdd}>{btn}</button>
    </div>
  );
}

function Empty({ text, btn, onAdd }: { text: string; btn: string; onAdd: () => void }) {
  return (
    <div className="empty">
      {text}
      <button className="btn" onClick={onAdd}>{btn}</button>
    </div>
  );
}

function History({ pays, onDel }: { pays: Payment[]; onDel: (id: number) => Promise<void> }) {
  if (!pays.length) return null;
  return (
    <details className="hist">
      <summary>Tarix ({pays.length})</summary>
      <ul>
        {pays.map((p) => (
          <li key={p.id}>
            <span>{sana(p.date)}</span>
            <span style={{ flex: 1, color: "var(--muted)", whiteSpace: "normal" }}>{p.note}</span>
            <span>{p.amount > 0 ? "+" : ""}{som(p.amount)}</span>
            <button className="x" aria-label="O'chirish" onClick={() => onDel(p.id)}>×</button>
          </li>
        ))}
      </ul>
    </details>
  );
}
