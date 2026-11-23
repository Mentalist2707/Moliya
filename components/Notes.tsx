"use client";

import { useState } from "react";
import type { Note } from "@/lib/types";
import { sana } from "@/lib/format";
import { Empty, Seg, useStore } from "./ui";
import Birthdays from "./Birthdays";
import { NoteEditor } from "./forms";
import { I } from "./icons";

export default function Notes() {
  const [seg, setSeg] = useState<"notes" | "bday">("notes");
  return (
    <>
      <div className="ph">
        <div>
          <h1>Eslatmalar</h1>
        </div>
      </div>
      <Seg
        label="Bo'lim"
        value={seg}
        onChange={setSeg}
        options={[
          { v: "notes", t: "Yozuvlar" },
          { v: "bday", t: "Tug'ilgan kunlar" },
        ]}
      />
      {seg === "notes" ? <NotesList /> : <Birthdays />}
    </>
  );
}

function NotesList() {
  const { d } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Note | "new" | null>(null);
  const s = q.trim().toLowerCase();
  const list = s ? d.notes.filter((n) => (n.title || "").toLowerCase().includes(s) || n.body.toLowerCase().includes(s)) : d.notes;

  return (
    <>
      {d.notes.length > 3 && <input className="search" type="search" placeholder="Qidirish…" aria-label="Eslatmalarni qidirish" value={q} onChange={(e) => setQ(e.target.value)} />}
      {list.length === 0 ? (
        <div className="card">
          <Empty emoji={s ? "🔍" : "📝"} text={s ? "Hech narsa topilmadi" : "Fikrlar, konspektlar, ro'yxatlar — hammasini shu yerda saqlang."} btn={s ? undefined : "Yozish"} onAdd={() => setOpen("new")} />
        </div>
      ) : (
        <div className="masonry">
          {list.map((n) => (
            <button key={n.id} className="note" style={{ "--nc": n.color || undefined } as React.CSSProperties} onClick={() => setOpen(n)}>
              {!!n.pinned && (
                <span className="pin" aria-label="Qadalgan">
                  📌
                </span>
              )}
              {n.title && <h3>{n.title}</h3>}
              {n.body && <p>{n.body}</p>}
              <div className="when">{sana(n.updated_at.slice(0, 10))}</div>
            </button>
          ))}
        </div>
      )}
      <button className="fab" aria-label="Yangi eslatma" onClick={() => setOpen("new")} style={{ background: "var(--notes)" }}>
        <I.plus />
      </button>
      {open && <NoteEditor initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
    </>
  );
}
