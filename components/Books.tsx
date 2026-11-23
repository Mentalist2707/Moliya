"use client";

import { useMemo, useState } from "react";
import type { Book } from "@/lib/types";
import { sana } from "@/lib/format";
import { Bar, Chips, Empty, useStore } from "./ui";
import { BookForm, PageForm } from "./forms";
import { I } from "./icons";

const COVERS = ["#1f4e79", "#7a2e3b", "#2f6b4f", "#6b4b8a", "#a0522d", "#2c5f6e", "#8a6d1f", "#3d3d5c"];
export function coverColor(t: string) {
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

export function BookCover({ b, big }: { b: Book; big?: boolean }) {
  return (
    <div
      className="cover"
      style={{ background: coverColor(b.title), ...(big ? { width: "100%", height: "auto", aspectRatio: "2 / 3", fontSize: 13, padding: 10 } : {}) }}
      aria-hidden="true"
    >
      {b.title.slice(0, 50)}
    </div>
  );
}

type F = "kutubxona" | "oqiyapman" | "reja";
const LABEL: Record<F, string> = { kutubxona: "Kutubxonam", oqiyapman: "O'qiyapman", reja: "O'qimoqchiman" };

export default function Books() {
  const { d } = useStore();
  const [f, setF] = useState<F>(d.books.some((b) => b.status === "oqiyapman") ? "oqiyapman" : "kutubxona");
  const [open, setOpen] = useState<Book | "new" | null>(null);
  const [page, setPage] = useState<Book | null>(null);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const year = String(new Date().getFullYear());
  const read = d.books.filter((b) => b.status === "oqidim");
  const readThisYear = read.filter((b) => (b.finished || "").startsWith(year));
  const pagesAll = read.reduce((a, b) => a + (b.total_pages || 0), 0);
  const count = (s: F) => (s === "kutubxona" ? read.length : d.books.filter((b) => b.status === s).length);
  const genres = useMemo(() => [...new Set(read.map((b) => b.genre).filter(Boolean) as string[])].sort(), [read]);

  // Kutubxona: qidiruv + janr, yillar bo'yicha guruh
  const shelf = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = read.filter(
      (b) => (!genre || b.genre === genre) && (!s || b.title.toLowerCase().includes(s) || (b.author || "").toLowerCase().includes(s))
    );
    const g = new Map<string, Book[]>();
    for (const b of list) {
      const y = b.finished ? b.finished.slice(0, 4) : "Sanasiz";
      g.set(y, [...(g.get(y) || []), b]);
    }
    return [...g.entries()].sort((a, b) => (a[0] === "Sanasiz" ? 1 : b[0] === "Sanasiz" ? -1 : b[0].localeCompare(a[0])));
  }, [read, q, genre]);

  const list = f === "kutubxona" ? [] : d.books.filter((b) => b.status === f);

  return (
    <>
      <div className="ph">
        <div>
          <h1>Kutubxona</h1>
          <p>
            {read.length} ta kitob o&apos;qilgan{pagesAll ? ` · ${pagesAll.toLocaleString("ru-RU")} bet` : ""} · {year}-yilda {readThisYear.length} ta
          </p>
        </div>
      </div>
      <Chips value={f} onChange={setF} options={(["oqiyapman", "reja", "kutubxona"] as F[]).map((s) => ({ v: s, t: `${LABEL[s]} · ${count(s)}` }))} />

      {f === "kutubxona" ? (
        read.length === 0 ? (
          <div className="card">
            <Empty emoji="📚" text="O'qigan kitoblaringiz shu javonda to'planadi. Avval o'qiganlaringizni ham qo'shib qo'ying." btn="Kitob qo'shish" onAdd={() => setOpen("new")} />
          </div>
        ) : (
          <>
            {read.length > 4 && (
              <input className="search" type="search" placeholder="Kitob yoki muallif…" aria-label="Kutubxonadan qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
            )}
            {genres.length > 0 && (
              <Chips value={genre} onChange={setGenre} options={[{ v: "", t: "Hammasi" }, ...genres.map((g) => ({ v: g, t: g }))]} />
            )}
            {shelf.length === 0 ? (
              <div className="card">
                <Empty emoji="🔍" text="Hech narsa topilmadi" />
              </div>
            ) : (
              shelf.map(([y, books]) => (
                <div key={y} className="card" style={{ display: "grid", gap: 12 }}>
                  <h2 style={{ margin: 0 }}>
                    {y}
                    <span className="pill">{books.length} ta</span>
                  </h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 14 }}>
                    {books.map((b) => (
                      <button key={b.id} onClick={() => setOpen(b)} style={{ border: 0, background: "none", padding: 0, textAlign: "left", display: "grid", gap: 6, cursor: "pointer" }}>
                        <BookCover b={b} big />
                        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25, overflowWrap: "anywhere" }}>{b.title}</span>
                        {b.author && <span style={{ fontSize: 12, color: "var(--muted)", marginTop: -4 }}>{b.author}</span>}
                        {b.rating ? (
                          <span className="stars" aria-label={`${b.rating} yulduz`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={n <= (b.rating || 0) ? "on" : ""} style={{ fontSize: 12 }}>
                                ★
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )
      ) : list.length === 0 ? (
        <div className="card">
          <Empty
            emoji="📖"
            text={f === "oqiyapman" ? "Hozir hech narsa o'qilmayapti. Kitob qo'shing yoki rejadagisini boshlang." : "O'qimoqchi bo'lgan kitoblaringizni yozib qo'ying"}
            btn="Kitob qo'shish"
            onAdd={() => setOpen("new")}
          />
        </div>
      ) : (
        <div className="list">
          {list.map((b) => {
            const pct = b.total_pages ? (b.current_page / b.total_pages) * 100 : 0;
            return (
              <div key={b.id} className="card book" onClick={() => setOpen(b)} style={{ cursor: "pointer" }}>
                <BookCover b={b} />
                <div className="item" style={{ gap: 8 }}>
                  <div>
                    <h3>{b.title}</h3>
                    {(b.author || b.genre) && <div className="sub">{[b.author, b.genre].filter(Boolean).join(" · ")}</div>}
                  </div>
                  {b.status === "oqiyapman" && (
                    <>
                      <Bar pct={pct} color="var(--books)" />
                      <div className="meta">
                        <span className="num">
                          {b.current_page}
                          {b.total_pages ? ` / ${b.total_pages} bet · ${Math.round(pct)}%` : " bet"}
                        </span>
                        {b.started && <span>{sana(b.started)} dan</span>}
                      </div>
                    </>
                  )}
                  {b.status === "reja" && b.total_pages ? <div className="meta">{b.total_pages} bet</div> : null}
                  <div className="acts">
                    <button
                      className="btn sm soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPage(b);
                      }}
                    >
                      {b.status === "reja" ? "Boshlash" : "Betni yangilash"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button className="fab" aria-label="Kitob qo'shish" onClick={() => setOpen("new")} style={{ background: "var(--books)" }}>
        <I.plus />
      </button>
      {open && <BookForm initial={open === "new" ? undefined : open} defaultStatus={f === "kutubxona" ? "oqidim" : f} onClose={() => setOpen(null)} />}
      {page && <PageForm book={page} onClose={() => setPage(null)} />}
    </>
  );
}
