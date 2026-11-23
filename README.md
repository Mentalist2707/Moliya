# Moliya — shaxsiy yordamchi

Bitta ilovada: **Bugun** (bosh sahifa), **Vazifalar** (to-do + kunlik vazifalar),
**Odatlar** (streak bilan), **Moliya** (kirim-chiqim, qarzlar, maqsadlar, xaridlar),
**Eslatmalar** va **Kitoblar**. Telegram Mini App sifatida ishlaydi, bot har kuni
ertalab eslatma yuboradi. Ko'p foydalanuvchili: har kim Telegram orqali kiradi.

Texnologiyalar: Next.js 15 · PostgreSQL (Neon) · Vercel.

---

## 1. Neon baza (bepul)

1. https://neon.tech → **New Project** (region: Frankfurt)
2. **Connect** → **Pooled connection** → manzilni nusxalang → `DATABASE_URL`

Jadvallar ilova birinchi ochilganda o'zi yaratiladi.

## 2. Telegram bot

1. [@BotFather](https://t.me/BotFather) → `/newbot` → token → `TELEGRAM_BOT_TOKEN`
2. Brauzerdan kirish uchun: @BotFather → `/setdomain` → botingiz → Vercel domeningiz
   (masalan `moliya.vercel.app`). Busiz faqat Telegram ichidan kirish ishlaydi.

## 3. Vercel'ga deploy

1. https://vercel.com → **Add New → Project** → GitHub'dan `Moliya`
2. **Environment Variables** (`.env.example` da batafsil):

| O'zgaruvchi | Majburiy | Qayerdan |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon |
| `TELEGRAM_BOT_TOKEN` | ✅ | @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | ✅ | Tasodifiy satr |
| `AUTH_SECRET` | ✅ | Tasodifiy satr (32+ belgi) |
| `CRON_SECRET` | ✅ | Tasodifiy satr |
| `ALLOWED_USER_IDS` | — | Faqat tanlangan odamlar kirsin desangiz |
| `TELEGRAM_OWNER_ID` | — | Avvalgi versiyadan ma'lumot o'tkazish uchun |

Tasodifiy satr: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

3. **Deploy**
4. Bir marta oching:
   `https://SIZNING-DOMEN.vercel.app/api/telegram/setup?key=TELEGRAM_WEBHOOK_SECRET_QIYMATI`
   Bu webhook, menyu tugmasi ("Ochish") va buyruqlarni o'rnatadi. Javobda `"ok": true` bo'lishi kerak.
5. Botga `/start` yozing → **Ilovani ochish**.

> Domen o'zgarsa — 4-qadamni va `/setdomain` ni takrorlang.

## Ko'p foydalanuvchi

- Har kim **Telegram orqali** kiradi: bot ichida (Mini App) avtomatik, brauzerda
  "Log in with Telegram" tugmasi bilan. Parol yo'q.
- Har bir foydalanuvchi **faqat o'z ma'lumotini** ko'radi va o'zgartiradi: barcha
  jadvallarda `user_id` bor, har bir so'rov sessiyadagi ID bo'yicha filtrlanadi.
- Sessiya — imzolangan cookie (HMAC-SHA256, `AUTH_SECRET`), 60 kun amal qiladi.
- Sozlamalar (bosh sahifadagi avatar): ertalabki xabarni yoqish/o'chirish, chiqish,
  hisobni va barcha ma'lumotlarni butunlay o'chirish.
- Kimlar kirishini cheklash: `ALLOWED_USER_IDS=111,222`.

## Telegram imkoniyatlari

- **Tez qo'shish** — botga yozing:
  - `-25000 tushlik` — xarajat (kategoriya avtomatik)
  - `-30k taksi` — xarajat (`k` = ming, `mln` = million)
  - `+3mln maosh` — kirim
  - boshqa har qanday matn — yangi vazifa
- **Ertalabki xabar** — har kuni 08:00–08:59 (Toshkent) oralig'ida har bir foydalanuvchiga
  o'z rejasi. Aytadigan gap bo'lmasa yuborilmaydi. Botni bloklaganlarga avtomatik to'xtaydi.
  `/stop` — o'chirish, `/digest` — yoqish.
  Vercel bepul tarifida cron kuniga 1 marta, soat ichida istalgan daqiqada ishlaydi.

## Aniq vaqtli eslatmalar (cron-job.org)

Namoz eslatmalari va ertalabki xabar (masalan, aynan 08:30) uchun har daqiqada chaqiriladigan
tashqi cron kerak — Vercel bepul tarifida cron kuniga 1 marta va soat ichida istalgan daqiqada ishlaydi.

1. https://cron-job.org → ro'yxatdan o'ting (bepul) → **Create cronjob**
2. URL: `https://SIZNING-DOMEN.vercel.app/api/cron/tick?key=CRON_SECRET_QIYMATI`
3. Execution schedule: **Every 1 minute** → Save

Vercel Cron (`vercel.json`, har kuni 08:30–09:29) zaxira sifatida qoladi: cron-job.org ishlamasa ham
ertalabki xabar baribir boradi.

Neon bepul tarifi (oyiga 100 CU-soat) tejaladi: rejalashtiruvchi soatiga bir marta sozlamalarni o'qiydi,
qolgan vaqtda bazani faqat xabar yuborish kerak bo'lgan daqiqalarda uyg'otadi.

## Kripto portfel

Moliya → Kripto: GRAM (Toncoin), BTC, XAUt (oltin) va istalgan CoinGecko tangasi. Narxlar CoinGecko'dan,
dollar kursi O'zbekiston Markaziy bankidan. Ertalabki xabarda: portfel qiymati, kechagidan (24 soat)
foyda/zarar, o'rtacha narx kiritilgan bo'lsa — sotib olingandan beri foyda. `COINGECKO_API_KEY`
(ixtiyoriy, bepul demo kalit) cheklovlarga tushmaslik uchun.

## Namoz

Vaqtlar islomapi.uz (islom.uz) dan olinadi; u ishlamasa — astronomik hisob (Toshkent uchun islom.uz
jadvali bilan bir xil, boshqa hududlarda ±2 daqiqa). Botdagi eslatmada «✅ O'qidim» tugmasi bor.
Qazo hisoblagichi, ko'p kunlik qazoni bir yo'la qo'shish, kunlik maqsad. Buyruqlar: `/namoz`,
`/namoz_on`, `/namoz_off`, `/kripto`.

## Qo'shimcha bo'limlar

- **To'lovlar** (Moliya): har oylik to'lovlar va obunalar; ertalabki xabarda muddatdan oldin eslatma; «To'ladim» xarajatga yozadi
- **Limitlar** (Kirim-chiqim): kategoriya bo'yicha oylik limit; 80% va 100% da bot ogohlantiradi
- **Zakot** (Moliya): naqd, dollar, oltin, tijorat moli, maqsadlar, kripto va qarzlardan hisob; nisob standart 100 mln so'm
  (O'zbekiston musulmonlari idorasi, 2026) — o'zgartirsa bo'ladi
- **Ro'za** (Ibodat): Ramazon taqvimi (saharlik/iftorlik), saharlik va iftorlik eslatmalari, «Ro'za tutdim» tugmasi,
  nafl ro'za niyati, qazo ro'zalar. Ramazon sanasi hijriy taqvimdan taxminiy (O'zbekiston uchun 1 kun suriladi)
- **Qur'on** (Ibodat): o'qilgan sahifalar, pora, xatm, kunlik maqsad, `/quron 5` buyrug'i
- **Tug'ilgan kunlar** (Eslatmalar): bir kun oldin va o'sha kuni ertalabki xabarda

## Lokal ishga tushirish

```bash
cp .env.example .env      # kamida DATABASE_URL ni to'ldiring
npm install
npm run dev               # http://localhost:3000
```

`TELEGRAM_BOT_TOKEN` bo'sh bo'lsa — lokal rejim: login so'ralmaydi, bitta foydalanuvchi.

## Tuzilishi

```
app/page.tsx                 — qobiq: menyu, yo'naltirish, Telegram sozlamalari
components/Today.tsx         — Bugun (bosh sahifa)
components/Tasks.tsx         — To-do va kunlik vazifalar
components/Habits.tsx        — Odatlar
components/Finance.tsx       — Kirim-chiqim, qarzlar, maqsadlar, xaridlar
components/Notes.tsx         — Eslatmalar
components/Books.tsx         — Kitoblar
components/forms.tsx         — barcha formalar
lib/db.ts                    — PostgreSQL ulanishi va jadvallar sxemasi
lib/repo.ts                  — baza funksiyalari
lib/telegram.ts              — initData tekshiruvi, Bot API
app/api/telegram/webhook     — bot xabarlari
app/api/telegram/setup       — webhook va menyu tugmasini o'rnatish
app/api/cron/daily           — ertalabki xabar
app/api/tg-auth              — Mini App orqali kirish
app/api/auth/telegram        — brauzerdan Telegram Login Widget orqali kirish
app/api/me                   — profil, sozlamalar, hisobni o'chirish
lib/auth.ts                  — imzolangan sessiya, ruxsatlar
lib/digest.ts                — ertalabki xabar matni
middleware.ts                — kirish himoyasi
```
