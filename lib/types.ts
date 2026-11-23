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
  status: "reja" | "oqiyapman" | "oqidim";
  total_pages: number | null;
  current_page: number;
  rating: number | null;
  started: string | null;
  finished: string | null;
  note: string | null;
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
};
