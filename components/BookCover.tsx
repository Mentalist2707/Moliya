"use client";

import type { Book } from "@/lib/types";

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

