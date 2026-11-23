# Moliya — shaxsiy moliya ilovasi

Next.js 15 + SQLite (better-sqlite3). Barcha ma'lumotlar kompyuteringizdagi
`data/moliya.db` faylida saqlanadi — internet yoki tashqi server kerak emas.

## Ishga tushirish

Kerak: **Node.js 18.18+** (tavsiya: 20 yoki 22) — https://nodejs.org

```bash
npm install
npm run dev
```

Brauzerda oching: http://localhost:3000

Doimiy ishlatish uchun (tezroq):

```bash
npm run build
npm start
```

## .env sozlamalari

`.env.example` dan nusxa oling: `cp .env.example .env`

| O'zgaruvchi | Nima uchun | Misol |
|---|---|---|
| `APP_PASSWORD` | Kirish paroli. Internetga chiqarsangiz **albatta** qo'ying | `KuchliParol_2026` |
| `AUTH_SECRET` | Cookie uchun maxfiy kalit (uzun tasodifiy satr) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_PATH` | SQLite fayli yo'li (doimiy diskda bo'lishi kerak) | `/data/moliya.db` |

`APP_PASSWORD` bo'sh bo'lsa, ilova parolsiz ochiladi (faqat lokal ishlatish uchun).

## Deploy (Railway — tavsiya etiladi)

SQLite fayl bazasi bo'lgani uchun ilovaga **doimiy disk** kerak.
Vercel/Netlify'da fayl saqlanmaydi — u yerda ma'lumotlar yo'qolib ketadi.

1. https://railway.app → New Project → Deploy from GitHub → `Moliya` repo
2. Service → **Settings → Volumes → Add Volume**, Mount path: `/data`
3. **Variables** bo'limiga qo'shing:
   - `APP_PASSWORD` = o'z parolingiz
   - `AUTH_SECRET` = tasodifiy uzun satr
   - `DATABASE_PATH` = `/data/moliya.db`
4. **Settings → Networking → Generate Domain** — tayyor manzil beriladi.

Build/Start buyruqlarini Railway o'zi aniqlaydi (`npm run build`, `npm start`).
Render.com yoki o'z VPS'ingizda ham xuddi shunday: doimiy disk + 3 ta o'zgaruvchi.

## Bo'limlar

- **Umumiy** — sof qarz holati, umumiy raqamlar, yaqin 45 kunlik muddatlar
- **Maqsadlar** — nomi, kerakli summa, yig'ilgan pul, muddat; oyiga qancha yig'ish kerakligi
- **Qarzlarim** — kimdan, qancha, qachon qaytarish; qisman to'lovlar tarixi
- **Menga qarzlar** — kimga berdim, qancha qaytardi, muddati o'tganlar qizil
- **Xaridlar** — olishim kerak bo'lgan narsalar: narxi, qachon, muhimligi

## Ma'lumotlar bazasi

`data/moliya.db` — oddiy SQLite fayl. Zaxira nusxa olish uchun shu faylni
(server o'chiq paytda) nusxalab qo'ying. Jadvallar: `goals`, `debts`,
`purchases`, `payments`. Baza birinchi ishga tushganda o'zi yaratiladi.

## Tuzilishi

```
app/page.tsx              — interfeys
app/api/...               — REST API (GET /api/data, POST/PATCH/DELETE)
components/Forms.tsx      — formalar va modal oynalar
lib/db.ts                 — SQLite ulanishi va jadvallar
lib/repo.ts               — baza bilan ishlash funksiyalari
lib/auth.ts, middleware.ts — parol bilan himoya
app/login/page.tsx        — kirish sahifasi
```

Windows'da `npm install` xato bersa (better-sqlite3), Node.js'ning LTS
versiyasini o'rnating va qayta urinib ko'ring.
