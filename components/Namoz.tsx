"use client";

import { useEffect, useState } from "react";
import { todayStr } from "@/lib/format";
import { api, Check, Empty, useStore } from "./ui";
import { I } from "./icons";

export type PrayerResp = {
  region: string;
  date: string;
  times: Record<"bomdod" | "quyosh" | "peshin" | "asr" | "shom" | "xufton", string> & { source: string };
  regions: string[];
};

export const FARZ = ["bomdod", "peshin", "asr", "shom", "xufton"] as const;
export const QAZA_KINDS = ["bomdod", "peshin", "asr", "shom", "xufton", "vitr"] as const;
export const PNAME: Record<string, string> = { bomdod: "Bomdod", quyosh: "Quyosh", peshin: "Peshin", asr: "Asr", shom: "Shom", xufton: "Xufton", vitr: "Vitr" };

const cache = new Map<string, PrayerResp>();

/** Bugungi namoz vaqtlari (sahifalar o'rtasida keshlanadi) */
export function usePrayer(date = todayStr(), region?: string) {
  const key = `${date}|${region || ""}`;
  const [data, setData] = useState<PrayerResp | null>(cache.get(key) ?? null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (cache.has(key)) return setData(cache.get(key)!);
    api<PrayerResp>(`/api/prayer?date=${date}${region ? `&region=${encodeURIComponent(region)}` : ""}`)
      .then((r) => {
        cache.set(key, r);
        setData(r);
      })
      .catch((e) => setErr((e as Error).message));
  }, [key, date, region]);
  return { data, err, clear: () => cache.clear() };
}

const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

/** Keyingi namoz va unga qolgan vaqt */
export function nextPrayer(times: PrayerResp["times"], nowMin: number) {
  for (const k of ["bomdod", "quyosh", "peshin", "asr", "shom", "xufton"] as const) {
    if (toMin(times[k]) > nowMin) return { key: k, at: times[k], left: toMin(times[k]) - nowMin };
  }
  return { key: "bomdod" as const, at: times.bomdod, left: 1440 - nowMin + toMin(times.bomdod) };
}
export const leftText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} soat ${m % 60} daqiqa` : `${m} daqiqa`);

function useNowMin() {
  const get = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [n, setN] = useState(get);
  useEffect(() => {
    const t = setInterval(() => setN(get()), 30000);
    return () => clearInterval(t);
  }, []);
  return n;
}

export function PrayerChecks({ date, compact }: { date: string; compact?: boolean }) {
  const { d, act, haptic } = useStore();
  const { data } = usePrayer(date);
  const done = new Set(d.prayer_log.filter((l) => l.date.slice(0, 10) === date).map((l) => l.prayer));
  const nowMin = useNowMin();
  const isToday = date === todayStr();
  return (
    <div className="rows">
      {FARZ.map((p) => {
        const t = data?.times[p];
        const on = done.has(p);
        const future = isToday && t ? toMin(t) > nowMin : false;
        return (
          <div key={p} className={"row" + (on ? " done" : "")} style={compact ? { minHeight: 48 } : undefined}>
            <Check
              on={on}
              label={PNAME[p]}
              round
              color="var(--habit)"
              onClick={() => {
                haptic(on ? "light" : "success");
                act(() => api("/api/prayer", "POST", { date, prayer: p, on: !on }));
              }}
            />
            <div className="body">
              <span className="t">{PNAME[p]}</span>
            </div>
            <span className="num" style={{ color: future ? "var(--muted)" : "var(--ink)", fontWeight: 700 }}>
              {t ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Namoz({ openSettings }: { openSettings: () => void }) {
  const { d, act, haptic } = useStore();
  const date = todayStr();
  const { data, err } = usePrayer(date);
  const nowMin = useNowMin();
  const nx = data ? nextPrayer(data.times, nowMin) : null;
  const qaza = Object.fromEntries(d.qaza.map((q) => [q.prayer, q]));
  const total = QAZA_KINDS.reduce((a, k) => a + (qaza[k]?.count || 0), 0);
  const doneTotal = QAZA_KINDS.reduce((a, k) => a + (qaza[k]?.done_total || 0), 0);
  const [bulk, setBulk] = useState(false);

  return (
    <>
      <div className="ph">
        <div>
          <h1>Namoz</h1>
          <p>{data ? `${data.region} · ${data.times.source === "hisob" ? "taxminiy vaqtlar" : "islom.uz"}` : "Yuklanmoqda…"}</p>
        </div>
        <button className="btn sm soft" onClick={openSettings}>
          Eslatmalar
        </button>
      </div>

      {err && (
        <div className="card">
          <Empty emoji="⚠️" text={`Vaqtlarni olib bo'lmadi: ${err}`} />
        </div>
      )}

      {data && nx && (
        <div className="card" style={{ display: "grid", gap: 4, background: "var(--ink)", color: "var(--bg)" }}>
          <span style={{ opacity: 0.7, fontWeight: 600, fontSize: 14 }}>Keyingi: {PNAME[nx.key]}</span>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }} className="num">
            {nx.at}
          </span>
          <span style={{ opacity: 0.7, fontSize: 14 }}>{leftText(nx.left)} qoldi</span>
        </div>
      )}

      <div className="card flush" style={{ "--c": "var(--habit)" } as React.CSSProperties}>
        <h2>
          Bugun o&apos;qilganlar
          <span className="pill good">{d.prayer_log.filter((l) => l.date.slice(0, 10) === date).length}/5</span>
        </h2>
        <PrayerChecks date={date} />
        {data && (
          <div style={{ padding: "4px 12px 12px", fontSize: 13, color: "var(--muted)" }}>
            Quyosh chiqishi: <b className="num">{data.times.quyosh}</b>
          </div>
        )}
      </div>

      <div className="card">
        <h2>
          Qazo namozlar
          <span className="pill">{total} ta</span>
        </h2>
        <p style={{ margin: "-4px 0 12px", fontSize: 14, color: "var(--muted)" }}>
          Qazo o&apos;qisangiz — «−», qolib ketgan bo&apos;lsa — «+». {doneTotal > 0 && <>Jami o&apos;qilgan: <b>{doneTotal}</b> ta.</>}
        </p>
        <div className="rows">
          {QAZA_KINDS.map((k) => {
            const c = qaza[k]?.count || 0;
            return (
              <div key={k} className="row" style={{ padding: "8px 0" }}>
                <div className="body">
                  <span className="t">{PNAME[k]}</span>
                </div>
                <button
                  className="more"
                  aria-label={`${PNAME[k]} qazosi o'qildi`}
                  disabled={!c}
                  style={{ border: "1px solid var(--line)", opacity: c ? 1 : 0.4 }}
                  onClick={() => {
                    haptic("success");
                    act(() => api("/api/qaza", "POST", { prayer: k, delta: -1 }), "Qabul bo'lsin ✓");
                  }}
                >
                  −
                </button>
                <span className="num" style={{ minWidth: 44, textAlign: "center", fontWeight: 800, fontSize: 20 }}>
                  {c}
                </span>
                <button
                  className="more"
                  aria-label={`${PNAME[k]} qazosi qo'shish`}
                  style={{ border: "1px solid var(--line)" }}
                  onClick={() => act(() => api("/api/qaza", "POST", { prayer: k, delta: 1 }))}
                >
                  <I.plus />
                </button>
              </div>
            );
          })}
        </div>
        <div className="acts" style={{ marginTop: 12 }}>
          <button className="btn sm soft" onClick={() => setBulk(!bulk)}>
            {bulk ? "Yopish" : "Ko'p kunlik qazo qo'shish"}
          </button>
        </div>
        {bulk && <BulkQaza onDone={() => setBulk(false)} />}
      </div>
    </>
  );
}

/** Necha kunlik qazo qolganini bir yo'la kiritish (har kuniga 5 farz + vitr) */
function BulkQaza({ onDone }: { onDone: () => void }) {
  const { act } = useStore();
  const [days, setDays] = useState("");
  const [vitr, setVitr] = useState(true);
  return (
    <form
      className="form"
      style={{ marginTop: 12 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Math.min(10000, Number(days) || 0);
        if (!n) return;
        await act(async () => {
          for (const k of vitr ? QAZA_KINDS : FARZ) await api("/api/qaza", "POST", { prayer: k, delta: n });
        }, `${n} kunlik qazo qo'shildi`);
        onDone();
      }}
    >
      <div className="field">
        <label htmlFor="qd">Necha kunlik namoz qazo bo&apos;lgan?</label>
        <input id="qd" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} placeholder="Masalan: 30" />
        <span className="hint">Har bir namozga shu son qo&apos;shiladi</span>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
        <input type="checkbox" checked={vitr} onChange={(e) => setVitr(e.target.checked)} style={{ width: 20, height: 20 }} />
        Vitrni ham qo&apos;shish
      </label>
      <button className="btn brand" type="submit">
        Qo&apos;shish
      </button>
    </form>
  );
}
