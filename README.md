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
