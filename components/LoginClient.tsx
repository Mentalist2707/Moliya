"use client";

import { useEffect, useRef, useState } from "react";

type TgWebApp = { initData?: string; ready: () => void; expand: () => void };
type WidgetUser = Record<string, string | number>;

async function login(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, ...j } as { ok: boolean; error?: string; your_id?: number };
}

export default function LoginClient({ bot }: { bot: string | null }) {
  const [state, setState] = useState<"idle" | "checking" | "error">("idle");
  const [err, setErr] = useState("");
  const [tgId, setTgId] = useState<number | null>(null);
  const widget = useRef<HTMLDivElement>(null);

  const done = (r: { ok: boolean; error?: string; your_id?: number }) => {
    if (r.ok) return location.replace("/");
    setErr(r.error || "Kirib bo'lmadi");
    setTgId(r.your_id ?? null);
    setState("error");
  };

  useEffect(() => {
    // 1) Telegram Mini App ichida — avtomatik
    const w = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
    if (w?.initData) {
      w.ready();
      w.expand();
      setState("checking");
      login("/api/tg-auth", { initData: w.initData })
        .then(done)
        .catch(() => done({ ok: false, error: "Tarmoq xatosi" }));
      return;
    }
    // 2) Oddiy brauzer — Telegram Login Widget
    if (!bot || !widget.current) return;
    (window as unknown as { onTelegramAuth: (u: WidgetUser) => void }).onTelegramAuth = (u) => {
      setState("checking");
      login("/api/auth/telegram", u)
        .then(done)
        .catch(() => done({ ok: false, error: "Tarmoq xatosi" }));
    };
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", bot);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "14");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    s.setAttribute("data-request-access", "write");
    widget.current.innerHTML = "";
    widget.current.appendChild(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot]);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ width: "min(420px, 100%)", padding: 28, display: "grid", gap: 18 }}>
        <div className="logo" style={{ padding: 0 }}>
          <i>M</i>Moliya
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em", lineHeight: 1.15 }}>Hayotingiz bir joyda</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>Vazifalar, odatlar, pul, eslatmalar va kitoblar. Kirish — Telegram orqali, parolsiz.</p>
        </div>

        {state === "checking" && <p style={{ margin: 0, color: "var(--muted)" }}>Kirilmoqda…</p>}

        {state === "error" && (
          <div style={{ display: "grid", gap: 6 }}>
            <p className="err">{err}</p>
            {tgId && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Telegram ID: <b style={{ color: "var(--ink)" }}>{tgId}</b>
              </p>
            )}
          </div>
        )}

        {state !== "checking" &&
          (bot ? (
            <div style={{ display: "grid", gap: 14 }}>
              <div ref={widget} style={{ minHeight: 44 }} />
              <a className="btn soft block" href={`https://t.me/${bot}?start=app`} target="_blank" rel="noopener noreferrer">
                Telegram ilovasida ochish
              </a>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Telegram'dagi @{bot} botida ilova ichidan avtomatik kirasiz.</p>
            </div>
          ) : (
            <p className="err">TELEGRAM_BOT_TOKEN sozlanmagan.</p>
          ))}
      </div>
    </main>
  );
}
