import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { fetchUSDtoCOP } from '@/lib/exchangeRate';
import type { DebtAccount, IncomeSource, FixedExpense, Subscription, SpendingEntry, MonthlySnapshot, Settings } from '@/types';

interface FinanceState {
  userId: string | null;
  settings: Settings | null;
  debtAccounts: DebtAccount[];
  incomeSources: IncomeSource[];
  fixedExpenses: FixedExpense[];
  subscriptions: Subscription[];
  spending: SpendingEntry[];
  snapshots: MonthlySnapshot[];
  loading: boolean;

  setUserId: (id: string | null) => void;
  fetchAll: (userId: string) => Promise<void>;

  // Settings
  updateExchangeRate: (rate: number) => Promise<void>;
  refreshExchangeRate: () => Promise<void>;

  // Debt accounts
  addDebtAccount: (account: Omit<DebtAccount, 'id' | 'userId'>) => Promise<void>;
  updateDebtAccount: (id: string, updates: Partial<DebtAccount>) => Promise<void>;
  deleteDebtAccount: (id: string) => Promise<void>;

  // Income sources
  addIncomeSource: (source: Omit<IncomeSource, 'id' | 'userId'>) => Promise<void>;
  updateIncomeSource: (id: string, updates: Partial<IncomeSource>) => Promise<void>;
  deleteIncomeSource: (id: string) => Promise<void>;

  // Fixed expenses
  addFixedExpense: (expense: Omit<FixedExpense, 'id' | 'userId'>) => Promise<void>;
  updateFixedExpense: (id: string, updates: Partial<FixedExpense>) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;

  // Subscriptions
  addSubscription: (sub: Omit<Subscription, 'id' | 'userId'>) => Promise<void>;
  updateSubscription: (id: string, updates: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;

  // Spending
  addSpending: (entry: Omit<SpendingEntry, 'id' | 'userId'>) => Promise<void>;
  deleteSpending: (id: string) => Promise<void>;

  // Snapshots
  saveSnapshot: (snapshot: Omit<MonthlySnapshot, 'id' | 'userId'>) => Promise<void>;
}

function mapSettings(row: Record<string, unknown>): Settings {
  return { id: row.id as string, userId: row.user_id as string, exchangeRate: row.exchange_rate as number };
}

function mapDebt(row: Record<string, unknown>): DebtAccount {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    currency: row.currency as 'COP' | 'USD', currentBalance: row.current_balance as number,
    minimumMonthlyPayment: row.minimum_monthly_payment as number, color: row.color as string,
  };
}

function mapIncome(row: Record<string, unknown>): IncomeSource {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    amount: row.amount as number, isRecurring: row.is_recurring as boolean,
  };
}

function mapExpense(row: Record<string, unknown>): FixedExpense {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    amount: row.amount as number, category: row.category as FixedExpense['category'],
  };
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    currency: row.currency as 'COP' | 'USD', amount: row.amount as number, active: row.active as boolean,
  };
}

function mapSpending(row: Record<string, unknown>): SpendingEntry {
  return {
    id: row.id as string, userId: row.user_id as string, date: row.date as string,
    description: row.description as string, amount: row.amount as number,
    category: row.category as SpendingEntry['category'],
    paymentMethod: row.payment_method as SpendingEntry['paymentMethod'],
  };
}

function mapSnapshot(row: Record<string, unknown>): MonthlySnapshot {
  return {
    id: row.id as string, userId: row.user_id as string, month: row.month as string,
    debtBalances: row.debt_balances as MonthlySnapshot['debtBalances'],
    incomeEntries: row.income_entries as MonthlySnapshot['incomeEntries'],
    sideIncome: row.side_income as number, totalIncome: row.total_income as number,
    totalExpenses: row.total_expenses as number, totalDebtPaid: row.total_debt_paid as number,
    newCharges: row.new_charges as number, balance: row.balance as number,
    cashOnHand: row.cash_on_hand as number, savings: row.savings as number,
  };
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  userId: null,
  settings: null,
  debtAccounts: [],
  incomeSources: [],
  fixedExpenses: [],
  subscriptions: [],
  spending: [],
  snapshots: [],
  loading: false,

  setUserId: (id) => set({ userId: id }),

  fetchAll: async (userId) => {
    set({ loading: true });
    const [settingsRes, debtRes, incomeRes, expenseRes, subsRes, spendingRes, snapshotsRes] = await Promise.all([
      supabase.from('settings').select('*').eq('user_id', userId).single(),
      supabase.from('debt_accounts').select('*').eq('user_id', userId),
      supabase.from('income_sources').select('*').eq('user_id', userId),
      supabase.from('fixed_expenses').select('*').eq('user_id', userId),
      supabase.from('subscriptions').select('*').eq('user_id', userId),
      supabase.from('spending').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('monthly_snapshots').select('*').eq('user_id', userId).order('month', { ascending: false }),
    ]);

    const mappedSettings = settingsRes.data ? mapSettings(settingsRes.data) : null;

    set({
      userId,
      settings: mappedSettings,
      debtAccounts: (debtRes.data ?? []).map(mapDebt),
      incomeSources: (incomeRes.data ?? []).map(mapIncome),
      fixedExpenses: (expenseRes.data ?? []).map(mapExpense),
      subscriptions: (subsRes.data ?? []).map(mapSubscription),
      spending: (spendingRes.data ?? []).map(mapSpending),
      snapshots: (snapshotsRes.data ?? []).map(mapSnapshot),
      loading: false,
    });

    // Auto-fetch live exchange rate in background
    if (mappedSettings) {
      fetchUSDtoCOP().then(rate => {
        if (rate) {
          const rounded = Math.round(rate);
          set(s => ({ settings: s.settings ? { ...s.settings, exchangeRate: rounded } : s.settings }));
          supabase.from('settings').update({ exchange_rate: rounded }).eq('id', mappedSettings.id);
        }
      });
    }
  },

  // Settings
  updateExchangeRate: async (rate) => {
    const { userId, settings } = get();
    if (!userId || !settings) return;
    await supabase.from('settings').update({ exchange_rate: rate }).eq('id', settings.id);
    set({ settings: { ...settings, exchangeRate: rate } });
  },
  refreshExchangeRate: async () => {
    const { settings } = get();
    if (!settings) return;
    const rate = await fetchUSDtoCOP();
    if (rate) {
      const rounded = Math.round(rate);
      set({ settings: { ...settings, exchangeRate: rounded } });
      await supabase.from('settings').update({ exchange_rate: rounded }).eq('id', settings.id);
    }
  },

  // Debt accounts
  addDebtAccount: async (account) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('debt_accounts').insert({
      user_id: userId, name: account.name, currency: account.currency,
      current_balance: account.currentBalance, minimum_monthly_payment: account.minimumMonthlyPayment,
      color: account.color,
    }).select().single();
    if (data) set(s => ({ debtAccounts: [...s.debtAccounts, mapDebt(data)] }));
  },
  updateDebtAccount: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
    if (updates.minimumMonthlyPayment !== undefined) dbUpdates.minimum_monthly_payment = updates.minimumMonthlyPayment;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    await supabase.from('debt_accounts').update(dbUpdates).eq('id', id);
    set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === id ? { ...a, ...updates } : a) }));
  },
  deleteDebtAccount: async (id) => {
    await supabase.from('debt_accounts').delete().eq('id', id);
    set(s => ({ debtAccounts: s.debtAccounts.filter(a => a.id !== id) }));
  },

  // Income sources
  addIncomeSource: async (source) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('income_sources').insert({
      user_id: userId, name: source.name, amount: source.amount, is_recurring: source.isRecurring,
    }).select().single();
    if (data) set(s => ({ incomeSources: [...s.incomeSources, mapIncome(data)] }));
  },
  updateIncomeSource: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
    await supabase.from('income_sources').update(dbUpdates).eq('id', id);
    set(s => ({ incomeSources: s.incomeSources.map(i => i.id === id ? { ...i, ...updates } : i) }));
  },
  deleteIncomeSource: async (id) => {
    await supabase.from('income_sources').delete().eq('id', id);
    set(s => ({ incomeSources: s.incomeSources.filter(i => i.id !== id) }));
  },

  // Fixed expenses
  addFixedExpense: async (expense) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('fixed_expenses').insert({
      user_id: userId, name: expense.name, amount: expense.amount, category: expense.category,
    }).select().single();
    if (data) set(s => ({ fixedExpenses: [...s.fixedExpenses, mapExpense(data)] }));
  },
  updateFixedExpense: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    await supabase.from('fixed_expenses').update(dbUpdates).eq('id', id);
    set(s => ({ fixedExpenses: s.fixedExpenses.map(e => e.id === id ? { ...e, ...updates } : e) }));
  },
  deleteFixedExpense: async (id) => {
    await supabase.from('fixed_expenses').delete().eq('id', id);
    set(s => ({ fixedExpenses: s.fixedExpenses.filter(e => e.id !== id) }));
  },

  // Subscriptions
  addSubscription: async (sub) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('subscriptions').insert({
      user_id: userId, name: sub.name, currency: sub.currency, amount: sub.amount, active: sub.active,
    }).select().single();
    if (data) set(s => ({ subscriptions: [...s.subscriptions, mapSubscription(data)] }));
  },
  updateSubscription: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    await supabase.from('subscriptions').update(dbUpdates).eq('id', id);
    set(s => ({ subscriptions: s.subscriptions.map(sub => sub.id === id ? { ...sub, ...updates } : sub) }));
  },
  deleteSubscription: async (id) => {
    await supabase.from('subscriptions').delete().eq('id', id);
    set(s => ({ subscriptions: s.subscriptions.filter(sub => sub.id !== id) }));
  },

  // Spending
  addSpending: async (entry) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('spending').insert({
      user_id: userId, date: entry.date, description: entry.description, amount: entry.amount,
      category: entry.category, payment_method: entry.paymentMethod,
    }).select().single();
    if (data) set(s => ({ spending: [mapSpending(data), ...s.spending] }));
  },
  deleteSpending: async (id) => {
    await supabase.from('spending').delete().eq('id', id);
    set(s => ({ spending: s.spending.filter(e => e.id !== id) }));
  },

  // Snapshots
  saveSnapshot: async (snapshot) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('monthly_snapshots').insert({
      user_id: userId, month: snapshot.month, debt_balances: snapshot.debtBalances,
      income_entries: snapshot.incomeEntries, side_income: snapshot.sideIncome,
      total_income: snapshot.totalIncome, total_expenses: snapshot.totalExpenses,
      total_debt_paid: snapshot.totalDebtPaid, new_charges: snapshot.newCharges,
      balance: snapshot.balance, cash_on_hand: snapshot.cashOnHand, savings: snapshot.savings,
    }).select().single();
    if (data) set(s => ({ snapshots: [mapSnapshot(data), ...s.snapshots] }));
  },
}));
