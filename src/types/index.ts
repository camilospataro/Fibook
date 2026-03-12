export interface Settings {
  id: string;
  userId: string;
  exchangeRate: number;
  exchangeRateUpdatedAt: string | null;
  savingsTarget: number;
  savingsSourceAccountId: string | null;
  savingsDestAccountId: string | null;
  savingsTransferDay: number;
}

export interface DebtAccount {
  id: string;
  userId: string;
  name: string;
  currency: 'COP' | 'USD';
  currentBalance: number;
  minimumMonthlyPayment: number;
  monthlyPayment: number;
  color: string;
  linkedAccountId: string | null;
}

export interface CheckingAccount {
  id: string;
  userId: string;
  name: string;
  currency: 'COP' | 'USD';
  currentBalance: number;
  color: string;
}

export interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: 'COP' | 'USD';
  isRecurring: boolean;
  linkedAccountId: string | null;
  depositDay: number;
}

export interface FixedExpense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: 'COP' | 'USD';
  category: 'housing' | 'food' | 'transport' | 'entertainment' | 'health' | 'other';
  linkedAccountId: string | null;
  paymentDay: number;
  paymentMode: 'auto' | 'manual';
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  currency: 'COP' | 'USD';
  amount: number;
  group: string;
  active: boolean;
  linkedAccountId: string | null;
  paymentDay: number;
  billingCycle: 'monthly' | 'annual';
  renewalMonth: number | null; // 1-12 for annual subs, null for monthly
}

export interface SpendingEntry {
  id: string;
  userId: string;
  date: string;
  description: string;
  amount: number;
  category: 'groceries' | 'transport' | 'food' | 'entertainment' | 'health' | 'shopping' | 'other';
  paymentMethod: 'cash' | 'debit' | 'credit_mastercard_cop' | 'credit_mastercard_usd' | 'credit_visa' | `checking_${string}` | `debt_${string}`;
  linkedAccountId: string | null;
  linkedBudgetId: string | null;
  tags: string[];
}

export interface MonthlySnapshot {
  id: string;
  userId: string;
  month: string;
  debtBalances: { accountId: string; balance: number }[];
  checkingBalances: { accountId: string; balance: number }[];
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
