import { claude, MODEL_FAST, MODEL_VISION, parseJson } from "./ai";
import { cleanItems, cleanPack, type RuGrammar, type RuItem, type RuPack } from "./ru";

const FORMAT = `Javobni FAQAT bitta JSON obyekt qilib qaytaring, boshqa matnsiz.

Mashq turlari ("exercises" massivi):
- {"type":"choice","q":"savol","options":["a","b","c","d"],"answer":0,"explain":"..."}  — answer: to'g'ri variant indeksi (0 dan)
- {"type":"fill","q":"Я ___ книгу. (читать)","answer":"читаю","accept":["читаю"],"explain":"..."}  — bo'sh joy ___ bilan
- {"type":"translate","q":"o'zbekcha gap","answer":"русский перевод","accept":["boshqa to'g'ri variantlar"],"explain":"..."}

Qoidalar:
- Ruscha matnni xatosiz yozing (to'g'ri kelishik, rod, fe'l shakli). Urg'u belgisi qo'ymang.
- Tushuntirishlar ("explain", "rule", "summary", tarjimalar) — o'zbek tilida, lotin yozuvida, qisqa va sodda.
- "accept" ga mazmunan to'g'ri bo'lgan boshqa variantlarni qo'shing (so'z tartibi, sinonim).
- choice variantlari o'xshash bo'lsin (masalan bir so'zning turli kelishiklari) — taxmin bilan topib bo'lmasin.`;

const SYSTEM = `Siz o'zbek talabaga rus tilini o'rgatadigan tajribali o'qituvchisiz. Talaba rus tili kursida o'qiydi (boshlang'ich–o'rta daraja).
Vazifangiz: dars materialidan foydali, aniq va to'g'ri o'quv materiali tayyorlash.`;

/** Darslik/daftar/doska rasmlaridan dars to'plamini tuzish */
export async function packFromImages(images: { data: string; type: "image/jpeg" | "image/png" | "image/webp" }[], hint?: string): Promise<RuPack> {
  const text = `Bu rasm(lar) — rus tili darsidan (darslik sahifasi, daftar yoki doska).${hint ? `\nTalabaning izohi: «${hint}»` : ""}

1) Rasmdagi hamma narsani diqqat bilan o'qing: yangi so'zlar, grammatik qoida, jadvallar, misollar, mashqlar.
2) Shu asosida JSON tuzing:
{
  "topic": "dars mavzusi (qisqa, o'zbekcha; ruscha nom bo'lsa qavsda)",
  "summary": "dars nima haqida — 2–3 gap",
  "grammar": [{"title":"qoida nomi","rule":"qoida tushuntirishi (oxirlar, jadval bo'lsa matn ko'rinishida)","examples":[{"ru":"...","uz":"..."}]}],
  "words": [{"ru":"книга","uz":"kitob","gender":"f","example":"Это моя книга."}],
  "homework": "rasmda uy vazifasi ko'rsatilgan bo'lsa — matni, aks holda bo'sh",
  "exercises": [...]
}
- "words": rasmdagi barcha yangi/muhim so'zlar. Otlar uchun "gender": m/f/n/pl, boshqalariga null. Fe'llarni infinitivda yozing (juftligi bo'lsa: "читать / прочитать").
- "exercises": 15–20 ta. Avval rasmdagi mashqlarni (bo'lsa) shu formatga o'tkazing, keyin qoidani va so'zlarni mustahkamlash uchun yangi mashqlar qo'shing. Turlarni aralashtiring: ~40% fill, ~35% choice, ~25% translate.
- Rasmda o'qib bo'lmaydigan joy bo'lsa — taxmin qilmang, tashlab keting.

${FORMAT}`;
  const out = await claude({
    model: MODEL_VISION(),
    system: SYSTEM,
    maxTokens: 12000,
    content: [...images.map((im) => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.type, data: im.data } })), { type: "text", text }],
  });
  const pack = cleanPack(parseJson(out));
  if (!pack.words.length && !pack.grammar.length && !pack.exercises.length) throw new Error("Rasmdan dars materiali topilmadi. Aniqroq rasmga oling.");
  return pack;
}

/** Mavzu, qoida va so'zlar asosida yangi mashqlar */
export async function generateExercises(opts: {
  topic: string;
  grammar: RuGrammar[];
  words: { ru: string; uz: string }[];
  weak?: { ru: string; uz: string }[];
  count?: number;
  focus?: string;
}): Promise<RuItem[]> {
  const n = Math.min(25, Math.max(5, opts.count ?? 12));
  const text = `Mavzu: ${opts.topic || "umumiy takrorlash"}
${opts.focus ? `Talaba so'radi: «${opts.focus}»\n` : ""}
Grammatika:
${opts.grammar.map((g) => `- ${g.title}: ${g.rule}`).join("\n") || "- (berilmagan — mavzuga mos asosiy qoidalar)"}

Talabaning so'zlari:
${opts.words.slice(0, 60).map((w) => `${w.ru} — ${w.uz}`).join("\n") || "(yo'q)"}
${opts.weak?.length ? `\nTalaba ko'p xato qiladigan so'zlar (ularga ko'proq e'tibor bering):\n${opts.weak.map((w) => `${w.ru} — ${w.uz}`).join("\n")}` : ""}

Shu material asosida ${n} ta mustahkamlovchi mashq tuzing. Asosan talabaning so'zlarini ishlating va grammatik qoidani turli shakllarda qo'llating. Oson mashqlardan qiyinroqqa o'ting.
Format: {"exercises":[...]}

${FORMAT}`;
  const out = await claude({ model: MODEL_FAST(), system: SYSTEM, maxTokens: 8000, content: [{ type: "text", text }] });
  const items = cleanItems(parseJson(out).exercises);
  if (!items.length) throw new Error("Mashq tuzilmadi, qayta urinib ko'ring");
  return items;
}
