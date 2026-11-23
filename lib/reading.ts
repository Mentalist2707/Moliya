// Kitob o'qish statistikasi: streak, XP, daraja, nishonlar (bazasiz, sof hisob)
import type { AllData, Book } from "./types";

const addD = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export function readingStats(d: AllData, today: string) {
  const days = new Map(d.reading_days.map((r) => [r.date.slice(0, 10), r]));
  const readDays = new Set([...days.entries()].filter(([, r]) => r.pages > 0).map(([k]) => k));

  // Joriy streak
  let cur = readDays.has(today) ? today : addD(today, -1);
  let streak = 0;
  while (readDays.has(cur)) {
    streak++;
    cur = addD(cur, -1);
  }
  // Eng uzun streak (yil bo'yicha ham)
  const sorted = [...readDays].sort();
  let best = 0,
    run = 0,
    bestYear = 0,
    runY = 0,
    prev = "";
  const year = today.slice(0, 4);
  for (const x of sorted) {
    run = prev && addD(prev, 1) === x ? run + 1 : 1;
    best = Math.max(best, run);
    if (x.startsWith(year)) {
      runY = prev && addD(prev, 1) === x && prev.startsWith(year) ? runY + 1 : 1;
      bestYear = Math.max(bestYear, runY);
    }
    prev = x;
  }

  const todayPages = days.get(today)?.pages ?? 0;
  const finished = d.books.filter((b) => b.status === "oqidim");
  const reading = d.books.filter((b) => b.status === "oqiyapman");
  const pagesTotal = finished.reduce((a, b) => a + (b.total_pages || 0), 0) + reading.reduce((a, b) => a + (b.current_page || 0), 0);
  const genres = new Set(finished.map((b) => b.genre).filter(Boolean));
  const byMonth = new Map<string, number>();
  for (const b of finished) if (b.finished) byMonth.set(b.finished.slice(0, 7), (byMonth.get(b.finished.slice(0, 7)) || 0) + 1);
  const maxMonth = Math.max(0, ...byMonth.values());
  const thick = finished.some((b) => (b.total_pages || 0) >= 500);
  const timerUsed = d.reading_days.some((r) => r.minutes > 0);
  const minutesTotal = d.reading_days.reduce((a, r) => a + r.minutes, 0);

  // Tezlik: soatiga sahifa (taymer bilan o'qilgan sessiyalardan)
  const pph = d.reading_speed.minutes >= 10 ? (d.reading_speed.pages / d.reading_speed.minutes) * 60 : null;

  // Yil
  const doneYear = finished.filter((b) => (b.finished || "").startsWith(year));
  const pagesYear = d.reading_days.filter((r) => r.date.startsWith(year)).reduce((a, r) => a + r.pages, 0);
  const minutesYear = d.reading_days.filter((r) => r.date.startsWith(year)).reduce((a, r) => a + r.minutes, 0);
  const genreCount = new Map<string, number>();
  for (const b of doneYear) if (b.genre) genreCount.set(b.genre, (genreCount.get(b.genre) || 0) + 1);
  const favGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topBook = [...doneYear].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] ?? null;

  // XP va daraja
  const xp = pagesTotal + finished.length * 50 + d.quotes.length * 5 + best * 10;
  const lvl = level(xp);

  const badges = BADGES.map((b) => {
    const v = b.value({ finished: finished.length, pagesTotal, best, genres: genres.size, maxMonth, thick, quotes: d.quotes.length, timerUsed, doneYear: doneYear.length });
    return { ...b, have: v >= b.need, v };
  });

  return {
    streak,
    best,
    bestYear,
    readToday: readDays.has(today),
    todayPages,
    pagesTotal,
    finishedCount: finished.length,
    pph,
    minutesTotal,
    year: { year, books: doneYear.length, pages: pagesYear, minutes: minutesYear, favGenre, topBook },
    xp,
    lvl,
    badges,
  };
}

export const LEVELS = [
  { xp: 0, name: "Yangi boshlovchi", emoji: "🌱" },
  { xp: 150, name: "Havaskor", emoji: "📗" },
  { xp: 400, name: "Kitobsevar", emoji: "📘" },
  { xp: 900, name: "Kitobxon", emoji: "📚" },
  { xp: 1800, name: "Bilimdon", emoji: "🎓" },
  { xp: 3500, name: "Mutolaachi", emoji: "🦉" },
  { xp: 6000, name: "Donishmand", emoji: "🧠" },
  { xp: 10000, name: "Ustoz", emoji: "🏛️" },
  { xp: 16000, name: "Kutubxona afsonasi", emoji: "👑" },
];

export function level(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const next = LEVELS[i + 1];
  return {
    n: i + 1,
    ...LEVELS[i],
    next: next ?? null,
    pct: next ? ((xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp)) * 100 : 100,
  };
}

type V = { finished: number; pagesTotal: number; best: number; genres: number; maxMonth: number; thick: boolean; quotes: number; timerUsed: boolean; doneYear: number };
export const BADGES: { id: string; emoji: string; title: string; desc: string; need: number; value: (v: V) => number }[] = [
  { id: "first", emoji: "📖", title: "Birinchi kitob", desc: "1 ta kitobni tugatish", need: 1, value: (v) => v.finished },
  { id: "b5", emoji: "📚", title: "Besh kitob", desc: "5 ta kitob o'qish", need: 5, value: (v) => v.finished },
  { id: "b10", emoji: "🏅", title: "O'n kitob", desc: "10 ta kitob o'qish", need: 10, value: (v) => v.finished },
  { id: "b25", emoji: "🏆", title: "Chorak yuz", desc: "25 ta kitob o'qish", need: 25, value: (v) => v.finished },
  { id: "b50", emoji: "👑", title: "Ellik kitob", desc: "50 ta kitob o'qish", need: 50, value: (v) => v.finished },
  { id: "p1000", emoji: "📄", title: "Ming sahifa", desc: "1 000 sahifa o'qish", need: 1000, value: (v) => v.pagesTotal },
  { id: "p5000", emoji: "📜", title: "Besh ming sahifa", desc: "5 000 sahifa o'qish", need: 5000, value: (v) => v.pagesTotal },
  { id: "p10000", emoji: "🗻", title: "O'n ming sahifa", desc: "10 000 sahifa o'qish", need: 10000, value: (v) => v.pagesTotal },
  { id: "s3", emoji: "✨", title: "Boshlanish", desc: "3 kun ketma-ket o'qish", need: 3, value: (v) => v.best },
  { id: "s7", emoji: "🔥", title: "Bir hafta olov", desc: "7 kun ketma-ket o'qish", need: 7, value: (v) => v.best },
  { id: "s30", emoji: "☄️", title: "Oylik olov", desc: "30 kun ketma-ket o'qish", need: 30, value: (v) => v.best },
  { id: "s100", emoji: "💎", title: "Yuz kunlik", desc: "100 kun ketma-ket o'qish", need: 100, value: (v) => v.best },
  { id: "thick", emoji: "🧱", title: "Qalin kitob", desc: "500+ sahifali kitobni tugatish", need: 1, value: (v) => (v.thick ? 1 : 0) },
  { id: "genres", emoji: "🌈", title: "Turli janrlar", desc: "5 xil janrdagi kitob", need: 5, value: (v) => v.genres },
  { id: "month3", emoji: "🚀", title: "Oylik rekord", desc: "Bir oyda 3 ta kitob", need: 3, value: (v) => v.maxMonth },
  { id: "quotes10", emoji: "💬", title: "Iqtibosshunos", desc: "10 ta iqtibos saqlash", need: 10, value: (v) => v.quotes },
  { id: "timer", emoji: "⏱️", title: "Fokus", desc: "Taymer bilan o'qish", need: 1, value: (v) => (v.timerUsed ? 1 : 0) },
  { id: "year12", emoji: "📅", title: "Yiliga 12", desc: "Bir yilda 12 ta kitob", need: 12, value: (v) => v.doneYear },
];

/** Kitob tugashiga qolgan vaqt (daqiqa) */
export function etaMinutes(b: Book, pph: number | null) {
  if (!pph || !b.total_pages) return null;
  const left = Math.max(0, b.total_pages - (b.current_page || 0));
  return Math.round((left / pph) * 60);
}
export const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} soat${m % 60 ? ` ${m % 60} daq` : ""}` : `${m} daq`);
