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
`;

function pool(): Pool {
  if (!global.__moliyaPool) {
    const url = process.env.DATABASE_URL;
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
    global.__moliyaReady = p.query(SCHEMA).then(() => undefined);
    global.__moliyaReady.catch(() => (global.__moliyaReady = undefined));
  }
  await global.__moliyaReady;
  return p;
}
