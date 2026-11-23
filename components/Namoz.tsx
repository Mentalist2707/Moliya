"use client";

import { useEffect, useState } from "react";
import { sanaNisbiy, todayStr } from "@/lib/format";
import { api, Check, Empty, Seg, useStore } from "./ui";
import Fasting from "./Fasting";
import Quran from "./Quran";
import { I } from "./icons";

export type PrayerResp = {
  region: string;
  date: string;
  times: Record<"bomdod" | "quyosh" | "peshin" | "asr" | "shom" | "xufton", string> & { source: string };
  regions: string[];
};

export const FARZ = ["bomdod", "peshin", "asr", "shom", "xufton"] as const;
export const QAZA_KINDS = ["bomdod", "peshin", "asr", "shom", "xufton", "vitr"] as const; // ro'za qazosi Ro'za bo'limida
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
  const done = new Set(d.prayer_log.filter((l) => l.date.slice(0, 10) === date && l.status !== "qazo").map((l) => l.prayer));
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
                act(() => api("/api/prayer", "POST", { date, prayer: p, status: on ? null : "oqildi" }));
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

export default function Ibodat({ openSettings, quranGoal }: { openSettings: () => void; quranGoal: number }) {
  const [seg, setSeg] = useState<"namoz" | "roza" | "quron">(() => {
    if (typeof window === "undefined") return "namoz";
    const h = location.hash.split("-")[1];
    return h === "roza" || h === "quron" ? h : "namoz";
  });
  return (
    <>
      <div className="ph">
        <div>
          <h1>Ibodat</h1>
        </div>
        <button className="btn sm soft" onClick={openSettings}>
          Eslatmalar
        </button>
      </div>
      <Seg
        label="Ibodat bo'limi"
        value={seg}
        onChange={(v) => {
          setSeg(v);
          history.replaceState(null, "", "#namoz" + (v === "namoz" ? "" : "-" + v));
        }}
        options={[
          { v: "namoz", t: "Namoz" },
          { v: "roza", t: "Ro'za" },
          { v: "quron", t: "Qur'on" },
        ]}
      />
      {seg === "namoz" && <NamozPage />}
      {seg === "roza" && <Fasting />}
      {seg === "quron" && <Quran goal={quranGoal} openSettings={openSettings} />}
    </>
  );
}

function NamozPage() {
  const { d } = useStore();
  const date = todayStr();
  const { data, err } = usePrayer(date);
  const nowMin = useNowMin();
  const nx = data ? nextPrayer(data.times, nowMin) : null;
  const todayDone = d.prayer_log.filter((l) => l.date.slice(0, 10) === date && l.status !== "qazo").length;

  return (
    <>
      <p style={{ margin: "-8px 0 0", color: "var(--muted)", fontSize: 14 }}>
        {data ? `${data.region} · ${data.times.source === "hisob" ? "hisoblangan vaqt" : "islom.uz"}` : "Yuklanmoqda…"}
      </p>

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
          <span className="pill good">{todayDone}/5</span>
        </h2>
        <PrayerChecks date={date} />
        {data && (
          <div style={{ padding: "4px 12px 12px", fontSize: 13, color: "var(--muted)" }}>
            Quyosh chiqishi: <b className="num">{data.times.quyosh}</b>
          </div>
        )}
      </div>

      <QazaCard />
      <PastDays />
      <QazaHistory />
    </>
  );
}

/* ---------- Qazo hisobi ---------- */
function QazaCard() {
  const { d, act, haptic } = useStore();
  const [bulk, setBulk] = useState(false);
  const qaza = Object.fromEntries(d.qaza.map((q) => [q.prayer, q]));
  const total = QAZA_KINDS.reduce((a, k) => a + (qaza[k]?.count || 0), 0);
  const doneTotal = QAZA_KINDS.reduce((a, k) => a + (qaza[k]?.done_total || 0), 0);
  const pct = total + doneTotal ? (doneTotal / (total + doneTotal)) * 100 : 0;
  // So'nggi 7 kunda o'rtacha nechta qazo o'qilgan
  const weekAgo = todayStr(-6);
  const weekDone = d.qaza_log.filter((l) => l.kind === "manual" && l.delta < 0 && l.date.slice(0, 10) >= weekAgo).reduce((a, l) => a - l.delta, 0);
  const perDay = weekDone / 7;
  const finishDays = total && perDay > 0 ? Math.ceil(total / perDay) : null;

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>
        Qazo namozlar
        <span className="pill">{total} ta qoldi</span>
      </h2>
      {total + doneTotal > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <div className="bar" style={{ height: 12 }}>
            <b style={{ width: pct + "%", background: "var(--habit)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
            <span>
              O&apos;qildi: <b style={{ color: "var(--ink)" }}>{doneTotal}</b> · {Math.round(pct)}%
            </span>
            <span>
              7 kunda: <b style={{ color: "var(--ink)" }}>{weekDone}</b>
              {finishDays ? ` · shu tezlikda ~${finishDays} kunda tugaydi` : ""}
            </span>
          </div>
        </div>
      )}
      <div className="rows">
        {QAZA_KINDS.map((k) => {
          const c = qaza[k]?.count || 0;
          const dn = qaza[k]?.done_total || 0;
          return (
            <div key={k} className="row" style={{ padding: "8px 0", minHeight: 52 }}>
              <div className="body">
                <span className="t">{PNAME[k]}</span>
                {dn > 0 && <span className="m">{dn} ta o&apos;qilgan</span>}
              </div>
              <button
                className="more"
                aria-label={`${PNAME[k]} qazosini o'qidim`}
                disabled={!c}
                style={{ border: "1px solid var(--line)", opacity: c ? 1 : 0.4, width: 44, height: 44, fontSize: 20 }}
                onClick={() => {
                  haptic("success");
                  act(() => api("/api/qaza", "POST", { prayer: k, delta: -1 }), `${PNAME[k]} qazosi o'qildi ✓`);
                }}
              >
                −
              </button>
              <span className="num" style={{ minWidth: 48, textAlign: "center", fontWeight: 800, fontSize: 22 }}>
                {c}
              </span>
              <button
                className="more"
                aria-label={`${PNAME[k]} qazosi qo'shish`}
                style={{ border: "1px solid var(--line)", width: 44, height: 44 }}
                onClick={() => act(() => api("/api/qaza", "POST", { prayer: k, delta: 1 }))}
              >
                <I.plus />
              </button>
            </div>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>«−» — qazo o&apos;qidim, «+» — qazo qo&apos;shish.</p>
      <div className="acts">
        <button className="btn sm soft" onClick={() => setBulk(!bulk)}>
          {bulk ? "Yopish" : "Ko'p kunlik qazo qo'shish"}
        </button>
      </div>
      {bulk && <BulkQaza onDone={() => setBulk(false)} />}
    </div>
  );
}

/* ---------- O'tgan kunlar: har bir namoz holati ---------- */
type St = "oqildi" | "qazo" | null;
const SHORT: Record<string, string> = { bomdod: "B", peshin: "P", asr: "A", shom: "Sh", xufton: "X" };

function PastDays() {
  const { d, act, haptic } = useStore();
  const [range, setRange] = useState(7);
  const today = todayStr();
  const since = d.tracking_since || today;
  const status = new Map(d.prayer_log.map((l) => [`${l.date.slice(0, 10)}|${l.prayer}`, l.status as St]));
  const days: string[] = [];
  for (let i = 1; i <= range; i++) {
    const x = todayStr(-i);
    if (x < since) break;
    days.push(x);
  }
  const missed = days.reduce((a, x) => a + FARZ.filter((p) => !status.get(`${x}|${p}`)).length, 0);
  const cycle = (st: St): St => (st === null ? "oqildi" : st === "oqildi" ? "qazo" : null);
  const label = (st: St) => (st === "oqildi" ? "o'qildi" : st === "qazo" ? "qazoga yozilgan" : "belgilanmagan");

  if (!days.length) {
    return (
      <div className="card">
        <h2 style={{ margin: 0 }}>O&apos;tgan kunlar</h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
          Ertadan boshlab bu yerda har kunning namozlari ko&apos;rinadi: o&apos;qilgan, qazoga yozilgan yoki belgilanmagan. Ilgarigi qazolaringizni «Ko&apos;p kunlik qazo
          qo&apos;shish» orqali kiriting.
        </p>
      </div>
    );
  }

  return (
    <div className="card flush">
      <h2>
        O&apos;tgan kunlar
        {missed > 0 ? <span className="pill warn">{missed} ta belgilanmagan</span> : <span className="pill good">hammasi belgilangan</span>}
      </h2>
      <div style={{ padding: "0 12px 8px", display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--muted)", alignItems: "center" }}>
        <span>
          <Dot st="oqildi" /> o&apos;qildi
        </span>
        <span>
          <Dot st="qazo" /> qazo
        </span>
        <span>
          <Dot st={null} /> belgilanmagan
        </span>
        <span>· bosib o&apos;zgartiring</span>
      </div>
      <div className="rows">
        {days.map((x) => (
          <div key={x} className="row" style={{ padding: "6px 12px", minHeight: 52 }}>
            <span className="body" style={{ minWidth: 70 }}>
              <span className="t" style={{ fontSize: 14 }}>
                {sanaNisbiy(x)}
              </span>
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {FARZ.map((p) => {
                const st = status.get(`${x}|${p}`) ?? null;
                return (
                  <button
                    key={p}
                    aria-label={`${sanaNisbiy(x)}, ${PNAME[p]}: ${label(st)}`}
                    title={`${PNAME[p]}: ${label(st)}`}
                    onClick={() => {
                      haptic("light");
                      act(() => api("/api/prayer", "POST", { date: x, prayer: p, status: cycle(st) }));
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      border: st ? 0 : "1.5px dashed var(--line)",
                      background: st === "oqildi" ? "var(--habit)" : st === "qazo" ? "var(--warn)" : "transparent",
                      color: st ? "#fff" : "var(--muted)",
                      fontWeight: 800,
                      fontSize: 12,
                      padding: 0,
                    }}
                  >
                    {SHORT[p]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="acts" style={{ padding: 12 }}>
        {missed > 0 && (
          <button
            className="btn sm brand"
            onClick={() =>
              act(() => api("/api/prayer", "POST", { bulk_qaza: true, from: days[days.length - 1], to: days[0] }), `${missed} ta namoz qazoga yozildi`)
            }
          >
            Belgilanmagan {missed} tasini qazoga yozish
          </button>
        )}
        {range === 7 && days.length === 7 && (
          <button className="btn sm soft" onClick={() => setRange(30)}>
            30 kunni ko&apos;rsatish
          </button>
        )}
      </div>
    </div>
  );
}

function Dot({ st }: { st: St }) {
  return (
    <i
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 3,
        verticalAlign: "-1px",
        background: st === "oqildi" ? "var(--habit)" : st === "qazo" ? "var(--warn)" : "transparent",
        border: st ? 0 : "1.5px dashed var(--muted)",
      }}
    />
  );
}

/* ---------- Qazo tarixi ---------- */
function QazaHistory() {
  const { d } = useStore();
  const [all, setAll] = useState(false);
  const log = d.qaza_log.filter((l) => l.prayer !== "roza");
  if (!log.length) return null;
  const groups = new Map<string, typeof log>();
  for (const l of log) {
    const k = l.date.slice(0, 10);
    groups.set(k, [...(groups.get(k) || []), l]);
  }
  const entries = [...groups.entries()].slice(0, all ? 60 : 7);
  const txt = (l: (typeof log)[number]) =>
    l.kind === "fix"
      ? `${PNAME[l.prayer] ?? l.prayer}: tuzatildi (${l.delta > 0 ? "+" : ""}${l.delta})`
      : l.delta < 0
        ? `${PNAME[l.prayer] ?? l.prayer} qazosi o'qildi${l.delta < -1 ? ` ×${-l.delta}` : ""}`
        : `${PNAME[l.prayer] ?? l.prayer} qazoga qo'shildi${l.delta > 1 ? ` +${l.delta}` : ""}${l.kind === "day" ? " (o'tgan kundan)" : ""}`;
  return (
    <div className="card flush">
      <h2>Qazo tarixi</h2>
      {entries.map(([day, items]) => {
        const doneN = items.filter((l) => l.delta < 0 && l.kind !== "fix").reduce((a, l) => a - l.delta, 0);
        return (
          <div key={day}>
            <div className="daygroup">
              <span>{sanaNisbiy(day)}</span>
              {doneN > 0 && <span style={{ color: "var(--habit)" }}>{doneN} ta o&apos;qildi</span>}
            </div>
            <div className="rows">
              {items.map((l, i) => (
                <div key={i} className="row" style={{ minHeight: 40, padding: "4px 12px", fontSize: 14 }}>
                  <span style={{ width: 18, textAlign: "center" }}>{l.delta < 0 && l.kind !== "fix" ? "✅" : l.kind === "fix" ? "↺" : "＋"}</span>
                  <span className="body">{txt(l)}</span>
                  <span className="num" style={{ color: "var(--muted)", fontSize: 12 }}>
                    {l.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {groups.size > 7 && !all && (
        <div style={{ padding: 12 }}>
          <button className="btn sm soft" onClick={() => setAll(true)}>
            Hammasini ko&apos;rsatish
          </button>
        </div>
      )}
    </div>
  );
}

/** Necha kunlik qazo qolganini bir yo'la kiritish (har kuniga 5 farz + vitr) */
function BulkQaza({ onDone }: { onDone: () => void }) {
  const { act } = useStore();
  const [mode, setMode] = useState<"days" | "years">("days");
  const [num, setNum] = useState("");
  const [vitr, setVitr] = useState(true);
  const n = Math.min(20000, (Number(num) || 0) * (mode === "years" ? 354 : 1)); // hijriy yil ≈ 354 kun
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!n) return;
        await act(async () => {
          for (const k of vitr ? QAZA_KINDS : FARZ) await api("/api/qaza", "POST", { prayer: k, delta: n });
        }, `${n} kunlik qazo qo'shildi`);
        onDone();
      }}
    >
      <div className="seg" role="group" aria-label="Birlik">
        <button type="button" aria-pressed={mode === "days"} onClick={() => setMode("days")}>
          Kun
        </button>
        <button type="button" aria-pressed={mode === "years"} onClick={() => setMode("years")}>
          Yil
        </button>
      </div>
      <div className="field">
        <label htmlFor="qd">{mode === "days" ? "Necha kunlik namoz qazo bo'lgan?" : "Necha yillik namoz qazo bo'lgan?"}</label>
        <input id="qd" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} placeholder={mode === "days" ? "Masalan: 30" : "Masalan: 2"} />
        <span className="hint">
          {n ? `Har bir namozga ${n} ta qo'shiladi${mode === "years" ? " (1 hijriy yil ≈ 354 kun)" : ""}` : "Balog'atga yetgandan beri o'qilmagan namozlar uchun"}
        </span>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
        <input type="checkbox" checked={vitr} onChange={(e) => setVitr(e.target.checked)} style={{ width: 20, height: 20 }} />
        Vitrni ham qo&apos;shish
      </label>
      <button className="btn brand" type="submit" disabled={!n}>
        Qo&apos;shish
      </button>
    </form>
  );
}
