"use client";

import { useEffect, useMemo, useState } from "react";
import { hijri, isRamadan } from "@/lib/calendar";
import { addDays, sana, todayStr, HAFTA_QISQA, parseDate } from "@/lib/format";
import { api, Chips, useStore } from "./ui";
import { I } from "./icons";
import { leftText, usePrayer } from "./Namoz";

type Day = { date: string; bomdod: string; shom: string; source: string };

/** Keyingi Ramazonning birinchi kuni (hijriy taqvim bo'yicha taxminiy) */
function nextRamadanStart(today: string): string | null {
  let d = today;
  if (isRamadan(d)) {
    while (isRamadan(addDays(d, -1))) d = addDays(d, -1);
    return d;
  }
  for (let i = 0; i < 400; i++) {
    d = addDays(d, 1);
    if (isRamadan(d)) return d;
  }
  return null;
}

const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export default function Fasting() {
  const { d, act, haptic } = useStore();
  const today = todayStr();
  const tomorrow = todayStr(1);
  const h = hijri(today);
  const ramadan = h.month === 9;
  const start = useMemo(() => nextRamadanStart(today), [today]);
  const { data: todayTimes } = usePrayer(today);
  const [cal, setCal] = useState<Day[] | null>(null);
  const status = new Map(d.fast_log.map((f) => [f.date.slice(0, 10), f.status]));
  const qazaRoza = d.qaza.find((q) => q.prayer === "roza")?.count || 0;

  useEffect(() => {
    if (!start) return;
    api<{ list: Day[] }>(`/api/prayer?date=${start}&days=30`)
      .then((r) => setCal(r.list.filter((x) => isRamadan(x.date))))
      .catch(() => setCal([]));
  }, [start]);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const fastingToday = ramadan ? status.get(today) !== "qoldi" : status.get(today) === "niyat" || status.get(today) === "tutdim";
  const iftorLeft = todayTimes ? toMin(todayTimes.times.shom) - nowMin : null;

  const ramDays = cal?.map((c) => c.date) ?? [];
  const kept = ramDays.filter((x) => status.get(x) === "tutdim").length;
  const missed = ramDays.filter((x) => status.get(x) === "qoldi").length;
  const setSt = (date: string, st: "niyat" | "tutdim" | "qoldi" | null, msg?: string) => {
    haptic(st === "tutdim" ? "success" : "light");
    return act(() => api("/api/fast", "POST", { date, status: st }), msg);
  };

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 6, background: "var(--ink)", color: "var(--bg)" }}>
        <span style={{ opacity: 0.7, fontWeight: 600, fontSize: 14 }}>
          {h.day} {h.name} {h.year} h.
        </span>
        {ramadan ? (
          <>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Ramazonning {h.day}-kuni</span>
            {todayTimes && (
              <span style={{ opacity: 0.85 }}>
                Saharlik (og&apos;iz yopish): <b className="num">{todayTimes.times.bomdod}</b> · Iftorlik: <b className="num">{todayTimes.times.shom}</b>
                {fastingToday && iftorLeft !== null && iftorLeft > 0 && <> · iftorgacha {leftText(iftorLeft)}</>}
              </span>
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {start ? `Ramazongacha ${Math.round((Date.parse(start) - Date.parse(today)) / 86400000)} kun` : "Ro'za"}
            </span>
            {start && <span style={{ opacity: 0.75, fontSize: 14 }}>Taxminan {sana(start, true)} dan (aniq sanani O&apos;zbekiston musulmonlari idorasi e&apos;lon qiladi)</span>}
          </>
        )}
      </div>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Bugun ro&apos;za</h2>
        <Chips
          value={status.get(today) ?? ""}
          onChange={(v) => setSt(today, (v || null) as "tutdim" | "qoldi" | null, v === "tutdim" ? "Qabul bo'lsin! 🤲" : undefined)}
          options={[
            { v: "tutdim", t: "✅ Tutdim" },
            { v: "qoldi", t: "Tutmadim" },
            ...(ramadan ? [] : [{ v: "niyat" as const, t: "Niyat qildim" }]),
          ]}
        />
        {!ramadan && (
          <button
            className="btn soft"
            onClick={() =>
              status.get(tomorrow) === "niyat" ? setSt(tomorrow, null, "Niyat bekor qilindi") : setSt(tomorrow, "niyat", "Saharlik va iftorlikda eslataman 🌙")
            }
          >
            {status.get(tomorrow) === "niyat" ? "✓ Ertaga ro'za tutaman (bekor qilish)" : "🌙 Ertaga nafl ro'za tutaman"}
          </button>
        )}
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Ro&apos;za kunlari bot saharlikdan oldin va iftorlik vaqtida eslatadi (Sozlamalarda yoqiladi).
        </p>
      </div>

      <div className="card">
        <h2>
          Qazo ro&apos;zalar
          <span className="pill">{qazaRoza} ta</span>
        </h2>
        <div className="acts">
          <button className="btn sm soft" disabled={!qazaRoza} onClick={() => act(() => api("/api/qaza", "POST", { prayer: "roza", delta: -1 }), "Qabul bo'lsin ✓")}>
            − Qazo tutdim
          </button>
          <button className="btn sm soft" onClick={() => act(() => api("/api/qaza", "POST", { prayer: "roza", delta: 1 }))}>
            <I.plus /> Qo&apos;shish
          </button>
        </div>
      </div>

      {cal && cal.length > 0 && (
        <div className="card flush">
          <h2>
            Ramazon taqvimi {start?.slice(0, 4)}
            {ramadan && (
              <span className="pill good">
                {kept} tutildi{missed ? ` · ${missed} qoldi` : ""}
              </span>
            )}
          </h2>
          <div style={{ padding: "0 12px 8px", fontSize: 12, color: "var(--muted)" }}>
            Saharlik — og&apos;iz yopish (bomdod) vaqti, iftorlik — shom vaqti. Hudud Sozlamalarda tanlanadi.
          </div>
          <div className="scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "left" }}>
                  <th style={{ padding: "6px 12px" }}>Kun</th>
                  <th style={{ padding: "6px 8px" }}>Sana</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Saharlik</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Iftorlik</th>
                  <th style={{ padding: "6px 12px 6px 8px", textAlign: "center" }}>Ro&apos;za</th>
                </tr>
              </thead>
              <tbody>
                {cal.map((c, i) => {
                  const st = status.get(c.date);
                  const isToday = c.date === today;
                  const past = c.date <= today;
                  return (
                    <tr key={c.date} style={{ borderTop: "1px solid var(--line)", background: isToday ? "color-mix(in srgb, var(--habit) 10%, transparent)" : undefined }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        {sana(c.date)} <span style={{ color: "var(--muted)", fontSize: 12 }}>{HAFTA_QISQA[parseDate(c.date).getDay()]}</span>
                      </td>
                      <td className="num" style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>
                        {c.bomdod}
                      </td>
                      <td className="num" style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>
                        {c.shom}
                      </td>
                      <td style={{ padding: "4px 12px 4px 8px", textAlign: "center" }}>
                        {past ? (
                          <button
                            className="more"
                            aria-label={`${sana(c.date)} ro'za holati`}
                            onClick={() => setSt(c.date, st === "tutdim" ? "qoldi" : st === "qoldi" ? null : "tutdim")}
                            style={{ margin: "0 auto", fontSize: 16 }}
                          >
                            {st === "tutdim" ? "✅" : st === "qoldi" ? "✖️" : "○"}
                          </button>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>·</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
        Ramazon sanalari hijriy taqvim bo&apos;yicha taxminiy hisoblangan; hilolga qarab 1 kun farq qilishi mumkin.
      </p>
    </>
  );
}
