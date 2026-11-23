"use client";

import { useEffect, useMemo, useState } from "react";
import { som } from "@/lib/format";
import { api, Field, MoneyInput, parseMoney, useStore } from "./ui";
import { usePortfolio } from "./Crypto";

const TROY_OZ_G = 31.1035;

/**
 * Zakot kalkulyatori.
 * Nisob standart qiymati — O'zbekiston musulmonlari idorasi Fatvo markazi 2026 yil uchun e'lon qilgan
 * 100 000 000 so'm (≈ 85 g 585 probali tilla). Har yil Ramazonda yangilanadi — foydalanuvchi o'zgartira oladi.
 */
export default function Zakat() {
  const { d, act } = useStore();
  const z = d.zakat;
  const pf = usePortfolio(true);
  const [cashUzs, setCashUzs] = useState(z?.cash_uzs ? som(z.cash_uzs) : "");
  const [cashUsd, setCashUsd] = useState(z?.cash_usd ? String(z.cash_usd) : "");
  const [gold, setGold] = useState(z?.gold_g ? String(z.gold_g) : "");
  const [trade, setTrade] = useState(z?.trade_uzs ? som(z.trade_uzs) : "");
  const [nisab, setNisab] = useState(som(z?.nisab_uzs ?? 100_000_000));
  const [incGoals, setIncGoals] = useState(z ? !!z.include_goals : true);
  const [incCrypto, setIncCrypto] = useState(z ? !!z.include_crypto : true);
  const [incDebts, setIncDebts] = useState(z ? !!z.include_debts : true);
  const [saved, setSaved] = useState(true);
  useEffect(() => setSaved(false), [cashUzs, cashUsd, gold, trade, nisab, incGoals, incCrypto, incDebts]);

  const rate = pf.data?.usd_uzs ?? null;
  const goldPerG = pf.data?.gold_usd_oz && rate ? (pf.data.gold_usd_oz / TROY_OZ_G) * rate : null; // sof oltin, so'm/gramm

  const calc = useMemo(() => {
    const n = (s: string) => Number(s.replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    const rows: { label: string; v: number; note?: string }[] = [];
    const add = (label: string, v: number, note?: string) => v && rows.push({ label, v, note });
    add("Naqd pul (so'm)", parseMoney(cashUzs));
    if (rate) add("Naqd dollar", n(cashUsd) * rate, `${n(cashUsd)} $`);
    if (goldPerG) add("Oltin taqinchoq/yombi", n(gold) * goldPerG, `${n(gold)} g`);
    add("Tijorat mollari", parseMoney(trade));
    if (incGoals) add("Maqsadlarga yig'ilgan", d.goals.reduce((a, g) => a + g.saved, 0));
    if (incCrypto && pf.data && rate && pf.data.value) add("Kripto va XAUt", pf.data.value * rate, `$${Math.round(pf.data.value).toLocaleString("en-US")}`);
    if (incDebts) add("Sizga qaytariladigan qarzlar", d.debts.filter((x) => x.direction === "lend").reduce((a, x) => a + Math.max(0, x.amount - x.paid), 0));
    const owed = incDebts ? d.debts.filter((x) => x.direction === "owe").reduce((a, x) => a + Math.max(0, x.amount - x.paid), 0) : 0;
    const gross = rows.reduce((a, r) => a + r.v, 0);
    const net = Math.max(0, gross - owed);
    const nis = parseMoney(nisab);
    return { rows, owed, gross, net, nis, due: net >= nis && nis > 0, zakat: net >= nis ? net * 0.025 : 0 };
  }, [cashUzs, cashUsd, gold, trade, nisab, incGoals, incCrypto, incDebts, d.goals, d.debts, pf.data, rate, goldPerG]);

  const save = () =>
    act(
      () =>
        api("/api/zakat", "POST", {
          cash_uzs: parseMoney(cashUzs),
          cash_usd: Number(cashUsd.replace(",", ".")) || 0,
          gold_g: Number(gold.replace(",", ".")) || 0,
          trade_uzs: parseMoney(trade),
          nisab_uzs: parseMoney(nisab),
          include_goals: incGoals,
          include_crypto: incCrypto,
          include_debts: incDebts,
        }),
      "Saqlandi"
    ).then(() => setSaved(true));

  const Tog = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
    <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, minHeight: 36 }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--brand)" }} />
      {label}
    </label>
  );

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 6, background: calc.due ? "var(--money)" : "var(--ink)", color: calc.due ? "#fff" : "var(--bg)" }}>
        <span style={{ opacity: 0.8, fontWeight: 600, fontSize: 14 }}>{calc.due ? "Zakot farz — berilishi kerak" : "Nisobga yetmagan — zakot farz emas"}</span>
        <span className="num" style={{ fontSize: "clamp(30px, 8vw, 42px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          {som(Math.round(calc.zakat))} so&apos;m
        </span>
        <span style={{ opacity: 0.8, fontSize: 14 }}>
          Zakotga tortiladigan mablag&apos;: <b>{som(Math.round(calc.net))}</b> · nisob {som(calc.nis)} so&apos;m
        </span>
        {calc.nis > 0 && (
          <div className="bar" style={{ background: "rgb(255 255 255 / .2)", marginTop: 6 }}>
            <b style={{ width: Math.min(100, (calc.net / calc.nis) * 100) + "%", background: "#fff" }} />
          </div>
        )}
      </div>

      <div className="card form">
        <h2 style={{ margin: 0 }}>Mablag&apos;laringiz</h2>
        <div className="two">
          <Field label="Naqd va kartadagi pul (so'm)" htmlFor="z-uzs">
            <MoneyInput id="z-uzs" value={cashUzs} onChange={setCashUzs} />
          </Field>
          <Field label="Dollar ($)" htmlFor="z-usd" hint={rate ? `1$ = ${som(rate)} so'm` : undefined}>
            <input id="z-usd" inputMode="decimal" value={cashUsd} onChange={(e) => setCashUsd(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div className="two">
          <Field label="Oltin (gramm, sof)" htmlFor="z-gold" hint={goldPerG ? `1 g ≈ ${som(Math.round(goldPerG))} so'm (XAUt narxidan)` : "Oltin narxi yuklanmoqda…"}>
            <input id="z-gold" inputMode="decimal" value={gold} onChange={(e) => setGold(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Tijorat mollari (so'm)" htmlFor="z-trade">
            <MoneyInput id="z-trade" value={trade} onChange={setTrade} />
          </Field>
        </div>
        <div style={{ display: "grid" }}>
          <Tog on={incGoals} set={setIncGoals} label={`Maqsadlarga yig'ilgan pulni qo'shish (${som(d.goals.reduce((a, g) => a + g.saved, 0))})`} />
          <Tog on={incCrypto} set={setIncCrypto} label="Kripto portfel va XAUt'ni qo'shish" />
          <Tog on={incDebts} set={setIncDebts} label="Qarzlarni hisobga olish (menga qaytadigan +, mening qarzim −)" />
        </div>
        <Field label="Nisob (so'm)" htmlFor="z-nis" hint="O'zbekiston musulmonlari idorasi 2026 yil uchun: 100 000 000 so'm (≈ 85 g tilla). Har yil Ramazonda yangilanadi.">
          <MoneyInput id="z-nis" value={nisab} onChange={setNisab} />
        </Field>
        <button className="btn brand" onClick={save} disabled={saved}>
          {saved ? "Saqlangan" : "Saqlash"}
        </button>
      </div>

      {calc.rows.length > 0 && (
        <div className="card flush">
          <h2>Hisob</h2>
          <div className="rows">
            {calc.rows.map((r) => (
              <div key={r.label} className="row" style={{ minHeight: 46 }}>
                <span className="body">
                  <span className="t" style={{ fontWeight: 500 }}>
                    {r.label}
                  </span>
                  {r.note && <span className="m">{r.note}</span>}
                </span>
                <span className="amt">{som(Math.round(r.v))}</span>
              </div>
            ))}
            {calc.owed > 0 && (
              <div className="row" style={{ minHeight: 46 }}>
                <span className="body t" style={{ fontWeight: 500 }}>
                  Mening qarzlarim
                </span>
                <span className="amt" style={{ color: "var(--bad)" }}>
                  −{som(calc.owed)}
                </span>
              </div>
            )}
            <div className="row" style={{ minHeight: 46 }}>
              <span className="body t">Zakot (2,5%)</span>
              <span className="amt" style={{ fontSize: 18 }}>
                {som(Math.round(calc.zakat))}
              </span>
            </div>
          </div>
        </div>
      )}
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
        Zakot nisobga yetgan mol ustidan bir hijriy yil o&apos;tganda farz bo&apos;ladi; miqdori — 2,5%. Asosiy ehtiyojlar (uy, kiyim, ulov, ish qurollari) hisobga
        kirmaydi. Bu kalkulyator taxminiy — aniq holat bo&apos;yicha imomga murojaat qiling.
      </p>
    </>
  );
}
