import { getDb } from "./db";

/**
 * Namoz vaqtlari.
 * Asosiy manba: islomapi.uz (islom.uz ma'lumotlari, O'zbekiston Musulmonlari idorasi).
 * Zaxira: astronomik hisob (Bomdod/Xufton 15°, Asr — Hanafiy). Faqat API ishlamasa ishlatiladi
 * va rejalashtiruvchi qaysi daqiqalarda bazani uyg'otish kerakligini aniqlash uchun.
 */

export const PRAYER_KEYS = ["bomdod", "quyosh", "peshin", "asr", "shom", "xufton"] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type DayTimes = Record<PrayerKey, string>; // "HH:MM"

export const PRAYER_NAMES: Record<PrayerKey, string> = {
  bomdod: "Bomdod",
  quyosh: "Quyosh",
  peshin: "Peshin",
  asr: "Asr",
  shom: "Shom",
  xufton: "Xufton",
};

// islomapi.uz hudud nomlari va taxminiy koordinatalar
export const REGIONS: { name: string; lat: number; lng: number }[] = [
  { name: "Toshkent", lat: 41.311, lng: 69.279 },
  { name: "Andijon", lat: 40.783, lng: 72.344 },
  { name: "Buxoro", lat: 39.768, lng: 64.421 },
  { name: "Guliston", lat: 40.49, lng: 68.784 },
  { name: "Jizzax", lat: 40.116, lng: 67.842 },
  { name: "Namangan", lat: 40.998, lng: 71.672 },
  { name: "Navoiy", lat: 40.103, lng: 65.374 },
  { name: "Nukus", lat: 42.461, lng: 59.616 },
  { name: "Qarshi", lat: 38.86, lng: 65.789 },
  { name: "Qo'qon", lat: 40.529, lng: 70.943 },
  { name: "Samarqand", lat: 39.654, lng: 66.959 },
  { name: "Termiz", lat: 37.224, lng: 67.278 },
  { name: "Urganch", lat: 41.55, lng: 60.631 },
  { name: "Farg'ona", lat: 40.389, lng: 71.783 },
  { name: "Xiva", lat: 41.378, lng: 60.364 },
];
const TZ_HOURS = 5; // Toshkent vaqti, yozgi vaqt yo'q

/* ---------- Astronomik hisob (PrayTimes algoritmi asosida) ---------- */
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const eqt = q / 15 - RA;
  return { decl, eqt: eqt > 12 ? eqt - 24 : eqt < -12 ? eqt + 24 : eqt };
}

function julian(y: number, m: number, d: number) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/** Hudud uchun hisoblangan vaqtlar (daqiqalarda, mahalliy vaqt) */
export function computeTimes(dateStr: string, lat: number, lng: number): Record<PrayerKey, number> {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jd = julian(y, m, d) - lng / 360;
  const { decl, eqt } = sunPosition(jd + 0.5);
  const noon = 12 + TZ_HOURS - lng / 15 - eqt;
  const T = (angle: number) =>
    deg(Math.acos((-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat))))) / 15;
  const asrAngle = -deg(Math.atan(1 / (2 + Math.tan(rad(Math.abs(lat - decl)))))); // Hanafiy: soya = 2x
  const h = {
    bomdod: noon - T(15),
    quyosh: noon - T(0.833),
    peshin: noon + 3 / 60, // zenitdan biroz keyin
    asr: noon + T(asrAngle),
    shom: noon + T(0.833) + 2 / 60,
    xufton: noon + T(15),
  };
  return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, Math.round(v * 60)])) as Record<PrayerKey, number>;
}

export const toHHMM = (min: number) => {
  const m = fix(Math.round(min), 1440);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/* ---------- islomapi.uz ---------- */
// Javob maydon nomlari o'zgarishi mumkin — shuning uchun moslashuvchan o'qiymiz
function pick(times: Record<string, unknown>, keys: string[]): string | null {
  for (const [k, v] of Object.entries(times)) {
    const kk = k.toLowerCase();
    if (keys.some((x) => kk.includes(x)) && typeof v === "string" && /^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5).padStart(5, "0");
  }
  return null;
}

export function parseApiTimes(raw: unknown): DayTimes | null {
  const obj = raw as { times?: Record<string, unknown> } | undefined;
  const t = obj?.times;
  if (!t || typeof t !== "object") return null;
  const r = {
    bomdod: pick(t, ["tong", "bomdod", "fajr", "saharlik"]),
    quyosh: pick(t, ["quyosh", "sunrise"]),
    peshin: pick(t, ["peshin", "dhuhr", "zuhr"]),
    asr: pick(t, ["asr"]),
    shom: pick(t, ["shom", "iftor", "maghrib"]),
    xufton: pick(t, ["xufton", "hufton", "isha"]),
  };
  return Object.values(r).every(Boolean) ? (r as DayTimes) : null;
}

async function fetchMonth(region: string, year: number, month: number): Promise<{ date: string; times: DayTimes }[]> {
  const url = `https://islomapi.uz/api/monthly?region=${encodeURIComponent(region)}&month=${month}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`islomapi ${r.status}`);
  const arr = (await r.json()) as unknown[];
  const out: { date: string; times: DayTimes }[] = [];
  for (const item of Array.isArray(arr) ? arr : []) {
    const it = item as { day?: number; date?: string };
    const times = parseApiTimes(item);
    const day = Number(it.day) || (typeof it.date === "string" ? new Date(it.date).getUTCDate() : 0);
    if (times && day >= 1 && day <= 31) {
      out.push({ date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, times });
    }
  }
  return out;
}

/** Hudud va sana uchun vaqtlar: keshdan, bo'lmasa API'dan (butun oy), bo'lmasa hisoblab */
export async function getDayTimes(region: string, date: string): Promise<DayTimes & { source: string }> {
  const db = await getDb();
  const c = await db.query("SELECT * FROM prayer_times WHERE region=$1 AND date=$2", [region, date]);
  if (c.rows[0]) {
    const r = c.rows[0];
    return { bomdod: r.bomdod, quyosh: r.quyosh, peshin: r.peshin, asr: r.asr, shom: r.shom, xufton: r.xufton, source: r.source };
  }
  const [y, m] = date.split("-").map(Number);
  try {
    const month = await fetchMonth(region, y, m);
    if (month.length >= 28) {
      for (const d of month) {
        const t = d.times;
        await db.query(
          `INSERT INTO prayer_times (region, date, bomdod, quyosh, peshin, asr, shom, xufton, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'islomapi') ON CONFLICT (region, date) DO UPDATE SET
           bomdod=EXCLUDED.bomdod, quyosh=EXCLUDED.quyosh, peshin=EXCLUDED.peshin, asr=EXCLUDED.asr,
           shom=EXCLUDED.shom, xufton=EXCLUDED.xufton, source='islomapi'`,
          [region, d.date, t.bomdod, t.quyosh, t.peshin, t.asr, t.shom, t.xufton]
        );
      }
      const found = month.find((d) => d.date === date);
      if (found) return { ...found.times, source: "islomapi" };
    }
  } catch (e) {
    console.error("[prayer] islomapi xato:", (e as Error).message);
  }
  // Zaxira: hisoblash (keshga yozmaymiz — keyingi safar API'ni yana sinaymiz)
  const reg = REGIONS.find((r) => r.name === region) ?? REGIONS[0];
  const c2 = computeTimes(date, reg.lat, reg.lng);
  return { ...(Object.fromEntries(PRAYER_KEYS.map((k) => [k, toHHMM(c2[k])])) as DayTimes), source: "hisob" };
}
