"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: "12vh" }}>
      <p className="brand">
        <i aria-hidden="true" />
        Moliya
      </p>
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
          if (r.ok) {
            location.href = "/";
          } else {
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
        <button className="btn acc" type="submit" disabled={busy}>
          {busy ? "Tekshirilmoqda…" : "Kirish"}
        </button>
      </form>
    </main>
  );
}
