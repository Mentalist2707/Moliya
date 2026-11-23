"use client";

import { useState } from "react";
import { api, Sheet, useStore } from "./ui";
import { I } from "./icons";

export type Me = { id: number; first_name: string | null; username: string | null; photo_url: string | null; daily_digest: number; local: boolean };

export function Avatar({ me, size = 40 }: { me: Me | null; size?: number }) {
  const letter = (me?.first_name || me?.username || "?").slice(0, 1).toUpperCase();
  return me?.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={me.photo_url} alt="" width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flex: "none" }} />
  ) : (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--brand)",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: size * 0.42,
        flex: "none",
      }}
    >
      {letter}
    </span>
  );
}

const norm = (t: string) => t.replace(/['’ʻ‘`ʼ]/g, "").trim().toUpperCase();

export default function Settings({ me, onClose, onChange }: { me: Me; onClose: () => void; onChange: (m: Me) => void }) {
  const { toast } = useStore();
  const [askDelete, setAskDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const digest = !!me.daily_digest;

  return (
    <Sheet title="Sozlamalar" onClose={onClose}>
      <div className="form">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar me={me} size={56} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{me.first_name || "Foydalanuvchi"}</div>
            <div style={{ color: "var(--muted)", fontSize: 14 }}>{me.username ? "@" + me.username : `ID: ${me.id}`}</div>
          </div>
        </div>

        {!me.local && (
          <label className="row" style={{ background: "var(--surface-2)", borderRadius: 14, cursor: "pointer" }}>
            <span className="body">
              <span className="t">Ertalabki xabar</span>
              <span className="m">Har kuni ertalab bot bugungi rejani yuboradi</span>
            </span>
            <input
              type="checkbox"
              checked={digest}
              style={{ width: 22, height: 22 }}
              onChange={async (e) => {
                const on = e.target.checked;
                onChange({ ...me, daily_digest: on ? 1 : 0 });
                await api("/api/me", "PATCH", { daily_digest: on });
                toast(on ? "Ertalabki xabar yoqildi" : "Ertalabki xabar o'chirildi");
              }}
            />
          </label>
        )}

        {!me.local && (
          <button
            className="btn soft block"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              location.href = "/login";
            }}
          >
            <I.logout /> Chiqish
          </button>
        )}

        {!askDelete ? (
          <button className="btn soft block" style={{ color: "var(--bad)" }} onClick={() => setAskDelete(true)}>
            <I.trash /> Hisobni o&apos;chirish
          </button>
        ) : (
          <div className="card" style={{ boxShadow: "none", background: "var(--surface-2)", display: "grid", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              Barcha vazifalar, moliya, eslatmalar va kitoblaringiz <b>butunlay</b> o&apos;chiriladi. Tasdiqlash uchun <b>O&apos;CHIRISH</b> deb yozing.
            </p>
            <div className="field">
              <input aria-label="Tasdiqlash" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <button
              className="btn danger"
              disabled={norm(confirmText) !== "OCHIRISH"}
              onClick={async () => {
                await api("/api/me", "DELETE", { confirm: "O'CHIRISH" });
                location.href = "/login";
              }}
            >
              Butunlay o&apos;chirish
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
