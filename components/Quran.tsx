"use client";

import { useState } from "react";
import { todayStr, sana } from "@/lib/format";
import { api, Field, Sheet, useStore, Foot, useSubmit } from "./ui";

const TOTAL = 604;

export default function Quran({ goal, openSettings }: { goal: number; openSettings: () => void }) {
  const { d, act, haptic } = useStore();
  const today = todayStr();
  const { page, khatm } = d.quran;
  const pct = page / TOTAL;
  const juz = Math.min(30, Math.floor(page / 20) + 1);
  const log = new Map(d.quran_log.map((l) => [l.date.slice(0, 10), l.pages]));
  const todayPages = log.get(today) || 0;
  const days = Array.from({ length: 14 }, (_, i) => todayStr(i - 13));
  const max = Math.max(goal || 1, ...days.map((x) => log.get(x) || 0));
  const week = days.slice(7).reduce((a, x) => a + (log.get(x) || 0), 0);
  const avg = week / 7;
  const daysLeft = avg > 0 ? Math.ceil((TOTAL - page) / avg) : null;
  const [custom, setCustom] = useState("");
  const [fix, setFix] = useState(false);

  const add = (n: number) => {
    haptic("success");
    return act(async () => {
      const r = await api<{ finished: boolean; khatm: number }>("/api/quran", "POST", { pages: n, date: today });
      if (r.finished) alertKhatm(r.khatm);
    }, `+${n} sahifa`);
  };
  const [khatmMsg, setKhatmMsg] = useState<number | null>(null);
  const alertKhatm = (k: number) => setKhatmMsg(k);

  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <>
      <div className="card hero">
        <div className="ring" role="img" aria-label={`Xatm ${Math.round(pct * 100)}%`} style={{ width: 128, height: 128 }}>
          <svg viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--habit)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          </svg>
          <div className="lab">
            {Math.round(pct * 100)}%<small>{page}/604</small>
          </div>
        </div>
        <div>
          <h1 style={{ fontSize: 26 }}>{juz}-pora</h1>
          <p>
            Xatmlar: <b>{khatm}</b>
            {daysLeft !== null && page > 0 && <> · shu tezlikda {daysLeft} kunda xatm</>}
          </p>
        </div>
      </div>

      {khatmMsg !== null && (
        <div className="card" style={{ background: "var(--habit)", color: "#fff", textAlign: "center", fontWeight: 700 }}>
          🎉 Xatm qildingiz! Alloh qabul qilsin. Jami: {khatmMsg} ta
        </div>
      )}

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          Bugun o&apos;qidim
          <span className={"pill " + (goal && todayPages >= goal ? "good" : "")}>
            {todayPages}
            {goal ? ` / ${goal}` : ""} sahifa
          </span>
        </h2>
        <div className="chips">
          {[1, 2, 5, 10, 20].map((n) => (
            <button key={n} type="button" onClick={() => add(n)} style={{ minWidth: 56, minHeight: 44, fontSize: 16 }}>
              +{n}
            </button>
          ))}
        </div>
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(custom, 10);
            if (n) add(n).then(() => setCustom(""));
          }}
        >
          <input
            className="search"
            style={{ backgroundImage: "none", paddingLeft: 14 }}
            inputMode="numeric"
            placeholder="Boshqa son"
            aria-label="Sahifalar soni"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^\d-]/g, ""))}
          />
          <button className="btn" type="submit">
            Qo&apos;shish
          </button>
        </form>
        <div className="acts">
          <button className="btn sm soft" onClick={() => setFix(true)}>
            Sahifani to&apos;g&apos;rilash
          </button>
          <button className="btn sm soft" onClick={openSettings}>
            {goal ? `Kunlik maqsad: ${goal}` : "Kunlik maqsad qo'yish"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Botga <code>/quron 5</code> deb yozsangiz ham bo&apos;ladi.
        </p>
      </div>

      <div className="card">
        <h2>
          So&apos;nggi 14 kun
          <span className="pill">7 kunda {week} sahifa</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 4, alignItems: "end", height: 120 }}>
          {days.map((x) => {
            const v = log.get(x) || 0;
            return (
              <div key={x} title={`${sana(x)}: ${v}`} style={{ display: "grid", alignContent: "end", height: "100%", gap: 4 }}>
                <span style={{ fontSize: 10, textAlign: "center", color: "var(--muted)" }}>{v || ""}</span>
                <div
                  style={{
                    height: `${Math.max(v ? 6 : 2, (v / max) * 84)}px`,
                    background: v ? (goal && v >= goal ? "var(--habit)" : "color-mix(in srgb, var(--habit) 55%, transparent)") : "var(--surface-2)",
                    borderRadius: 4,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          <span>{sana(days[0])}</span>
          <span>Bugun</span>
        </div>
      </div>
      {fix && <FixPage page={page} khatm={khatm} onClose={() => setFix(false)} />}
    </>
  );
}

function FixPage({ page, khatm, onClose }: { page: number; khatm: number; onClose: () => void }) {
  const { act } = useStore();
  const [p, setP] = useState(String(page));
  const [k, setK] = useState(String(khatm));
  const { busy, err, run } = useSubmit(async (b) => {
    await act(() => api("/api/quran", "POST", b), "Saqlandi");
    onClose();
  });
  return (
    <Sheet title="Qayerdasiz?" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          run({ set_page: Number(p) || 0, khatm: Number(k) || 0 });
        }}
      >
        <div className="two">
          <Field label="O'qilgan sahifa (0–603)" htmlFor="qp" hint="20 sahifa ≈ 1 pora">
            <input id="qp" className="huge" inputMode="numeric" value={p} onChange={(e) => setP(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Avvalgi xatmlar" htmlFor="qk">
            <input id="qk" inputMode="numeric" value={k} onChange={(e) => setK(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        {err && <p className="err">{err}</p>}
        <Foot onClose={onClose} busy={busy} />
      </form>
    </Sheet>
  );
}
