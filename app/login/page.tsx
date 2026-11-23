"use client";

import { useEffect, useState } from "react";

type TgWebApp = { initData?: string; ready: () => void; expand: () => void };

export default function Login() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tgState, setTgState] = useState<"none" | "checking" | "denied">("none");
  const [tgId, setTgId] = useState<number | null>(null);

  // Telegram ichida ochilgan bo'lsa — avtomatik kirish
  useEffect(() => {
    const w = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
    if (!w?.initData) return;
    w.ready();
    w.expand();
    setTgState("checking");
    fetch("/api/tg-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: w.initData }),
    })
      .then(async (r) => {
        if (r.ok) return location.replace("/");
        const j = await r.json().catch(() => ({}));
        setTgId(j.your_id ?? null);
        setErr(j.error || "Kirib bo'lmadi");
        setTgState("denied");
      })
      .catch(() => {
        setErr("Tarmoq xatosi");
        setTgState("denied");
      });
  }, []);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ width: "min(400px, 100%)", padding: 28, display: "grid", gap: 18 }}>
        <div className="logo" style={{ padding: 0 }}>
          <i>M</i>Moliya
        </div>
        {tgState === "checking" ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>Telegram orqali kirilmoqda…</p>
        ) : tgState === "denied" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p className="err">{err}</p>
            {tgId && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Sizning Telegram ID: <b style={{ color: "var(--ink)" }}>{tgId}</b>. Agar bu sizning ilovangiz bo&apos;lsa, uni Vercel&apos;dagi{" "}
                <code>TELEGRAM_OWNER_ID</code> ga yozing.
              </p>
            )}
          </div>
        ) : (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErr("");
              const r = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              if (r.ok) location.replace("/");
              else {
                const j = await r.json().catch(() => ({}));
                setErr(j.error || "Xatolik");
                setBusy(false);
              }
            }}
          >
            <div className="field">
              <label htmlFor="pw">Parol</label>
              <input id="pw" type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p className="err">{err}</p>}
            <button className="btn brand block" type="submit" disabled={busy}>
              {busy ? "Tekshirilmoqda…" : "Kirish"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
