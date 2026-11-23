"use client";

import { useCallback, useEffect, useState } from "react";
import type { Holding } from "@/lib/types";
import { som } from "@/lib/format";
import { api, Empty, Field, Sheet, useStore, useSubmit, Foot, Confirm } from "./ui";
import { I } from "./icons";

type Item = Holding & { price: number | null; change24: number | null; value: number; dayPnl: number; totalPnl: number | null };
type Resp = {
  items: Item[];
  value: number;
  dayPnl: number;
  dayPct: number;
  totalPnl: number | null;
  totalPct: number | null;
  usd_uzs: number | null;
  stale: boolean;
  presets: { coin: string; symbol: string; name: string }[];
};

export const usd = (n: number, frac?: number) => {
  const a = Math.abs(n);
  const f = frac ?? (a < 1 ? 4 : 2);
  return (n < 0 ? "−$" : "$") + a.toLocaleString("en-US", { minimumFractionDigits: f, maximumFractionDigits: f });
};
const signUsd = (n: number) => (n > 0 ? "+" : "") + usd(n);
const pct = (n: number | null) => (n === null ? "" : (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2) + "%");
const tone = (n: number) => (n > 0 ? "var(--money)" : n < 0 ? "var(--bad)" : "var(--muted)");
const mlnSom = (n: number) => {
  const a = Math.abs(n);
  return (n < 0 ? "−" : "") + (a >= 1e6 ? (a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(".0", "") + " mln" : som(a)) + " so'm";
};

/** Portfel ma'lumoti (Bugun sahifasi ham ishlatadi) */
export function usePortfolio(enabled = true) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setData(await api<Resp>(`/api/prices${force ? "?force=1" : ""}`));
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);
  return { data, loading, err, load };
}

export default function Crypto() {
  const { d } = useStore();
  const { data, loading, err, load } = usePortfolio();
  const [open, setOpen] = useState<Holding | "new" | null>(null);
  // Aktivlar o'zgarganda narxlarni qayta hisoblash
  const sig = d.holdings.map((h) => `${h.id}:${h.amount}:${h.avg_price}`).join("|");
  useEffect(() => {
    load();
  }, [sig, load]);

  return (
    <>
      {data && data.items.length > 0 && (
        <div className="card" style={{ display: "grid", gap: 6, background: "var(--ink)", color: "var(--bg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ opacity: 0.7, fontWeight: 600, fontSize: 14 }}>Portfel qiymati</span>
            <button
              onClick={() => load(true)}
              aria-label="Yangilash"
              style={{ background: "none", border: 0, color: "inherit", opacity: 0.8, fontSize: 13, fontWeight: 700, padding: 6 }}
            >
              {loading ? "…" : "↻ Yangilash"}
            </button>
          </div>
          <span className="num" style={{ fontSize: "clamp(32px, 8vw, 44px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {usd(data.value, 2)}
          </span>
          {data.usd_uzs && <span style={{ opacity: 0.7, fontSize: 14 }}>≈ {mlnSom(data.value * data.usd_uzs)} · 1$ = {som(data.usd_uzs)} so&apos;m</span>}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
            <div>
              <div style={{ opacity: 0.65, fontSize: 12, fontWeight: 600 }}>Kechagidan (24 soat)</div>
              <div className="num" style={{ fontWeight: 800, color: data.dayPnl >= 0 ? "#35c98f" : "#ff6b5e" }}>
                {signUsd(data.dayPnl)} ({pct(data.dayPct)})
              </div>
              {data.usd_uzs && <div style={{ opacity: 0.65, fontSize: 12 }}>{(data.dayPnl >= 0 ? "+" : "") + mlnSom(data.dayPnl * data.usd_uzs)}</div>}
            </div>
            {data.totalPnl !== null && (
              <div>
                <div style={{ opacity: 0.65, fontSize: 12, fontWeight: 600 }}>Sotib olingandan beri</div>
                <div className="num" style={{ fontWeight: 800, color: data.totalPnl >= 0 ? "#35c98f" : "#ff6b5e" }}>
                  {signUsd(data.totalPnl)} ({pct(data.totalPct)})
                </div>
              </div>
            )}
          </div>
          {data.stale && <span style={{ fontSize: 12, opacity: 0.7 }}>⚠️ Narx manbai javob bermadi — oxirgi ma&apos;lum narxlar</span>}
        </div>
      )}

      {err && (
        <div className="card">
          <Empty emoji="⚠️" text={`Narxlarni olib bo'lmadi: ${err}`} btn="Qayta urinish" onAdd={() => load(true)} />
        </div>
      )}

      <div className="card flush">
        {d.holdings.length === 0 ? (
          <Empty
            emoji="🪙"
            text="Kripto va oltiningizni qo'shing — har kuni ertalab bot kechagidan qancha foyda yoki zarar qilganingizni yuboradi."
            btn="Aktiv qo'shish"
            onAdd={() => setOpen("new")}
          />
        ) : (
          <div className="rows">
            {(data?.items ?? d.holdings.map((h) => ({ ...h, price: null, change24: null, value: 0, dayPnl: 0, totalPnl: null }))).map((it) => (
              <div key={it.id} className="row click" onClick={() => setOpen(d.holdings.find((h) => h.id === it.id) ?? null)}>
                <div className="ico" style={{ fontWeight: 800, fontSize: 12 }}>
                  {it.symbol.slice(0, 4)}
                </div>
                <div className="body">
                  <span className="t">
                    {it.symbol} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{Number(Number(it.amount).toPrecision(8))}</span>
                  </span>
                  <span className="m">
                    {it.price !== null ? usd(it.price) : "narx…"}
                    {it.change24 !== null && <span style={{ color: tone(it.change24), fontWeight: 700 }}>{pct(it.change24)}</span>}
                    {it.totalPnl !== null && <span style={{ color: tone(it.totalPnl) }}>jami {signUsd(it.totalPnl)}</span>}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="amt">{usd(it.value, 2)}</div>
                  <div className="num" style={{ fontSize: 12, color: tone(it.dayPnl), fontWeight: 700 }}>
                    {signUsd(it.dayPnl)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
        Narxlar: CoinGecko (USD). Dollar kursi: O&apos;zbekiston Markaziy banki. «Kechagidan» — so&apos;nggi 24 soatdagi narx o&apos;zgarishi.
      </p>

      <button className="fab" aria-label="Aktiv qo'shish" onClick={() => setOpen("new")}>
        <I.plus />
      </button>
      {open && <HoldingForm initial={open === "new" ? undefined : open} presets={data?.presets ?? []} onClose={() => setOpen(null)} />}
    </>
  );
}

function HoldingForm({ initial, presets, onClose }: { initial?: Holding; presets: Resp["presets"]; onClose: () => void }) {
  const { act } = useStore();
  const [coin, setCoin] = useState(initial?.coin ?? "the-open-network");
  const [symbol, setSymbol] = useState(initial?.symbol ?? "GRAM");
  const [name, setName] = useState(initial?.name ?? "Gram (Toncoin)");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [avg, setAvg] = useState(initial?.avg_price ? String(initial.avg_price) : "");
  const [custom, setCustom] = useState(!!initial && !presets.some((p) => p.coin === initial.coin));
  const [ask, setAsk] = useState(false);
  const num = (s: string) => Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  const { busy, err, run } = useSubmit(async (b) => {
    await act(() => (initial ? api(`/api/holdings/${initial.id}`, "PATCH", b) : api("/api/holdings", "POST", b)), "Saqlandi");
    onClose();
  });
  return (
    <Sheet title={initial ? initial.symbol : "Aktiv qo'shish"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!coin.trim() || !symbol.trim() || !(num(amount) >= 0)) return;
          run({ coin: coin.trim().toLowerCase(), symbol: symbol.trim().toUpperCase(), name, amount: num(amount), avg_price: avg ? num(avg) : null });
        }}
      >
        <Field label="Aktiv" htmlFor="h-coin">
          <div className="chips" id="h-coin">
            {presets.map((p) => (
              <button
                key={p.coin}
                type="button"
                aria-pressed={!custom && coin === p.coin}
                onClick={() => {
                  setCustom(false);
                  setCoin(p.coin);
                  setSymbol(p.symbol);
                  setName(p.name);
                }}
              >
                {p.symbol}
              </button>
            ))}
            <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>
              Boshqa
            </button>
          </div>
        </Field>
        {custom && (
          <div className="two">
            <Field label="CoinGecko ID" htmlFor="h-id" hint="coingecko.com sahifa manzilidagi nom, masalan: dogecoin">
              <input id="h-id" value={coin} onChange={(e) => setCoin(e.target.value)} />
            </Field>
            <Field label="Belgi" htmlFor="h-sym">
              <input id="h-sym" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="DOGE" />
            </Field>
          </div>
        )}
        <Field label={`Miqdor (${symbol || "dona"})`} htmlFor="h-amount" hint={coin === "tether-gold" ? "1 XAUt = 1 troy unsiya (≈31.1 gramm) oltin" : undefined}>
          <input id="h-amount" className="huge" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="O'rtacha sotib olish narxi, $ (ixtiyoriy)" htmlFor="h-avg" hint="Kiritsangiz, umumiy foyda/zarar ham hisoblanadi">
          <input id="h-avg" inputMode="decimal" value={avg} onChange={(e) => setAvg(e.target.value)} placeholder="Masalan: 1.25" />
        </Field>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} onDelete={initial ? () => setAsk(true) : undefined} />
      </form>
      {ask && initial && (
        <Confirm
          text={`${initial.symbol} portfeldan o'chiriladi.`}
          onClose={() => setAsk(false)}
          onYes={async () => {
            await act(() => api(`/api/holdings/${initial.id}`, "DELETE"), "O'chirildi");
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
