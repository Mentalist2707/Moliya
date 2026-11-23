"use client";

import { pushBack } from "@/lib/back";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { AllData } from "@/lib/types";
import { parseMoney, som } from "@/lib/format";
import { I } from "./icons";

/* ---------- API ---------- */
export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    location.href = "/login";
    throw new Error("Kirish kerak");
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || "Server xatosi");
  }
  return r.json();
}

/* ---------- Store ---------- */
export type Store = {
  d: AllData;
  reload: () => Promise<void>;
  toast: (msg: string) => void;
  /** API chaqiruv + qayta yuklash + xabar */
  act: (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
  haptic: (kind?: "light" | "success") => void;
};
export const StoreCtx = createContext<Store | null>(null);
export function useStore(): Store {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("StoreCtx yo'q");
  return s;
}

/* ---------- Sheet (mobilda pastdan chiqadi) ---------- */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => pushBack(() => closeRef.current()), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select");
    if (first && window.matchMedia("(min-width: 901px)").matches) first.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function MoneyInput({
  id,
  value,
  onChange,
  required,
  huge,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  huge?: boolean;
}) {
  return (
    <input
      id={id}
      className={huge ? "huge" : undefined}
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      required={required}
      value={value}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? som(Number(digits)) : "");
      }}
    />
  );
}
export { parseMoney };

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function Check({ on, onClick, label, round, color }: { on: boolean; onClick: () => void; label: string; round?: boolean; color?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      className={"check" + (round ? " round" : "")}
      style={color ? ({ "--c": color } as React.CSSProperties) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <I.check />
    </button>
  );
}

export function Empty({ emoji, text, btn, onAdd }: { emoji: string; text: string; btn?: string; onAdd?: () => void }) {
  return (
    <div className="empty">
      <b aria-hidden="true">{emoji}</b>
      <span>{text}</span>
      {btn && onAdd && (
        <button className="btn sm soft" onClick={onAdd}>
          {btn}
        </button>
      )}
    </div>
  );
}

export function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="bar" style={color ? ({ "--c": color } as React.CSSProperties) : undefined}>
      <b style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} />
    </div>
  );
}

export function Foot({ onClose, busy, label = "Saqlash", onDelete }: { onClose: () => void; busy: boolean; label?: string; onDelete?: () => void }) {
  return (
    <div className="foot">
      {onDelete && (
        <button type="button" className="btn soft left" onClick={onDelete} aria-label="O'chirish">
          <I.trash />
        </button>
      )}
      <button type="button" className="btn soft" onClick={onClose}>
        Bekor
      </button>
      <button type="submit" className="btn brand" disabled={busy}>
        {busy ? "Saqlanmoqda…" : label}
      </button>
    </div>
  );
}

/** Forma uchun: saqlash jarayoni va xato */
export function useSubmit(onSave: (data: Record<string, unknown>) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (data: Record<string, unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await onSave(data);
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
      setBusy(false);
    }
  };
  return { busy, err, run };
}

export function Confirm({ text, onYes, onClose }: { text: string; onYes: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="O'chirilsinmi?" onClose={onClose}>
      <div className="form">
        <p style={{ margin: 0, color: "var(--muted)" }}>{text}</p>
        <div className="foot">
          <button className="btn soft" onClick={onClose}>
            Yo&apos;q
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onYes();
            }}
          >
            Ha, o&apos;chirish
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Uch nuqta menyusi uchun amallar ro'yxati */
export function ActionMenu({
  title,
  items,
  onClose,
}: {
  title: string;
  items: { label: string; icon?: React.ReactNode; red?: boolean; onClick: () => void }[];
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="menu">
        {items.map((it) => (
          <button
            key={it.label}
            className={it.red ? "red" : undefined}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function MoreBtn({ onClick, label = "Amallar" }: { onClick: () => void; label?: string }) {
  return (
    <button
      className="more"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <I.dots />
    </button>
  );
}
