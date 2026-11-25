"use client";

import { createContext, useContext } from "react";
import type { RuData, RuLesson, RuWord } from "@/lib/ru";
import { api } from "./ui";
import type { Me } from "./Settings";

export type Open =
  | null
  | { k: "review"; lessonId?: number }
  | { k: "learn"; lessonId?: number }
  | { k: "match" }
  | { k: "photo" }
  | { k: "gen"; lessonId?: number }
  | { k: "quiz" }
  | { k: "set"; id: number }
  | { k: "word"; w?: RuWord }
  | { k: "lesson"; l: RuLesson }
  | { k: "lessonForm"; l?: RuLesson }
  | { k: "settings" };

export type Ctx = {
  r: RuData;
  me: Me | null;
  reload: () => Promise<void>;
  open: (o: Open) => void;
  run: (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
};
export const RuCtx = createContext<Ctx | null>(null);
export const useRu = () => useContext(RuCtx)!;
export const post = <T = { ok: boolean }>(body: Record<string, unknown>) => api<T>("/api/ru", "POST", body);

/* ---------- Ovoz (brauzerning o'z nutq sintezi, bepul) ---------- */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
export function speak(text: string, rate = 0.9) {
  if (!canSpeak()) return;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, ", "));
    u.lang = "ru-RU";
    u.rate = rate;
    const v = s.getVoices().find((x) => x.lang?.toLowerCase().startsWith("ru"));
    if (v) u.voice = v;
    s.speak(u);
  } catch {
    /* ovoz ishlamasa — jim */
  }
}
export function autoplay(): boolean {
  try {
    return localStorage.getItem("ru_autoplay") !== "0";
  } catch {
    return true;
  }
}
export function setAutoplay(on: boolean) {
  try {
    localStorage.setItem("ru_autoplay", on ? "1" : "0");
  } catch {
    /* */
  }
}
