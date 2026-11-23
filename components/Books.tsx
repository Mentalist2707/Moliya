"use client";

import { useState } from "react";
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

export function BookCover({ b }: { b: Book }) {
  return (
    <div className="cover" style={{ background: coverColor(b.title) }} aria-hidden="true">
      {b.title.slice(0, 40)}
    </div>
  );
}

type F = "oqiyapman" | "reja" | "oqidim";
const LABEL: Record<F, string> = { oqiyapman: "O'qiyapman", reja: "O'qimoqchiman", oqidim: "O'qidim" };

export default function Books() {
  const { d } = useStore();
  const [f, setF] = useState<F>("oqiyapman");
  const [open, setOpen] = useState<Book | "new" | null>(null);
  const [page, setPage] = useState<Book | null>(null);
  const year = String(new Date().getFullYear());
  const readThisYear = d.books.filter((b) => b.status === "oqidim" && (b.finished || "").startsWith(year));
  const pagesThisYear = readThisYear.reduce((a, b) => a + (b.total_pages || 0), 0);
  const list = d.books.filter((b) => b.status === f);
  const count = (s: F) => d.books.filter((b) => b.status === s).length;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Kitoblar</h1>
          <p>
            {year}-yilda {readThisYear.length} ta kitob o&apos;qildi{pagesThisYear ? ` · ${pagesThisYear} bet` : ""}
          </p>
        </div>
      </div>
      <Chips
        value={f}
        onChange={setF}
        options={(["oqiyapman", "reja", "oqidim"] as F[]).map((s) => ({ v: s, t: `${LABEL[s]} · ${count(s)}` }))}
      />
      {list.length === 0 ? (
        <div className="card">
          <Empty
            emoji="📚"
            text={f === "oqiyapman" ? "Hozir hech narsa o'qilmayapti. Kitob qo'shing yoki rejadagisini boshlang." : f === "reja" ? "O'qimoqchi bo'lgan kitoblaringizni yozib qo'ying" : "Tugatilgan kitoblar shu yerda to'planadi"}
            btn={f !== "oqidim" ? "Kitob qo'shish" : undefined}
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
                    {b.author && <div className="sub">{b.author}</div>}
                  </div>
                  {b.status === "oqiyapman" && (
                    <>
                      <Bar pct={pct} color="var(--books)" />
                      <div className="meta">
                        <span className="num">
                          {b.current_page}
                          {b.total_pages ? ` / ${b.total_pages} bet · ${Math.round(pct)}%` : " bet"}
                        </span>
                        <button
                          className="btn sm soft"
                          style={{ marginLeft: "auto" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPage(b);
                          }}
                        >
                          Betni yangilash
                        </button>
                      </div>
                    </>
                  )}
                  {b.status === "reja" && (
                    <div className="meta">
                      {b.total_pages ? <span>{b.total_pages} bet</span> : null}
                      <button
                        className="btn sm soft"
                        style={{ marginLeft: "auto" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPage(b);
                        }}
                      >
                        Boshlash
                      </button>
                    </div>
                  )}
                  {b.status === "oqidim" && (
                    <div className="meta">
                      {b.rating ? (
                        <span className="stars" aria-label={`${b.rating} yulduz`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={n <= (b.rating || 0) ? "on" : ""}>
                              ★
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {b.finished && <span>{sana(b.finished, true)}</span>}
                    </div>
                  )}
                  {b.note && (
                    <p className="note-txt" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {b.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button className="fab" aria-label="Kitob qo'shish" onClick={() => setOpen("new")} style={{ background: "var(--books)" }}>
        <I.plus />
      </button>
      {open && <BookForm initial={open === "new" ? undefined : open} onClose={() => setOpen(null)} />}
      {page && <PageForm book={page} onClose={() => setPage(null)} />}
    </>
  );
}
