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
  priority: "yuqori" | "orta" | "past";
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

export type AllData = {
  goals: Goal[];
  debts: Debt[];
  purchases: Purchase[];
  payments: Payment[];
};
