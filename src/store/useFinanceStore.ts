import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { fetchUSDtoCOP } from '@/lib/exchangeRate';
import type { DebtAccount, CheckingAccount, IncomeSource, FixedExpense, Subscription, SpendingEntry, MonthlySnapshot, Settings } from '@/types';

interface FinanceState {
  userId: string | null;
  settings: Settings | null;
  debtAccounts: DebtAccount[];
  checkingAccounts: CheckingAccount[];
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
  updateSavingsTarget: (amount: number) => Promise<void>;

  // Debt accounts
  addDebtAccount: (account: Omit<DebtAccount, 'id' | 'userId'>) => Promise<void>;
  updateDebtAccount: (id: string, updates: Partial<DebtAccount>) => Promise<void>;
  deleteDebtAccount: (id: string) => Promise<void>;

  // Checking accounts
  addCheckingAccount: (account: Omit<CheckingAccount, 'id' | 'userId'>) => Promise<void>;
  updateCheckingAccount: (id: string, updates: Partial<CheckingAccount>) => Promise<void>;
  deleteCheckingAccount: (id: string) => Promise<void>;

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
  updateSpending: (id: string, updates: Partial<SpendingEntry>) => Promise<void>;
  deleteSpending: (id: string) => Promise<void>;

  // Snapshots
  saveSnapshot: (snapshot: Omit<MonthlySnapshot, 'id' | 'userId'>) => Promise<void>;
}

function mapSettings(row: Record<string, unknown>): Settings {
  return { id: row.id as string, userId: row.user_id as string, exchangeRate: row.exchange_rate as number, exchangeRateUpdatedAt: (row.exchange_rate_updated_at as string) ?? null, savingsTarget: (row.savings_target as number) ?? 0 };
}

function mapDebt(row: Record<string, unknown>): DebtAccount {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    currency: row.currency as 'COP' | 'USD', currentBalance: row.current_balance as number,
    minimumMonthlyPayment: row.minimum_monthly_payment as number,
    monthlyPayment: typeof row.monthly_payment === 'number' ? row.monthly_payment : 0,
    color: row.color as string,
  };
}

function mapSavings(row: Record<string, unknown>): CheckingAccount {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    currency: row.currency as 'COP' | 'USD', currentBalance: row.current_balance as number,
    color: row.color as string,
  };
}

function mapIncome(row: Record<string, unknown>): IncomeSource {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    amount: row.amount as number, currency: (row.currency as 'COP' | 'USD') ?? 'COP',
    isRecurring: row.is_recurring as boolean,
  };
}

function mapExpense(row: Record<string, unknown>): FixedExpense {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    amount: row.amount as number, currency: (row.currency as 'COP' | 'USD') ?? 'COP',
    category: row.category as FixedExpense['category'],
  };
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    currency: row.currency as 'COP' | 'USD', amount: row.amount as number,
    group: (row.group as string) ?? 'General', active: row.active as boolean,
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
  checkingAccounts: [],
  incomeSources: [],
  fixedExpenses: [],
  subscriptions: [],
  spending: [],
  snapshots: [],
  loading: false,

  setUserId: (id) => set({ userId: id }),

  fetchAll: async (userId) => {
    set({ loading: true });
    const [settingsRes, debtRes, savingsRes, incomeRes, expenseRes, subsRes, spendingRes, snapshotsRes] = await Promise.all([
      supabase.from('settings').select('*').eq('user_id', userId).single(),
      supabase.from('debt_accounts').select('*').eq('user_id', userId),
      supabase.from('savings_accounts').select('*').eq('user_id', userId),
      supabase.from('income_sources').select('*').eq('user_id', userId),
      supabase.from('fixed_expenses').select('*').eq('user_id', userId),
      supabase.from('subscriptions').select('*').eq('user_id', userId),
      supabase.from('spending').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('monthly_snapshots').select('*').eq('user_id', userId).order('month', { ascending: false }),
    ]);

    let mappedSettings = settingsRes.data ? mapSettings(settingsRes.data) : null;

    // Auto-create settings row if missing
    if (!mappedSettings) {
      const { data: newSettings } = await supabase.from('settings').insert({ user_id: userId, exchange_rate: 4000 }).select().single();
      if (newSettings) mappedSettings = mapSettings(newSettings);
    }

    set({
      userId,
      settings: mappedSettings,
      debtAccounts: (debtRes.data ?? []).map(mapDebt),
      checkingAccounts: (savingsRes.data ?? []).map(mapSavings),
      incomeSources: (incomeRes.data ?? []).map(mapIncome),
      fixedExpenses: (expenseRes.data ?? []).map(mapExpense),
      subscriptions: (subsRes.data ?? []).map(mapSubscription),
      spending: (spendingRes.data ?? []).map(mapSpending),
      snapshots: (snapshotsRes.data ?? []).map(mapSnapshot),
      loading: false,
    });
  },

  // Settings
  updateExchangeRate: async (rate) => {
    const { userId, settings } = get();
    if (!userId || !settings) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('settings').update({ exchange_rate: rate, exchange_rate_updated_at: now }).eq('user_id', userId);
    if (error) {
      console.error('Failed to update exchange rate:', error);
      // Retry without the timestamp column in case it doesn't exist
      await supabase.from('settings').update({ exchange_rate: rate }).eq('user_id', userId);
    }
    set({ settings: { ...settings, exchangeRate: rate, exchangeRateUpdatedAt: now } });
  },
  refreshExchangeRate: async () => {
    const { userId, settings } = get();
    if (!userId || !settings) return;
    const rate = await fetchUSDtoCOP();
    if (rate) {
      const rounded = Math.round(rate);
      const now = new Date().toISOString();
      const { error } = await supabase.from('settings').update({ exchange_rate: rounded, exchange_rate_updated_at: now }).eq('user_id', userId);
      if (error) {
        console.error('Failed to update exchange rate:', error);
        await supabase.from('settings').update({ exchange_rate: rounded }).eq('user_id', userId);
      }
      set({ settings: { ...settings, exchangeRate: rounded, exchangeRateUpdatedAt: now } });
    }
  },
  updateSavingsTarget: async (amount) => {
    const { userId, settings } = get();
    if (!userId || !settings) return;
    await supabase.from('settings').update({ savings_target: amount }).eq('user_id', userId);
    set({ settings: { ...settings, savingsTarget: amount } });
  },

  // Debt accounts
  addDebtAccount: async (account) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('debt_accounts').insert({
      user_id: userId, name: account.name, currency: account.currency,
      current_balance: account.currentBalance, minimum_monthly_payment: account.minimumMonthlyPayment,
      monthly_payment: 0, color: account.color,
    }).select().single();
    if (data) set(s => ({ debtAccounts: [...s.debtAccounts, mapDebt(data)] }));
  },
  updateDebtAccount: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
    if (updates.minimumMonthlyPayment !== undefined) dbUpdates.minimum_monthly_payment = updates.minimumMonthlyPayment;
    if (updates.monthlyPayment !== undefined) dbUpdates.monthly_payment = updates.monthlyPayment;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    await supabase.from('debt_accounts').update(dbUpdates).eq('id', id);
    set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === id ? { ...a, ...updates } : a) }));
  },
  deleteDebtAccount: async (id) => {
    await supabase.from('debt_accounts').delete().eq('id', id);
    set(s => ({ debtAccounts: s.debtAccounts.filter(a => a.id !== id) }));
  },

  // Checking accounts
  addCheckingAccount: async (account) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('savings_accounts').insert({
      user_id: userId, name: account.name, currency: account.currency,
      current_balance: account.currentBalance, color: account.color,
    }).select().single();
    if (data) set(s => ({ checkingAccounts: [...s.checkingAccounts, mapSavings(data)] }));
  },
  updateCheckingAccount: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    await supabase.from('savings_accounts').update(dbUpdates).eq('id', id);
    set(s => ({ checkingAccounts: s.checkingAccounts.map(a => a.id === id ? { ...a, ...updates } : a) }));
  },
  deleteCheckingAccount: async (id) => {
    await supabase.from('savings_accounts').delete().eq('id', id);
    set(s => ({ checkingAccounts: s.checkingAccounts.filter(a => a.id !== id) }));
  },

  // Income sources
  addIncomeSource: async (source) => {
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('income_sources').insert({
      user_id: userId, name: source.name, amount: source.amount, currency: source.currency,
      is_recurring: source.isRecurring,
    }).select().single();
    if (data) set(s => ({ incomeSources: [...s.incomeSources, mapIncome(data)] }));
  },
  updateIncomeSource: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
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
      user_id: userId, name: expense.name, amount: expense.amount, currency: expense.currency,
      category: expense.category,
    }).select().single();
    if (data) set(s => ({ fixedExpenses: [...s.fixedExpenses, mapExpense(data)] }));
  },
  updateFixedExpense: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
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
      user_id: userId, name: sub.name, currency: sub.currency, amount: sub.amount, group: sub.group, active: sub.active,
    }).select().single();
    if (data) set(s => ({ subscriptions: [...s.subscriptions, mapSubscription(data)] }));
  },
  updateSubscription: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.group !== undefined) dbUpdates.group = updates.group;
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
    if (data) {
      set(s => ({ spending: [mapSpending(data), ...s.spending] }));
      // Deduct from checking account if payment method is checking_<id>
      if (entry.paymentMethod.startsWith('checking_')) {
        const accountId = entry.paymentMethod.replace('checking_', '');
        const account = get().checkingAccounts.find(a => a.id === accountId);
        if (account) {
          const newBalance = account.currentBalance - entry.amount;
          const dbUpdates = { current_balance: newBalance };
          await supabase.from('savings_accounts').update(dbUpdates).eq('id', accountId);
          set(s => ({ checkingAccounts: s.checkingAccounts.map(a => a.id === accountId ? { ...a, currentBalance: newBalance } : a) }));
        }
      }
    }
  },
  updateSpending: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
    await supabase.from('spending').update(dbUpdates).eq('id', id);
    set(s => ({ spending: s.spending.map(e => e.id === id ? { ...e, ...updates } : e) }));
  },
  deleteSpending: async (id) => {
    await supabase.from('spending').delete().eq('id', id);
    set(s => ({ spending: s.spending.filter(e => e.id !== id) }));
  },

  // Snapshots
  saveSnapshot: async (snapshot) => {
    const { userId } = get();
    if (!userId) return;
    const row = {
      user_id: userId, month: snapshot.month, debt_balances: snapshot.debtBalances,
      income_entries: snapshot.incomeEntries, side_income: snapshot.sideIncome,
      total_income: snapshot.totalIncome, total_expenses: snapshot.totalExpenses,
      total_debt_paid: snapshot.totalDebtPaid, new_charges: snapshot.newCharges,
      balance: snapshot.balance, cash_on_hand: snapshot.cashOnHand, savings: snapshot.savings,
    };
    const { data } = await supabase.from('monthly_snapshots').upsert(row, { onConflict: 'user_id,month' }).select().single();
    if (data) {
      const mapped = mapSnapshot(data);
      set(s => ({
        snapshots: s.snapshots.some(sn => sn.month === mapped.month)
          ? s.snapshots.map(sn => sn.month === mapped.month ? mapped : sn)
          : [mapped, ...s.snapshots],
      }));
    }
  },
}));
