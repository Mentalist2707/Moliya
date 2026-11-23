export function som(n: number): string {
  const v = Math.round(n || 0);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (v < 0 ? "−" : "") + s;
}

export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysLeft(date: string | null): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

const OYLAR = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

export function sana(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  return `${d}-${OYLAR[m - 1]} ${y}`;
}

export function muddatLabel(date: string | null, done = false): { text: string; tone: "bad" | "warn" | "good" | "mut" } {
  if (done) return { text: "Yakunlangan", tone: "good" };
  const d = daysLeft(date);
  if (d === null) return { text: "Muddatsiz", tone: "mut" };
  if (d < 0) return { text: `${-d} kun o'tib ketdi`, tone: "bad" };
  if (d === 0) return { text: "Bugun", tone: "bad" };
  if (d <= 7) return { text: `${d} kun qoldi`, tone: "warn" };
  return { text: `${d} kun qoldi`, tone: "mut" };
}

// "1 250 000" -> 1250000
export function parseMoney(s: string): number {
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
