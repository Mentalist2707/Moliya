import { Pool, types } from "pg";

// Summalar BIGINT (so'm) — JS number sifatida qaytsin
types.setTypeParser(20, (v) => Number(v));
// DATE — "2026-11-23" ko'rinishidagi matn bo'lib qolsin (vaqt mintaqasi muammosisiz)
types.setTypeParser(1082, (v) => v);
// TIMESTAMPTZ — matn sifatida
types.setTypeParser(1184, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __moliyaPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __moliyaReady: Promise<void> | undefined;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    target BIGINT NOT NULL,
    saved BIGINT NOT NULL DEFAULT 0,
    deadline DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- direction: 'owe'  = men qarzdorman (qarzlarim)
  --            'lend' = menga qarzdor (olishim kerak)
  CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    direction TEXT NOT NULL CHECK (direction IN ('owe','lend')),
    person TEXT NOT NULL,
    amount BIGINT NOT NULL,
    paid BIGINT NOT NULL DEFAULT 0,
    taken_date DATE,
    due_date DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price BIGINT NOT NULL,
    planned_date DATE,
    priority TEXT NOT NULL DEFAULT 'orta' CHECK (priority IN ('yuqori','orta','past')),
    bought SMALLINT NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Har bir to'lov / pul qo'shish tarixi
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('goal','debt')),
    ref_id INTEGER NOT NULL,
    amount BIGINT NOT NULL,
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(kind, ref_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('kirim','chiqim')),
    amount BIGINT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Boshqa',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);

  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    note TEXT,
    due_date DATE,
    priority TEXT NOT NULL DEFAULT 'orta' CHECK (priority IN ('yuqori','orta','past')),
    done SMALLINT NOT NULL DEFAULT 0,
    done_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- kind: 'daily' = kunlik vazifa (har kuni qaytadan), 'habit' = odat (streak bilan)
  CREATE TABLE IF NOT EXISTS habits (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'habit' CHECK (kind IN ('daily','habit')),
    emoji TEXT,
    archived SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS habit_logs (
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    PRIMARY KEY (habit_id, date)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    title TEXT,
    body TEXT NOT NULL DEFAULT '',
    pinned SMALLINT NOT NULL DEFAULT 0,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    status TEXT NOT NULL DEFAULT 'reja' CHECK (status IN ('reja','oqiyapman','oqidim')),
    total_pages INTEGER,
    current_page INTEGER NOT NULL DEFAULT 0,
    rating SMALLINT,
    started DATE,
    finished DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// Ko'p foydalanuvchili rejim: har bir jadvalda user_id (Telegram ID)
const USER_TABLES = ["goals", "debts", "purchases", "payments", "transactions", "tasks", "habits", "habit_logs", "notes", "books"];

const MIGRATE = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,               -- Telegram user ID
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    photo_url TEXT,
    daily_digest SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ${USER_TABLES.map(
    (t) => `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS user_id BIGINT;
  CREATE INDEX IF NOT EXISTS idx_${t}_user ON ${t}(user_id);`
  ).join("\n  ")}
`;

// 3-bosqich: kripto portfel, namoz, qazo, rejalashtiruvchi
const MIGRATE_V3 = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS morning_time TEXT NOT NULL DEFAULT '08:30';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS crypto_report SMALLINT NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Toshkent';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS prayer_remind SMALLINT NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS prayer_offset SMALLINT NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS prayer_list TEXT NOT NULL DEFAULT 'bomdod,peshin,asr,shom,xufton';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS qaza_remind SMALLINT NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS qaza_goal SMALLINT NOT NULL DEFAULT 0;
  ALTER TABLE books ADD COLUMN IF NOT EXISTS genre TEXT;

  -- Kripto / oltin aktivlari. coin = CoinGecko ID
  CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    coin TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_price DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);

  -- Narxlar keshi (USD). Maxsus kalit: 'usd_uzs' — Markaziy bank kursi
  CREATE TABLE IF NOT EXISTS prices_cache (
    coin TEXT PRIMARY KEY,
    usd DOUBLE PRECISION NOT NULL,
    change24 DOUBLE PRECISION,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Namoz vaqtlari keshi (islom.uz ma'lumoti), hudud + sana
  CREATE TABLE IF NOT EXISTS prayer_times (
    region TEXT NOT NULL,
    date DATE NOT NULL,
    bomdod TEXT NOT NULL, quyosh TEXT NOT NULL, peshin TEXT NOT NULL,
    asr TEXT NOT NULL, shom TEXT NOT NULL, xufton TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'islomapi',
    PRIMARY KEY (region, date)
  );

  -- O'qilgan namozlar belgisi
  CREATE TABLE IF NOT EXISTS prayer_log (
    user_id BIGINT NOT NULL,
    date DATE NOT NULL,
    prayer TEXT NOT NULL,
    PRIMARY KEY (user_id, date, prayer)
  );

  -- Qazo namozlar hisobi
  CREATE TABLE IF NOT EXISTS qaza (
    user_id BIGINT NOT NULL,
    prayer TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    done_total INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, prayer)
  );

  -- Yuborilgan xabarlar (bir xabar ikki marta ketmasligi uchun)
  CREATE TABLE IF NOT EXISTS sent_log (
    user_id BIGINT NOT NULL,
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, key)
  );
`;

// 4-bosqich: to'lovlar, byudjet, tug'ilgan kunlar, ro'za, Qur'on, zakot
const MIGRATE_V4 = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS fast_remind SMALLINT NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS sahar_offset SMALLINT NOT NULL DEFAULT 30;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS quran_goal SMALLINT NOT NULL DEFAULT 0;

  -- Oylik to'lovlar va obunalar
  CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    day SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 31),
    category TEXT NOT NULL DEFAULT 'Kommunal',
    remind_days SMALLINT NOT NULL DEFAULT 1,
    last_paid DATE,
    active SMALLINT NOT NULL DEFAULT 1,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);

  -- Kategoriya bo'yicha oylik xarajat limiti
  CREATE TABLE IF NOT EXISTS budgets (
    user_id BIGINT NOT NULL,
    category TEXT NOT NULL,
    amount BIGINT NOT NULL,
    PRIMARY KEY (user_id, category)
  );

  CREATE TABLE IF NOT EXISTS birthdays (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    day SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 31),
    year SMALLINT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_birthdays_user ON birthdays(user_id);

  -- Ro'za kundaligi: niyat (tutmoqchiman), tutdim, qoldi
  CREATE TABLE IF NOT EXISTS fast_log (
    user_id BIGINT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('niyat','tutdim','qoldi')),
    PRIMARY KEY (user_id, date)
  );

  -- Qur'on: joriy sahifa (0–604) va xatmlar soni; kunlik o'qilgan sahifalar
  CREATE TABLE IF NOT EXISTS quran (
    user_id BIGINT PRIMARY KEY,
    page INTEGER NOT NULL DEFAULT 0,
    khatm INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS quran_log (
    user_id BIGINT NOT NULL,
    date DATE NOT NULL,
    pages INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );

  -- Zakot uchun qo'lda kiritiladigan mablag'lar
  CREATE TABLE IF NOT EXISTS zakat (
    user_id BIGINT PRIMARY KEY,
    cash_uzs BIGINT NOT NULL DEFAULT 0,
    cash_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
    gold_g DOUBLE PRECISION NOT NULL DEFAULT 0,
    trade_uzs BIGINT NOT NULL DEFAULT 0,
    nisab_uzs BIGINT NOT NULL DEFAULT 100000000,
    include_goals SMALLINT NOT NULL DEFAULT 1,
    include_crypto SMALLINT NOT NULL DEFAULT 1,
    include_debts SMALLINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// 5-bosqich: namoz holati (o'qildi / qazoga yozildi) va qazo tarixi
const MIGRATE_V5 = `
  ALTER TABLE prayer_log ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'oqildi';
  CREATE TABLE IF NOT EXISTS qaza_log (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    date DATE NOT NULL,
    prayer TEXT NOT NULL,
    delta INTEGER NOT NULL,           -- +N qo'shildi, -N o'qildi
    kind TEXT NOT NULL DEFAULT 'manual', -- manual | day (o'tgan kundan) | fix (tuzatish)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_qaza_log_user ON qaza_log(user_id, date);
`;

async function migrate(p: Pool) {
  await p.query(SCHEMA);
  await p.query(MIGRATE);
  await p.query(MIGRATE_V3);
  await p.query(MIGRATE_V4);
  await p.query(MIGRATE_V5);
  // Avvalgi (bir kishilik) versiyadagi ma'lumotlarni egasiga biriktirish
  const owner = Number(process.env.TELEGRAM_OWNER_ID || 0);
  if (owner) {
    await p.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING", [owner]);
    for (const t of USER_TABLES) await p.query(`UPDATE ${t} SET user_id=$1 WHERE user_id IS NULL`, [owner]);
  }
}

function pool(): Pool {
  if (!global.__moliyaPool) {
    // pg ogohlantirmasligi uchun sslmode=require → verify-full (xavfsizlik bir xil)
    const url = process.env.DATABASE_URL?.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full");
    if (!url) throw new Error("DATABASE_URL o'rnatilmagan (.env faylini tekshiring)");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    global.__moliyaPool = new Pool({
      connectionString: url,
      // Neon SSL talab qiladi; lokal Postgres uchun o'chiq
      ssl: local ? false : { rejectUnauthorized: true },
      max: 5,
    });
  }
  return global.__moliyaPool;
}

// Birinchi so'rovda jadvallarni avtomatik yaratadi
export async function getDb(): Promise<Pool> {
  const p = pool();
  if (!global.__moliyaReady) {
    global.__moliyaReady = migrate(p);
    global.__moliyaReady.catch(() => (global.__moliyaReady = undefined));
  }
  await global.__moliyaReady;
  return p;
}
