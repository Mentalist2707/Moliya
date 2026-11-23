// Serverda ham, brauzerda ham ishlaydigan sof funksiyalar (bazasiz)

/* ---------- Hijriy sana ---------- */
const HIJRI_MONTHS = ["Muharram", "Safar", "Rabiul avval", "Rabiul oxir", "Jumodul avval", "Jumodul oxir", "Rajab", "Sha'bon", "Ramazon", "Shavvol", "Zulqa'da", "Zulhijja"];

/**
 * Hijriy sana. Umm al-Qura taqvimi O'zbekistondan odatda 1 kun oldinda yuradi
 * (masalan, 2026 yil Ramazoni O'zbekistonda 19-fevraldan boshlangan), shuning uchun 1 kun suramiz.
 * Hilolga qarab yana ±1 kun farq bo'lishi mumkin — ro'za kunlarini foydalanuvchi qo'lda to'g'rilay oladi.
 */
const UZ_SHIFT_DAYS = -1;
export function hijri(date: string): { day: number; month: number; year: number; name: string } {
  const d = new Date(Date.parse(date + "T12:00:00Z") + UZ_SHIFT_DAYS * 86400000);
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/\D/g, "") || 0);
    const month = get("month");
    return { day: get("day"), month, year: get("year"), name: HIJRI_MONTHS[month - 1] ?? "" };
  } catch {
    return { day: 0, month: 0, year: 0, name: "" };
  }
}

export const isRamadan = (date: string) => hijri(date).month === 9;

/* ---------- Oylik to'lovlar ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
const diffDays = (a: string, b: string) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);

/**
 * To'lovning navbatdagi muddati.
 * Joriy oydagi muddat to'langan bo'lsa (last_paid shu oyda) — keyingi oy.
 */
export function billStatus(bill: { day: number; last_paid: string | null }, today: string) {
  const [y, m] = today.split("-").map(Number);
  const dueIn = (yy: number, mm: number) => `${yy}-${pad(mm)}-${pad(Math.min(bill.day, daysInMonth(yy, mm)))}`;
  let due = dueIn(y, m);
  const paidThisMonth = !!bill.last_paid && bill.last_paid.slice(0, 7) === due.slice(0, 7);
  if (paidThisMonth) {
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    due = dueIn(ny, nm);
  }
  const left = diffDays(due, today);
  return { due, left, paidThisMonth, overdue: left < 0 };
}

/* ---------- Tug'ilgan kunlar ---------- */
export function nextBirthday(b: { month: number; day: number; year: number | null }, today: string) {
  const [y] = today.split("-").map(Number);
  const make = (yy: number) => `${yy}-${pad(b.month)}-${pad(Math.min(b.day, daysInMonth(yy, b.month)))}`;
  let date = make(y);
  if (diffDays(date, today) < 0) date = make(y + 1);
  const left = diffDays(date, today);
  const age = b.year ? Number(date.slice(0, 4)) - b.year : null;
  return { date, left, age };
}
