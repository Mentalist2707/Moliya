export function som(n: number): string {
  const v = Math.round(n || 0);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (v < 0 ? "−" : "") + s;
}

// Qisqa: 1.2 mln, 350 ming
export function somShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1_000_000) return sign + (a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(".0", "") + " mln";
  if (a >= 10_000) return sign + Math.round(a / 1000) + " ming";
  return sign + som(a);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateStr(d);
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

export function daysLeft(date: string | null): number | null {
  if (!date) return null;
  return Math.round((parseDate(date).getTime() - parseDate(todayStr()).getTime()) / 86400000);
}

export const OYLAR = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const OY_QISQA = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
export const HAFTA = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const HAFTA_QISQA = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

export function sana(date: string | null, withYear = false): string {
  if (!date) return "—";
  const d = parseDate(date.slice(0, 10));
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()}-${OY_QISQA[d.getMonth()]}${withYear || !sameYear ? " " + d.getFullYear() : ""}`;
}

export function sanaNisbiy(date: string): string {
  const d = daysLeft(date);
  if (d === 0) return "Bugun";
  if (d === -1) return "Kecha";
  if (d === 1) return "Ertaga";
  const dt = parseDate(date);
  return `${HAFTA[dt.getDay()]}, ${sana(date)}`;
}

export function muddatLabel(date: string | null, done = false): { text: string; tone: "bad" | "warn" | "good" | "" } {
  if (done) return { text: "Yakunlangan", tone: "good" };
  const d = daysLeft(date);
  if (d === null) return { text: "Muddatsiz", tone: "" };
  if (d < 0) return { text: `${-d} kun o'tdi`, tone: "bad" };
  if (d === 0) return { text: "Bugun", tone: "bad" };
  if (d === 1) return { text: "Ertaga", tone: "warn" };
  if (d <= 7) return { text: `${d} kun qoldi`, tone: "warn" };
  return { text: `${d} kun qoldi`, tone: "" };
}

export function parseMoney(s: string): number {
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Xayrli tun";
  if (h < 11) return "Xayrli tong";
  if (h < 17) return "Xayrli kun";
  return "Xayrli kech";
}
