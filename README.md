# Moliya — shaxsiy yordamchi

Bitta ilovada: **Bugun** (bosh sahifa), **Vazifalar** (to-do + kunlik vazifalar),
**Odatlar** (streak bilan), **Moliya** (kirim-chiqim, qarzlar, maqsadlar, xaridlar),
**Eslatmalar** va **Kitoblar**. Telegram Mini App sifatida ishlaydi, bot har kuni
ertalab eslatma yuboradi.

Texnologiyalar: Next.js 15 · PostgreSQL (Neon) · Vercel.

---

## 1. Neon baza (bepul)

1. https://neon.tech → **New Project** (region: Frankfurt)
2. **Connect** → **Pooled connection** → manzilni nusxalang → `DATABASE_URL`

Jadvallar ilova birinchi ochilganda o'zi yaratiladi.

## 2. Telegram bot

1. [@BotFather](https://t.me/BotFather) → `/newbot` → token → `TELEGRAM_BOT_TOKEN`
2. [@userinfobot](https://t.me/userinfobot) → `/start` → ID raqamingiz → `TELEGRAM_OWNER_ID`

## 3. Vercel'ga deploy

1. https://vercel.com → **Add New → Project** → GitHub'dan `Moliya`
2. **Environment Variables** — `.env.example` dagi barcha qiymatlar:

| O'zgaruvchi | Qayerdan |
|---|---|
| `DATABASE_URL` | Neon |
| `APP_PASSWORD` | O'zingiz o'ylab topasiz (brauzerdan kirish uchun) |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `TELEGRAM_OWNER_ID` | @userinfobot |
| `TELEGRAM_WEBHOOK_SECRET` | Tasodifiy satr (yuqoridagi buyruq bilan) |
| `CRON_SECRET` | Tasodifiy satr (yuqoridagi buyruq bilan) |

3. **Deploy**
4. Saytni oching → parol bilan kiring → manzilga `/api/telegram/setup` qo'shib oching:
   `https://SIZNING-DOMEN.vercel.app/api/telegram/setup`
   Bu bir marta qilinadi: webhook, menyu tugmasi ("Ochish") va `/start` buyrug'ini o'rnatadi.
   Javobda `"ok": true` bo'lishi kerak.
5. Botga `/start` yozing → **Ilovani ochish** tugmasi chiqadi.

> Domen o'zgarsa (yoki o'z domeningizni ulasangiz) — 4-qadamni takrorlang.

## Telegram imkoniyatlari

- **Mini App** — bot menyusidagi "Ochish" tugmasi. Telegram ichida parolsiz,
  avtomatik kiradi (faqat `TELEGRAM_OWNER_ID` egasi uchun). Telegram mavzusiga
  (kunduzgi/tungi) moslashadi.
- **Tez qo'shish** — botga shunchaki yozing:
  - `-25000 tushlik` — xarajat (kategoriya avtomatik: Oziq-ovqat)
  - `-30k taksi` — xarajat (`k` = ming, `mln` = million)
  - `+3mln maosh` — kirim
  - boshqa har qanday matn — yangi vazifa
- **Ertalabki eslatma** — har kuni 08:00–08:59 (Toshkent) oralig'ida: bugungi
  vazifalar, kunlik ro'yxat, yaqin qarz muddatlari, kechagi xarajat, o'qilayotgan kitob.
  Vaqt `vercel.json` da (`0 3 * * *` = UTC 03:00). Vercel bepul tarifida cron kuniga
  1 marta ishlaydi va soat ichida istalgan daqiqada chaqiriladi.

## Lokal ishga tushirish

```bash
cp .env.example .env      # kamida DATABASE_URL ni to'ldiring
npm install
npm run dev               # http://localhost:3000
```

`APP_PASSWORD` va `TELEGRAM_BOT_TOKEN` ikkalasi ham bo'sh bo'lsa — parolsiz ochiladi.

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
middleware.ts                — kirish himoyasi
```
