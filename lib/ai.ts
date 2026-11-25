/** Anthropic Claude API — minimal mijoz (SDK'siz, fetch bilan) */

export const MODEL_VISION = () => process.env.RU_AI_VISION_MODEL || "claude-sonnet-5-5";
export const MODEL_FAST = () => process.env.RU_AI_MODEL || "claude-haiku-5-5";
export const aiReady = () => !!process.env.ANTHROPIC_API_KEY || process.env.RU_AI_MOCK === "1";

/** Faqat lokal sinov uchun: RU_AI_MOCK=1 bo'lsa API chaqirilmaydi */
const MOCK = JSON.stringify({
  topic: "Предложный падеж (Где?)",
  summary: "Joyni bildirish: в/на + предложный падеж. Ot -е qo'shimchasini oladi.",
  grammar: [{ title: "Где? — в/на + П.п.", rule: "Joy so'raganda (где?) в yoki на predlogidan keyin ot предложный падежда keladi: -е (в школе), -ии (в аудитории).", examples: [{ ru: "Я в школе.", uz: "Men maktabdaman." }, { ru: "Он на работе.", uz: "U ishda." }] }],
  words: [
    { ru: "школа", uz: "maktab", gender: "f", example: "Я учусь в школе." },
    { ru: "работа", uz: "ish", gender: "f", example: "Папа на работе." },
    { ru: "город", uz: "shahar", gender: "m", example: "Я живу в городе." },
    { ru: "парк", uz: "bog'", gender: "m" },
    { ru: "жить", uz: "yashamoq", gender: null },
  ],
  homework: "45-bet, 3-mashq",
  exercises: [
    { type: "fill", q: "Я живу в ___ (город).", answer: "городе", explain: "в + П.п.: город → городе" },
    { type: "choice", q: "Мама сейчас на ___.", options: ["работа", "работе", "работу", "работой"], answer: 1, explain: "на + П.п. (где?) → работе" },
    { type: "translate", q: "Men maktabdaman.", answer: "Я в школе.", accept: ["Я в школе"], explain: "школа → в школе" },
    { type: "fill", q: "Мы гуляем в ___ (парк).", answer: "парке" },
  ],
});

type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } };

export async function claude(opts: { model: string; system: string; content: Block[]; maxTokens?: number }): Promise<string> {
  if (process.env.RU_AI_MOCK === "1" && !process.env.ANTHROPIC_API_KEY) return MOCK;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI ulanmagan: Vercel'da ANTHROPIC_API_KEY o'rnatilmagan");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string }; stop_reason?: string };
  if (!r.ok) {
    console.error("[ai] xato", r.status, j.error?.message);
    if (r.status === 401) throw new Error("AI kaliti noto'g'ri (ANTHROPIC_API_KEY)");
    if (r.status === 429) throw new Error("AI band, bir daqiqadan keyin urinib ko'ring");
    if (r.status === 400 && /credit|balance/i.test(j.error?.message || "")) throw new Error("AI hisobida mablag' tugagan");
    throw new Error("AI xatosi: " + (j.error?.message || r.status));
  }
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

/** Javobdan JSON obyektni ajratib olish (```json ...``` bo'lsa ham) */
export function parseJson(text: string): Record<string, unknown> {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("AI javobini o'qib bo'lmadi");
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    throw new Error("AI javobini o'qib bo'lmadi, qayta urinib ko'ring");
  }
}
