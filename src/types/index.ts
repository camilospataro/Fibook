export interface Settings {
  id: string;
  userId: string;
  exchangeRate: number;
}

export interface DebtAccount {
  id: string;
  userId: string;
  name: string;
  currency: 'COP' | 'USD';
  currentBalance: number;
  minimumMonthlyPayment: number;
  color: string;
}

export interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  amount: number;
  isRecurring: boolean;
}

export interface FixedExpense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  category: 'housing' | 'food' | 'transport' | 'entertainment' | 'health' | 'other';
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  currency: 'COP' | 'USD';
  amount: number;
  active: boolean;
}

export interface SpendingEntry {
  id: string;
  userId: string;
  date: string;
  description: string;
  amount: number;
  category: 'groceries' | 'transport' | 'food' | 'entertainment' | 'health' | 'shopping' | 'other';
  paymentMethod: 'cash' | 'debit' | 'credit_mastercard_cop' | 'credit_mastercard_usd' | 'credit_visa';
}

export interface MonthlySnapshot {
  id: string;
  userId: string;
  month: string;
  debtBalances: { accountId: string; balance: number }[];
  incomeEntries: { sourceId: string; amount: number }[];
  sideIncome: number;
  totalIncome: number;
  totalExpenses: number;
  totalDebtPaid: number;
  newCharges: number;
  balance: number;
  cashOnHand: number;
  savings: number;
}

export type SpendingCategory = SpendingEntry['category'];
export type PaymentMethod = SpendingEntry['paymentMethod'];
export type ExpenseCategory = FixedExpense['category'];
