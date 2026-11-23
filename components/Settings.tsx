"use client";

import { useState } from "react";
import { api, Sheet, useStore } from "./ui";
import { I } from "./icons";

export type Me = {
  id: number;
  first_name: string | null;
  username: string | null;
  photo_url: string | null;
  daily_digest: number;
  morning_time: string;
  crypto_report: number;
  region: string;
  prayer_remind: number;
  prayer_offset: number;
  prayer_list: string;
  qaza_remind: number;
  qaza_goal: number;
  fast_remind: number;
  sahar_offset: number;
  quran_goal: number;
  read_goal: number;
  read_year_goal: number;
  read_remind: number;
  read_remind_time: string;
  quote_morning: number;
  local: boolean;
};

const REGIONS = ["Toshkent", "Andijon", "Buxoro", "Farg'ona", "Guliston", "Jizzax", "Namangan", "Navoiy", "Nukus", "Qarshi", "Qo'qon", "Samarqand", "Termiz", "Urganch", "Xiva"];
const TIMES = Array.from({ length: 13 }, (_, i) => {
  const m = 5 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
});
const FARZ: [string, string][] = [
  ["bomdod", "Bomdod"],
  ["peshin", "Peshin"],
  ["asr", "Asr"],
  ["shom", "Shom"],
  ["xufton", "Xufton"],
];

function Toggle({ title, sub, on, onToggle }: { title: string; sub?: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <label className="row" style={{ background: "var(--surface-2)", borderRadius: 14, cursor: "pointer", border: 0 }}>
      <span className="body">
        <span className="t">{title}</span>
        {sub && <span className="m">{sub}</span>}
      </span>
      <input type="checkbox" checked={on} style={{ width: 22, height: 22, accentColor: "var(--brand)" }} onChange={(e) => onToggle(e.target.checked)} />
    </label>
  );
}

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
  const save = async (patch: Partial<Record<keyof Me, unknown>>, msg?: string) => {
    const next = { ...me } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) next[k] = typeof v === "boolean" ? (v ? 1 : 0) : v;
    onChange(next as unknown as Me);
    try {
      await api("/api/me", "PATCH", patch);
      if (msg) toast(msg);
    } catch (e) {
      toast("Xatolik: " + (e as Error).message);
    }
  };

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
          <>
            <h4 style={{ margin: "8px 0 -4px", fontSize: 13, color: "var(--muted)", textTransform: "none" }}>Ertalabki xabar</h4>
            <Toggle title="Ertalabki xabar" sub="Bugungi reja, qarz muddatlari, kecha sarflangan pul" on={!!me.daily_digest} onToggle={(v) => save({ daily_digest: v }, v ? "Yoqildi" : "O'chirildi")} />
            {!!me.daily_digest && (
              <>
                <div className="field">
                  <label htmlFor="mt">Yuborish vaqti</label>
                  <select id="mt" value={me.morning_time} onChange={(e) => save({ morning_time: e.target.value }, `Har kuni ${e.target.value} da`)}>
                    {TIMES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <Toggle title="Kripto portfel" sub="Kechagidan qancha foyda yoki zarar" on={!!me.crypto_report} onToggle={(v) => save({ crypto_report: v })} />
                <Toggle title="Qazo namozlar hisobi" sub="Nechta qazo qolgani" on={!!me.qaza_remind} onToggle={(v) => save({ qaza_remind: v })} />
              </>
            )}

            <h4 style={{ margin: "8px 0 -4px", fontSize: 13, color: "var(--muted)" }}>Namoz</h4>
            <div className="field">
              <label htmlFor="rg">Hudud</label>
              <select id="rg" value={me.region} onChange={(e) => save({ region: e.target.value }, `Hudud: ${e.target.value}`)}>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <Toggle title="Namoz vaqti eslatmalari" sub="Har namoz vaqtida bot xabar beradi, «✅ O'qidim» tugmasi bilan" on={!!me.prayer_remind} onToggle={(v) => save({ prayer_remind: v }, v ? "Namoz eslatmalari yoqildi" : "O'chirildi")} />
            {!!me.prayer_remind && (
              <>
                <div className="chips" role="group" aria-label="Qaysi namozlar">
                  {FARZ.map(([k, n]) => {
                    const list = me.prayer_list.split(",").filter(Boolean);
                    const on = list.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => save({ prayer_list: (on ? list.filter((x) => x !== k) : [...list, k]).join(",") })}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className="field">
                  <label htmlFor="off">Qachon eslatsin</label>
                  <select id="off" value={me.prayer_offset} onChange={(e) => save({ prayer_offset: Number(e.target.value) })}>
                    <option value={0}>Vaqt kirganda</option>
                    <option value={5}>5 daqiqa oldin</option>
                    <option value={10}>10 daqiqa oldin</option>
                    <option value={15}>15 daqiqa oldin</option>
                  </select>
                </div>
              </>
            )}
            <h4 style={{ margin: "8px 0 -4px", fontSize: 13, color: "var(--muted)" }}>Ro&apos;za va Qur&apos;on</h4>
            <Toggle
              title="Saharlik va iftorlik eslatmalari"
              sub="Ramazonda har kuni, boshqa paytda — «niyat» qilgan kunlaringiz"
              on={!!me.fast_remind}
              onToggle={(v) => save({ fast_remind: v })}
            />
            {!!me.fast_remind && (
              <div className="field">
                <label htmlFor="so">Saharlikdan qancha oldin eslatsin</label>
                <select id="so" value={me.sahar_offset} onChange={(e) => save({ sahar_offset: Number(e.target.value) })}>
                  {[15, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>
                      Og&apos;iz yopishdan {n} daqiqa oldin
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="qrg">Qur&apos;on: kunlik maqsad</label>
              <select id="qrg" value={me.quran_goal} onChange={(e) => save({ quran_goal: Number(e.target.value) })}>
                {[0, 1, 2, 3, 4, 5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n} sahifa / kun${n === 20 ? " (oyiga 1 xatm)" : ""}` : "Belgilanmagan"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="qg">Kunlik qazo maqsadi</label>
              <select id="qg" value={me.qaza_goal} onChange={(e) => save({ qaza_goal: Number(e.target.value) })}>
                {[0, 1, 2, 3, 5, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n} ta / kun` : "Belgilanmagan"}
                  </option>
                ))}
              </select>
            </div>
          </>
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
