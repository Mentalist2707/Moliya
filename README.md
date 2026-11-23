# Moliya — shaxsiy moliya ilovasi

Next.js 15 + PostgreSQL (Neon). Ma'lumotlar Neon bulut bazasida saqlanadi,
jadvallar birinchi ishga tushganda avtomatik yaratiladi.

## 1. Neon baza olish (bepul)

1. https://neon.tech → ro'yxatdan o'ting → **New Project**
   (Region: Yevropaga yaqinini tanlang, masalan Frankfurt)
2. Dashboard → **Connect** → **Pooled connection** yoqilgan holda
   ulanish manzilini nusxalang. U shunday ko'rinadi:
   `postgresql://USER:PAROL@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`

## 2. Lokal ishga tushirish

Kerak: **Node.js 18.18+** (tavsiya: 20 yoki 22)

```bash
cp .env.example .env     # va ichini to'ldiring
npm install
npm run dev
```

Brauzerda: http://localhost:3000

## .env sozlamalari

| O'zgaruvchi | Nima uchun |
|---|---|
| `DATABASE_URL` | Neon ulanish manzili (1-qadamdan) |
| `APP_PASSWORD` | Kirish paroli. Internetda **albatta** qo'ying |
| `AUTH_SECRET` | Cookie uchun maxfiy kalit: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

`.env` fayli GitHub'ga yuklanmaydi (`.gitignore`da).

## 3. Vercel'ga deploy

1. https://vercel.com → **Add New → Project** → GitHub'dan `Moliya` repo'ni tanlang
2. **Environment Variables** bo'limiga yuqoridagi 3 ta o'zgaruvchini kiriting
3. **Deploy** — bir necha daqiqada `moliya-xxx.vercel.app` manzili tayyor

Keyin har safar GitHub'ga push qilganingizda Vercel o'zi qayta deploy qiladi.
`.env`ni o'zgartirsangiz — Vercel'da **Redeploy** bosing.

## Bo'limlar

- **Umumiy** — sof qarz holati, umumiy raqamlar, yaqin 45 kunlik muddatlar
- **Maqsadlar** — nomi, kerakli summa, yig'ilgan pul, muddat; oyiga qancha yig'ish kerakligi
- **Qarzlarim** — kimdan, qancha, qachon qaytarish; qisman to'lovlar tarixi
- **Menga qarzlar** — kimga berdim, qancha qaytardi, muddati o'tganlar qizil
- **Xaridlar** — olishim kerak bo'lgan narsalar: narxi, qachon, muhimligi

## Ma'lumotlar bazasi

Jadvallar: `goals` (maqsadlar), `debts` (qarzlar), `purchases` (xaridlar),
`payments` (to'lovlar tarixi). Ularni Neon → **Tables** bo'limida ham ko'rish mumkin.
Neon'da bazani oldingi holatga qaytarish (restore) imkoniyati ham bor.

## Tuzilishi

```
app/page.tsx              — interfeys
app/api/...               — REST API (GET /api/data, POST/PATCH/DELETE)
components/Forms.tsx      — formalar va modal oynalar
lib/db.ts                 — PostgreSQL ulanishi va jadvallar
lib/repo.ts               — baza bilan ishlash funksiyalari
lib/auth.ts, middleware.ts — parol bilan himoya
app/login/page.tsx        — kirish sahifasi
```
