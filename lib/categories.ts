export const EXPENSE_CATS = [
  "Oziq-ovqat",
  "Transport",
  "Uy-joy",
  "Kommunal",
  "Aloqa",
  "Ta'lim",
  "Sog'liq",
  "Kiyim",
  "Ko'ngilochar",
  "Sovg'a",
  "Boshqa",
];

export const INCOME_CATS = ["Maosh", "Stipendiya", "Qo'shimcha ish", "Sovg'a", "Boshqa"];

/**
 * Bot uchun tez kiritish: "-25000 tushlik", "+1.5mln maosh", "-30k taksi"
 * Qaytaradi: { type, amount, category, note } yoki null
 */
export function parseQuickTx(text: string) {
  const m = text.trim().match(/^([+-])\s*([\d\s.,]+)\s*(k|ming|m|mln|million)?\b\s*(.*)$/i);
  if (!m) return null;
  let amount = Number(m[2].replace(/\s/g, "").replace(",", "."));
  const unit = (m[3] || "").toLowerCase();
  if (unit === "k" || unit === "ming") amount *= 1000;
  if (unit === "m" || unit === "mln" || unit === "million") amount *= 1_000_000;
  amount = Math.round(amount);
  if (!amount || amount <= 0) return null;
  const type = m[1] === "+" ? ("kirim" as const) : ("chiqim" as const);
  const rest = m[4].trim();
  const cats = type === "kirim" ? INCOME_CATS : EXPENSE_CATS;
  const first = rest.split(/\s+/)[0]?.toLowerCase() || "";
  const category = cats.find((c) => c.toLowerCase().startsWith(first) && first.length >= 3) || guessCategory(rest, type);
  return { type, amount, category, note: rest || null };
}

const HINTS: Record<string, string[]> = {
  "Oziq-ovqat": ["tushlik", "nonushta", "kechki", "ovqat", "non", "bozor", "market", "kafe", "choy", "kofe", "osh", "lavash", "shashlik", "produkt"],
  Transport: ["taksi", "taxi", "yandex", "metro", "avtobus", "benzin", "yo'l", "propan", "metan"],
  Aloqa: ["internet", "telefon", "paynet", "beeline", "ucell", "uzmobile", "mobiuz"],
  Kommunal: ["svet", "gaz", "suv", "kommunal", "elektr"],
  "Ta'lim": ["kitob", "kurs", "kontrakt", "repetitor", "o'qish", "universitet"],
  "Sog'liq": ["dori", "apteka", "shifokor", "doktor", "klinika"],
  Kiyim: ["kiyim", "kurtka", "oyoq", "krossovka", "shim", "ko'ylak"],
  "Ko'ngilochar": ["kino", "o'yin", "dam", "sayohat"],
};

function guessCategory(text: string, type: "kirim" | "chiqim") {
  if (type === "kirim") return /maosh|oylik|zarplata/i.test(text) ? "Maosh" : /stipend/i.test(text) ? "Stipendiya" : "Boshqa";
  const t = text.toLowerCase();
  for (const [cat, words] of Object.entries(HINTS)) if (words.some((w) => t.includes(w))) return cat;
  return "Boshqa";
}
