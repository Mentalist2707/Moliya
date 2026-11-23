export type Priority = "yuqori" | "orta" | "past";

export type Goal = {
  id: number;
  name: string;
  target: number;
  saved: number;
  deadline: string | null;
  note: string | null;
  created_at: string;
};

export type Debt = {
  id: number;
  direction: "owe" | "lend";
  person: string;
  amount: number;
  paid: number;
  taken_date: string | null;
  due_date: string | null;
  note: string | null;
  created_at: string;
};

export type Purchase = {
  id: number;
  name: string;
  price: number;
  planned_date: string | null;
  priority: Priority;
  bought: number;
  note: string | null;
  created_at: string;
};

export type Payment = {
  id: number;
  kind: "goal" | "debt";
  ref_id: number;
  amount: number;
  date: string;
  note: string | null;
};

export type Tx = {
  id: number;
  type: "kirim" | "chiqim";
  amount: number;
  category: string;
  date: string;
  note: string | null;
};

export type Task = {
  id: number;
  title: string;
  note: string | null;
  due_date: string | null;
  priority: Priority;
  done: number;
  done_at: string | null;
  created_at: string;
};

export type Habit = {
  id: number;
  name: string;
  kind: "daily" | "habit";
  emoji: string | null;
  archived: number;
};

export type HabitLog = { habit_id: number; date: string };

export type Note = {
  id: number;
  title: string | null;
  body: string;
  pinned: number;
  color: string | null;
  updated_at: string;
};

export type Book = {
  id: number;
  title: string;
  author: string | null;
  genre: string | null;
  status: "reja" | "oqiyapman" | "oqidim";
  total_pages: number | null;
  current_page: number;
  rating: number | null;
  started: string | null;
  finished: string | null;
  note: string | null;
};

export type Holding = {
  id: number;
  coin: string;
  symbol: string;
  name: string | null;
  amount: number;
  avg_price: number | null;
};

export type Qaza = { prayer: string; count: number; done_total: number };
export type PrayerLog = { date: string; prayer: string };

export type Bill = {
  id: number;
  name: string;
  amount: number;
  day: number;
  category: string;
  remind_days: number;
  last_paid: string | null;
  active: number;
  note: string | null;
};
export type Budget = { category: string; amount: number };
export type Birthday = { id: number; name: string; month: number; day: number; year: number | null; note: string | null };
export type FastLog = { date: string; status: "niyat" | "tutdim" | "qoldi" };
export type Zakat = {
  cash_uzs: number;
  cash_usd: number;
  gold_g: number;
  trade_uzs: number;
  nisab_uzs: number;
  include_goals: number;
  include_crypto: number;
  include_debts: number;
};

export type AllData = {
  goals: Goal[];
  debts: Debt[];
  purchases: Purchase[];
  payments: Payment[];
  transactions: Tx[];
  tasks: Task[];
  habits: Habit[];
  habit_logs: HabitLog[];
  notes: Note[];
  books: Book[];
  holdings: Holding[];
  qaza: Qaza[];
  prayer_log: PrayerLog[];
  bills: Bill[];
  budgets: Budget[];
  birthdays: Birthday[];
  fast_log: FastLog[];
  quran: { page: number; khatm: number };
  quran_log: { date: string; pages: number }[];
  zakat: Zakat | null;
};
