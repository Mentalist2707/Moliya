import type { HabitLog } from "./types";
import { addDays, todayStr } from "./format";

export function logSet(logs: HabitLog[], habitId: number): Set<string> {
  return new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.date.slice(0, 10)));
}

/** Ketma-ket kunlar: bugundan (yoki bugun hali belgilanmagan bo'lsa — kechadan) orqaga */
export function streak(set: Set<string>): number {
  let d = todayStr();
  if (!set.has(d)) d = addDays(d, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(set: Set<string>): number {
  const days = [...set].sort();
  let best = 0;
  let cur = 0;
  let prev = "";
  for (const d of days) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

export function countLast(set: Set<string>, days: number): number {
  let n = 0;
  for (let i = 0; i < days; i++) if (set.has(todayStr(-i))) n++;
  return n;
}
