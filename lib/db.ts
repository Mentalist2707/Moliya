import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Baza fayli: .env dagi DATABASE_PATH yoki loyiha ichidagi data/moliya.db
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "moliya.db");
const DATA_DIR = path.dirname(DB_PATH);

declare global {
  // eslint-disable-next-line no-var
  var __moliyaDb: Database.Database | undefined;
}

function init(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      saved REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- direction: 'owe'  = men qarzdorman (qarzlarim)
    --            'lend' = menga qarzdor (olishim kerak)
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL CHECK (direction IN ('owe','lend')),
      person TEXT NOT NULL,
      amount REAL NOT NULL,
      paid REAL NOT NULL DEFAULT 0,
      taken_date TEXT,
      due_date TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      planned_date TEXT,
      priority TEXT NOT NULL DEFAULT 'orta' CHECK (priority IN ('yuqori','orta','past')),
      bought INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- Har bir to'lov / pul qo'shish tarixi
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK (kind IN ('goal','debt')),
      ref_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(kind, ref_id);
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__moliyaDb) global.__moliyaDb = init();
  return global.__moliyaDb;
}
