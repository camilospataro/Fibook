import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { fetchUSDtoCOP } from '@/lib/exchangeRate';
import type { DebtAccount, CheckingAccount, IncomeSource, FixedExpense, Subscription, SpendingEntry, MonthlySnapshot, Settings } from '@/types';

interface DataSnapshot {
  debtAccounts: DebtAccount[];
  checkingAccounts: CheckingAccount[];
  incomeSources: IncomeSource[];
  fixedExpenses: FixedExpense[];
  subscriptions: Subscription[];
  spending: SpendingEntry[];
  snapshots: MonthlySnapshot[];
  settings: Settings | null;
}

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
  _undoStack: DataSnapshot[];
  _redoStack: DataSnapshot[];
  _isUndoRedo: boolean;

  setUserId: (id: string | null) => void;
  fetchAll: (userId: string) => Promise<void>;

  // Settings
  updateExchangeRate: (rate: number) => Promise<void>;
  refreshExchangeRate: () => Promise<void>;
  updateSavingsTarget: (amount: number) => Promise<void>;
  updateSavingsAccounts: (sourceId: string | null, destId: string | null, day?: number) => Promise<void>;
  executeSavingsTransfer: () => Promise<void>;

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

  // Scheduled payments
  processScheduledPayments: () => Promise<void>;

  // Undo/Redo
  _pushUndo: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

function mapSettings(row: Record<string, unknown>): Settings {
  return { id: row.id as string, userId: row.user_id as string, exchangeRate: row.exchange_rate as number, exchangeRateUpdatedAt: (row.exchange_rate_updated_at as string) ?? null, savingsTarget: (row.savings_target as number) ?? 0, savingsSourceAccountId: (row.savings_source_account_id as string) ?? null, savingsDestAccountId: (row.savings_dest_account_id as string) ?? null, savingsTransferDay: (row.savings_transfer_day as number) ?? 1 };
}

function mapDebt(row: Record<string, unknown>): DebtAccount {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    currency: row.currency as 'COP' | 'USD', currentBalance: row.current_balance as number,
    minimumMonthlyPayment: row.minimum_monthly_payment as number,
    monthlyPayment: typeof row.monthly_payment === 'number' ? row.monthly_payment : 0,
    color: row.color as string,
    linkedAccountId: (row.linked_account_id as string) ?? null,
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
    linkedAccountId: (row.linked_account_id as string) ?? null,
    depositDay: (row.deposit_day as number) ?? 1,
  };
}

function mapExpense(row: Record<string, unknown>): FixedExpense {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    amount: row.amount as number, currency: (row.currency as 'COP' | 'USD') ?? 'COP',
    category: row.category as FixedExpense['category'],
    linkedAccountId: (row.linked_account_id as string) ?? null,
    paymentDay: (row.payment_day as number) ?? 1,
    paymentMode: (row.payment_mode as 'auto' | 'manual') ?? 'manual',
  };
}

function mapSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string, userId: row.user_id as string, name: row.name as string,
    currency: row.currency as 'COP' | 'USD', amount: row.amount as number,
    group: (row.group as string) ?? 'General', active: row.active as boolean,
    linkedAccountId: (row.linked_account_id as string) ?? null,
    paymentDay: (row.payment_day as number) ?? 1,
    billingCycle: (row.billing_cycle as 'monthly' | 'annual') ?? 'monthly',
    renewalMonth: (row.renewal_month as number | null) ?? null,
  };
}

function mapSpending(row: Record<string, unknown>): SpendingEntry {
  return {
    id: row.id as string, userId: row.user_id as string, date: row.date as string,
    description: row.description as string, amount: row.amount as number,
    category: row.category as SpendingEntry['category'],
    paymentMethod: row.payment_method as SpendingEntry['paymentMethod'],
    linkedAccountId: (row.linked_account_id as string) ?? null,
    linkedBudgetId: (row.linked_budget_id as string) ?? null,
    tags: (row.tags as string[]) ?? [],
  };
}

function mapSnapshot(row: Record<string, unknown>): MonthlySnapshot {
  return {
    id: row.id as string, userId: row.user_id as string, month: row.month as string,
    debtBalances: row.debt_balances as MonthlySnapshot['debtBalances'],
    checkingBalances: (row.checking_balances as MonthlySnapshot['checkingBalances']) ?? [],
    incomeEntries: row.income_entries as MonthlySnapshot['incomeEntries'],
    sideIncome: row.side_income as number, totalIncome: row.total_income as number,
    totalExpenses: row.total_expenses as number, totalDebtPaid: row.total_debt_paid as number,
    newCharges: row.new_charges as number, balance: row.balance as number,
    cashOnHand: row.cash_on_hand as number, savings: row.savings as number,
  };
}

// --- Reverse mappers (TS → DB row) for undo/redo sync ---
function debtToDb(a: DebtAccount) {
  return { id: a.id, user_id: a.userId, name: a.name, currency: a.currency, current_balance: a.currentBalance, minimum_monthly_payment: a.minimumMonthlyPayment, monthly_payment: a.monthlyPayment, color: a.color, linked_account_id: a.linkedAccountId };
}
function checkingToDb(a: CheckingAccount) {
  return { id: a.id, user_id: a.userId, name: a.name, currency: a.currency, current_balance: a.currentBalance, color: a.color };
}
function incomeToDb(s: IncomeSource) {
  return { id: s.id, user_id: s.userId, name: s.name, amount: s.amount, currency: s.currency, is_recurring: s.isRecurring, linked_account_id: s.linkedAccountId, deposit_day: s.depositDay };
}
function expenseToDb(e: FixedExpense) {
  return { id: e.id, user_id: e.userId, name: e.name, amount: e.amount, currency: e.currency, category: e.category, linked_account_id: e.linkedAccountId, payment_day: e.paymentDay, payment_mode: e.paymentMode };
}
function subToDb(s: Subscription) {
  return { id: s.id, user_id: s.userId, name: s.name, currency: s.currency, amount: s.amount, group: s.group, active: s.active, linked_account_id: s.linkedAccountId, payment_day: s.paymentDay, billing_cycle: s.billingCycle, renewal_month: s.renewalMonth };
}
function spendingToDb(e: SpendingEntry) {
  return { id: e.id, user_id: e.userId, date: e.date, description: e.description, amount: e.amount, category: e.category, payment_method: e.paymentMethod, linked_account_id: e.linkedAccountId, linked_budget_id: e.linkedBudgetId, tags: e.tags };
}
function snapshotToDb(s: MonthlySnapshot) {
  return { id: s.id, user_id: s.userId, month: s.month, debt_balances: s.debtBalances, checking_balances: s.checkingBalances, income_entries: s.incomeEntries, side_income: s.sideIncome, total_income: s.totalIncome, total_expenses: s.totalExpenses, total_debt_paid: s.totalDebtPaid, new_charges: s.newCharges, balance: s.balance, cash_on_hand: s.cashOnHand, savings: s.savings };
}

async function syncArrayDiffs<T extends { id: string }>(
  table: string, current: T[], target: T[], toDb: (item: T) => Record<string, unknown>
) {
  if (JSON.stringify(current) === JSON.stringify(target)) return;
  const currentMap = new Map(current.map(i => [i.id, i]));
  const targetMap = new Map(target.map(i => [i.id, i]));
  const removedIds = current.filter(i => !targetMap.has(i.id)).map(i => i.id);
  if (removedIds.length > 0) await supabase.from(table).delete().in('id', removedIds);
  const upserts: Record<string, unknown>[] = [];
  for (const [id, item] of targetMap) {
    const curr = currentMap.get(id);
    if (!curr || JSON.stringify(curr) !== JSON.stringify(item)) upserts.push(toDb(item));
  }
  if (upserts.length > 0) await supabase.from(table).upsert(upserts);
}

async function syncSettingsDiff(current: Settings | null, target: Settings | null) {
  if (!target || JSON.stringify(current) === JSON.stringify(target)) return;
  const row = { exchange_rate: target.exchangeRate, exchange_rate_updated_at: target.exchangeRateUpdatedAt, savings_target: target.savingsTarget, savings_source_account_id: target.savingsSourceAccountId, savings_dest_account_id: target.savingsDestAccountId, savings_transfer_day: target.savingsTransferDay };
  await supabase.from('settings').update(row).eq('id', target.id);
}

function captureSnapshot(s: FinanceState): DataSnapshot {
  return {
    debtAccounts: structuredClone(s.debtAccounts),
    checkingAccounts: structuredClone(s.checkingAccounts),
    incomeSources: structuredClone(s.incomeSources),
    fixedExpenses: structuredClone(s.fixedExpenses),
    subscriptions: structuredClone(s.subscriptions),
    spending: structuredClone(s.spending),
    snapshots: structuredClone(s.snapshots),
    settings: s.settings ? structuredClone(s.settings) : null,
  };
}

async function syncAllDiffs(current: DataSnapshot, target: DataSnapshot) {
  try {
    await Promise.all([
      syncArrayDiffs('debt_accounts', current.debtAccounts, target.debtAccounts, debtToDb),
      syncArrayDiffs('savings_accounts', current.checkingAccounts, target.checkingAccounts, checkingToDb),
      syncArrayDiffs('income_sources', current.incomeSources, target.incomeSources, incomeToDb),
      syncArrayDiffs('fixed_expenses', current.fixedExpenses, target.fixedExpenses, expenseToDb),
      syncArrayDiffs('subscriptions', current.subscriptions, target.subscriptions, subToDb),
      syncArrayDiffs('spending', current.spending, target.spending, spendingToDb),
      syncArrayDiffs('monthly_snapshots', current.snapshots, target.snapshots, snapshotToDb),
      syncSettingsDiff(current.settings, target.settings),
    ]);
  } catch (e) {
    console.error('Undo/redo sync error:', e);
  }
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
  _undoStack: [],
  _redoStack: [],
  _isUndoRedo: false,

  setUserId: (id) => set({ userId: id }),

  _pushUndo: () => {
    if (get()._isUndoRedo) return;
    const snapshot = captureSnapshot(get());
    set(s => ({
      _undoStack: [...s._undoStack.slice(-29), snapshot],
      _redoStack: [],
    }));
  },

  undo: async () => {
    const { _undoStack } = get();
    if (_undoStack.length === 0) return;
    const prev = _undoStack[_undoStack.length - 1];
    const current = captureSnapshot(get());
    set(s => ({
      _isUndoRedo: true,
      _undoStack: s._undoStack.slice(0, -1),
      _redoStack: [...s._redoStack, current],
      debtAccounts: prev.debtAccounts,
      checkingAccounts: prev.checkingAccounts,
      incomeSources: prev.incomeSources,
      fixedExpenses: prev.fixedExpenses,
      subscriptions: prev.subscriptions,
      spending: prev.spending,
      snapshots: prev.snapshots,
      settings: prev.settings,
    }));
    await syncAllDiffs(current, prev);
    set({ _isUndoRedo: false });
  },

  redo: async () => {
    const { _redoStack } = get();
    if (_redoStack.length === 0) return;
    const next = _redoStack[_redoStack.length - 1];
    const current = captureSnapshot(get());
    set(s => ({
      _isUndoRedo: true,
      _redoStack: s._redoStack.slice(0, -1),
      _undoStack: [...s._undoStack, current],
      debtAccounts: next.debtAccounts,
      checkingAccounts: next.checkingAccounts,
      incomeSources: next.incomeSources,
      fixedExpenses: next.fixedExpenses,
      subscriptions: next.subscriptions,
      spending: next.spending,
      snapshots: next.snapshots,
      settings: next.settings,
    }));
    await syncAllDiffs(current, next);
    set({ _isUndoRedo: false });
  },

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
    get()._pushUndo();
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
    get()._pushUndo();
    const { userId, settings } = get();
    if (!userId || !settings) return;
    await supabase.from('settings').update({ savings_target: amount }).eq('user_id', userId);
    set({ settings: { ...settings, savingsTarget: amount } });
  },
  updateSavingsAccounts: async (sourceId, destId, day) => {
    get()._pushUndo();
    const { userId, settings } = get();
    if (!userId || !settings) return;
    const updates: Record<string, unknown> = { savings_source_account_id: sourceId, savings_dest_account_id: destId };
    if (day !== undefined) updates.savings_transfer_day = day;
    await supabase.from('settings').update(updates).eq('user_id', userId);
    set({ settings: { ...settings, savingsSourceAccountId: sourceId, savingsDestAccountId: destId, savingsTransferDay: day ?? settings.savingsTransferDay } });
  },
  executeSavingsTransfer: async () => {
    get()._pushUndo();
    const { settings, checkingAccounts } = get();
    if (!settings || !settings.savingsSourceAccountId || !settings.savingsDestAccountId || settings.savingsTarget <= 0) return;
    const source = checkingAccounts.find(a => a.id === settings.savingsSourceAccountId);
    const dest = checkingAccounts.find(a => a.id === settings.savingsDestAccountId);
    if (!source || !dest) return;
    // Convert amount if currencies differ
    const exchangeRate = settings.exchangeRate;
    const amountInSourceCurrency = source.currency === 'COP' ? settings.savingsTarget
      : settings.savingsTarget / exchangeRate; // savingsTarget is in COP
    const amountInDestCurrency = dest.currency === 'COP' ? settings.savingsTarget
      : settings.savingsTarget / exchangeRate;
    const newSourceBalance = source.currentBalance - amountInSourceCurrency;
    const newDestBalance = dest.currentBalance + amountInDestCurrency;
    await supabase.from('savings_accounts').update({ current_balance: newSourceBalance }).eq('id', source.id);
    await supabase.from('savings_accounts').update({ current_balance: newDestBalance }).eq('id', dest.id);
    set(s => ({
      checkingAccounts: s.checkingAccounts.map(a =>
        a.id === source.id ? { ...a, currentBalance: newSourceBalance }
        : a.id === dest.id ? { ...a, currentBalance: newDestBalance }
        : a
      ),
    }));
  },

  // Debt accounts
  addDebtAccount: async (account) => {
    get()._pushUndo();
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('debt_accounts').insert({
      user_id: userId, name: account.name, currency: account.currency,
      current_balance: account.currentBalance, minimum_monthly_payment: account.minimumMonthlyPayment,
      monthly_payment: account.monthlyPayment ?? 0, color: account.color, linked_account_id: account.linkedAccountId ?? null,
    }).select().single();
    if (data) set(s => ({ debtAccounts: [...s.debtAccounts, mapDebt(data)] }));
  },
  updateDebtAccount: async (id, updates) => {
    get()._pushUndo();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
    if (updates.minimumMonthlyPayment !== undefined) dbUpdates.minimum_monthly_payment = updates.minimumMonthlyPayment;
    if (updates.monthlyPayment !== undefined) dbUpdates.monthly_payment = updates.monthlyPayment;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.linkedAccountId !== undefined) dbUpdates.linked_account_id = updates.linkedAccountId;
    await supabase.from('debt_accounts').update(dbUpdates).eq('id', id);
    set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === id ? { ...a, ...updates } : a) }));
  },
  deleteDebtAccount: async (id) => {
    get()._pushUndo();
    await supabase.from('debt_accounts').delete().eq('id', id);
    set(s => ({ debtAccounts: s.debtAccounts.filter(a => a.id !== id) }));
  },

  // Checking accounts
  addCheckingAccount: async (account) => {
    get()._pushUndo();
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('savings_accounts').insert({
      user_id: userId, name: account.name, currency: account.currency,
      current_balance: account.currentBalance, color: account.color,
    }).select().single();
    if (data) set(s => ({ checkingAccounts: [...s.checkingAccounts, mapSavings(data)] }));
  },
  updateCheckingAccount: async (id, updates) => {
    get()._pushUndo();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.currentBalance !== undefined) dbUpdates.current_balance = updates.currentBalance;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    await supabase.from('savings_accounts').update(dbUpdates).eq('id', id);
    set(s => ({ checkingAccounts: s.checkingAccounts.map(a => a.id === id ? { ...a, ...updates } : a) }));
  },
  deleteCheckingAccount: async (id) => {
    get()._pushUndo();
    await supabase.from('savings_accounts').delete().eq('id', id);
    set(s => ({ checkingAccounts: s.checkingAccounts.filter(a => a.id !== id) }));
  },

  // Income sources
  addIncomeSource: async (source) => {
    get()._pushUndo();
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('income_sources').insert({
      user_id: userId, name: source.name, amount: source.amount, currency: source.currency,
      is_recurring: source.isRecurring, linked_account_id: source.linkedAccountId ?? null,
      deposit_day: source.depositDay ?? 1,
    }).select().single();
    if (data) set(s => ({ incomeSources: [...s.incomeSources, mapIncome(data)] }));
  },
  updateIncomeSource: async (id, updates) => {
    get()._pushUndo();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
    if (updates.linkedAccountId !== undefined) dbUpdates.linked_account_id = updates.linkedAccountId;
    if (updates.depositDay !== undefined) dbUpdates.deposit_day = updates.depositDay;
    await supabase.from('income_sources').update(dbUpdates).eq('id', id);
    set(s => ({ incomeSources: s.incomeSources.map(i => i.id === id ? { ...i, ...updates } : i) }));
  },
  deleteIncomeSource: async (id) => {
    get()._pushUndo();
    await supabase.from('income_sources').delete().eq('id', id);
    set(s => ({ incomeSources: s.incomeSources.filter(i => i.id !== id) }));
  },

  // Fixed expenses
  addFixedExpense: async (expense) => {
    get()._pushUndo();
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('fixed_expenses').insert({
      user_id: userId, name: expense.name, amount: expense.amount, currency: expense.currency,
      category: expense.category, linked_account_id: expense.linkedAccountId ?? null, payment_day: expense.paymentDay ?? 1, payment_mode: expense.paymentMode ?? 'manual',
    }).select().single();
    if (data) set(s => ({ fixedExpenses: [...s.fixedExpenses, mapExpense(data)] }));
  },
  updateFixedExpense: async (id, updates) => {
    get()._pushUndo();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.linkedAccountId !== undefined) dbUpdates.linked_account_id = updates.linkedAccountId;
    if (updates.paymentDay !== undefined) dbUpdates.payment_day = updates.paymentDay;
    if (updates.paymentMode !== undefined) dbUpdates.payment_mode = updates.paymentMode;
    await supabase.from('fixed_expenses').update(dbUpdates).eq('id', id);
    set(s => ({ fixedExpenses: s.fixedExpenses.map(e => e.id === id ? { ...e, ...updates } : e) }));
  },
  deleteFixedExpense: async (id) => {
    get()._pushUndo();
    await supabase.from('fixed_expenses').delete().eq('id', id);
    set(s => ({ fixedExpenses: s.fixedExpenses.filter(e => e.id !== id) }));
  },

  // Subscriptions
  addSubscription: async (sub) => {
    get()._pushUndo();
    const { userId } = get();
    if (!userId) return;
    const { data } = await supabase.from('subscriptions').insert({
      user_id: userId, name: sub.name, currency: sub.currency, amount: sub.amount, group: sub.group, active: sub.active, linked_account_id: sub.linkedAccountId ?? null, payment_day: sub.paymentDay ?? 1, billing_cycle: sub.billingCycle ?? 'monthly', renewal_month: sub.renewalMonth ?? null,
    }).select().single();
    if (data) set(s => ({ subscriptions: [...s.subscriptions, mapSubscription(data)] }));
  },
  updateSubscription: async (id, updates) => {
    get()._pushUndo();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.group !== undefined) dbUpdates.group = updates.group;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (updates.linkedAccountId !== undefined) dbUpdates.linked_account_id = updates.linkedAccountId;
    if (updates.paymentDay !== undefined) dbUpdates.payment_day = updates.paymentDay;
    if (updates.billingCycle !== undefined) dbUpdates.billing_cycle = updates.billingCycle;
    if (updates.renewalMonth !== undefined) dbUpdates.renewal_month = updates.renewalMonth;
    const { error } = await supabase.from('subscriptions').update(dbUpdates).eq('id', id);
    if (error) { console.error('updateSubscription error:', error); return; }
    set(s => ({ subscriptions: s.subscriptions.map(sub => sub.id === id ? { ...sub, ...updates } : sub) }));
  },
  deleteSubscription: async (id) => {
    get()._pushUndo();
    await supabase.from('subscriptions').delete().eq('id', id);
    set(s => ({ subscriptions: s.subscriptions.filter(sub => sub.id !== id) }));
  },

  // Spending
  addSpending: async (entry) => {
    get()._pushUndo();
    const { userId } = get();
    if (!userId) return;
    const { data, error } = await supabase.from('spending').insert({
      user_id: userId, date: entry.date, description: entry.description, amount: entry.amount,
      category: entry.category, payment_method: entry.paymentMethod,
      linked_account_id: entry.linkedAccountId ?? null,
      linked_budget_id: entry.linkedBudgetId ?? null,
      tags: entry.tags ?? [],
    }).select().single();
    if (error) { console.error('addSpending error:', error); return; }
    if (data) {
      set(s => ({ spending: [mapSpending(data), ...s.spending] }));
      // Deduct from linked checking account
      const accountId = entry.linkedAccountId;
      if (accountId) {
        const account = get().checkingAccounts.find(a => a.id === accountId);
        if (account) {
          const newBalance = account.currentBalance - entry.amount;
          await supabase.from('savings_accounts').update({ current_balance: newBalance }).eq('id', accountId);
          set(s => ({ checkingAccounts: s.checkingAccounts.map(a => a.id === accountId ? { ...a, currentBalance: newBalance } : a) }));
        }
      }
      // Add to linked debt account (credit card charge)
      if (entry.paymentMethod.startsWith('debt_')) {
        const debtId = entry.paymentMethod.replace('debt_', '');
        const debtAccount = get().debtAccounts.find(a => a.id === debtId);
        if (debtAccount) {
          const newBalance = debtAccount.currentBalance + entry.amount;
          await supabase.from('debt_accounts').update({ current_balance: newBalance }).eq('id', debtId);
          set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === debtId ? { ...a, currentBalance: newBalance } : a) }));
        }
      }
    }
  },
  updateSpending: async (id, updates) => {
    get()._pushUndo();
    const oldEntry = get().spending.find(e => e.id === id);
    const dbUpdates: Record<string, unknown> = {};
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
    if (updates.linkedAccountId !== undefined) dbUpdates.linked_account_id = updates.linkedAccountId;
    if (updates.linkedBudgetId !== undefined) dbUpdates.linked_budget_id = updates.linkedBudgetId;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    await supabase.from('spending').update(dbUpdates).eq('id', id);
    set(s => ({ spending: s.spending.map(e => e.id === id ? { ...e, ...updates } : e) }));

    // Reverse old balance effects and apply new ones when amount or payment method changes
    if (oldEntry && (updates.amount !== undefined || updates.linkedAccountId !== undefined || updates.paymentMethod !== undefined)) {
      const newAmount = updates.amount ?? oldEntry.amount;
      const newLinkedAccount = updates.linkedAccountId !== undefined ? updates.linkedAccountId : oldEntry.linkedAccountId;
      const newPaymentMethod = updates.paymentMethod ?? oldEntry.paymentMethod;

      // Reverse old checking deduction, apply new one
      if (oldEntry.linkedAccountId) {
        const oldAcct = get().checkingAccounts.find(a => a.id === oldEntry.linkedAccountId);
        if (oldAcct) {
          const restored = oldAcct.currentBalance + oldEntry.amount;
          await supabase.from('savings_accounts').update({ current_balance: restored }).eq('id', oldEntry.linkedAccountId);
          set(s => ({ checkingAccounts: s.checkingAccounts.map(a => a.id === oldEntry.linkedAccountId ? { ...a, currentBalance: restored } : a) }));
        }
      }
      if (newLinkedAccount) {
        const newAcct = get().checkingAccounts.find(a => a.id === newLinkedAccount);
        if (newAcct) {
          const deducted = newAcct.currentBalance - newAmount;
          await supabase.from('savings_accounts').update({ current_balance: deducted }).eq('id', newLinkedAccount);
          set(s => ({ checkingAccounts: s.checkingAccounts.map(a => a.id === newLinkedAccount ? { ...a, currentBalance: deducted } : a) }));
        }
      }

      // Reverse old debt charge, apply new one
      if (oldEntry.paymentMethod.startsWith('debt_')) {
        const oldDebtId = oldEntry.paymentMethod.replace('debt_', '');
        const oldDebt = get().debtAccounts.find(a => a.id === oldDebtId);
        if (oldDebt) {
          const reversed = oldDebt.currentBalance - oldEntry.amount;
          await supabase.from('debt_accounts').update({ current_balance: reversed }).eq('id', oldDebtId);
          set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === oldDebtId ? { ...a, currentBalance: reversed } : a) }));
        }
      }
      if (newPaymentMethod.startsWith('debt_')) {
        const newDebtId = newPaymentMethod.replace('debt_', '');
        const newDebt = get().debtAccounts.find(a => a.id === newDebtId);
        if (newDebt) {
          const charged = newDebt.currentBalance + newAmount;
          await supabase.from('debt_accounts').update({ current_balance: charged }).eq('id', newDebtId);
          set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === newDebtId ? { ...a, currentBalance: charged } : a) }));
        }
      }
    }
  },
  deleteSpending: async (id) => {
    get()._pushUndo();
    // Find entry before deleting to reverse balance changes
    const entry = get().spending.find(e => e.id === id);
    await supabase.from('spending').delete().eq('id', id);
    set(s => ({ spending: s.spending.filter(e => e.id !== id) }));
    if (entry) {
      // Reverse checking account deduction
      if (entry.linkedAccountId) {
        const account = get().checkingAccounts.find(a => a.id === entry.linkedAccountId);
        if (account) {
          const newBalance = account.currentBalance + entry.amount;
          await supabase.from('savings_accounts').update({ current_balance: newBalance }).eq('id', entry.linkedAccountId);
          set(s => ({ checkingAccounts: s.checkingAccounts.map(a => a.id === entry.linkedAccountId ? { ...a, currentBalance: newBalance } : a) }));
        }
      }
      // Reverse credit card charge
      if (entry.paymentMethod.startsWith('debt_')) {
        const debtId = entry.paymentMethod.replace('debt_', '');
        const debtAccount = get().debtAccounts.find(a => a.id === debtId);
        if (debtAccount) {
          const newBalance = debtAccount.currentBalance - entry.amount;
          await supabase.from('debt_accounts').update({ current_balance: newBalance }).eq('id', debtId);
          set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === debtId ? { ...a, currentBalance: newBalance } : a) }));
        }
      }
    }
  },

  // Snapshots
  saveSnapshot: async (snapshot) => {
    get()._pushUndo();
    const { userId } = get();
    if (!userId) return;
    const row = {
      user_id: userId, month: snapshot.month, debt_balances: snapshot.debtBalances,
      checking_balances: snapshot.checkingBalances,
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

  // Scheduled payments — process due subscriptions/expenses and charge to linked debt account
  processScheduledPayments: async () => {
    const { userId, fixedExpenses, subscriptions, debtAccounts } = get();
    if (!userId) return;

    const now = new Date();
    const today = now.getDate();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Gather all items that are due (paymentDay <= today) and have a linked debt account
    const items: { sourceType: string; sourceId: string; name: string; amount: number; currency: string; linkedAccountId: string }[] = [];

    for (const exp of fixedExpenses) {
      if (exp.paymentMode === 'auto' && exp.paymentDay <= today && exp.linkedAccountId) {
        const linkedAccount = debtAccounts.find(a => a.id === exp.linkedAccountId);
        if (linkedAccount) {
          items.push({ sourceType: 'expense', sourceId: exp.id, name: exp.name, amount: exp.amount, currency: exp.currency, linkedAccountId: exp.linkedAccountId });
        }
      }
    }
    const currentMonthNum = now.getMonth() + 1; // 1-12
    for (const sub of subscriptions) {
      if (!sub.active || !sub.linkedAccountId || sub.paymentDay > today) continue;
      // Annual subs only charge in their renewal month
      if (sub.billingCycle === 'annual' && sub.renewalMonth !== currentMonthNum) continue;
      const linkedAccount = debtAccounts.find(a => a.id === sub.linkedAccountId);
      if (linkedAccount) {
        items.push({ sourceType: 'subscription', sourceId: sub.id, name: sub.name, amount: sub.amount, currency: sub.currency, linkedAccountId: sub.linkedAccountId });
      }
    }

    if (items.length === 0) return;

    // Check which ones have already been processed this month
    const { data: processed } = await supabase
      .from('processed_payments')
      .select('source_id')
      .eq('month', currentMonth);
    const processedIds = new Set((processed ?? []).map(p => (p as { source_id: string }).source_id));

    // Process unprocessed items
    for (const item of items) {
      if (processedIds.has(item.sourceId)) continue;

      // Use get() for fresh state in case previous iteration updated the same account
      const debtAccount = get().debtAccounts.find(a => a.id === item.linkedAccountId);
      if (!debtAccount) continue;

      // Convert amount if currencies differ
      const exchangeRate = get().settings?.exchangeRate ?? 4000;
      let chargeAmount = item.amount;
      if (item.currency !== debtAccount.currency) {
        chargeAmount = item.currency === 'USD' ? item.amount * exchangeRate : item.amount / exchangeRate;
      }
      chargeAmount = Math.round(chargeAmount);

      // Add to debt balance
      const newBalance = debtAccount.currentBalance + chargeAmount;
      await supabase.from('debt_accounts').update({ current_balance: newBalance }).eq('id', debtAccount.id);
      set(s => ({ debtAccounts: s.debtAccounts.map(a => a.id === debtAccount.id ? { ...a, currentBalance: newBalance } : a) }));

      // Create a spending entry for this auto-charge
      const spendingDate = `${currentMonth}-${String(Math.min(today, 28)).padStart(2, '0')}`;
      const { data: spendingData } = await supabase.from('spending').insert({
        user_id: userId, date: spendingDate,
        description: `${item.name} (auto)`,
        amount: chargeAmount,
        category: item.sourceType === 'subscription' ? 'other' : 'other',
        payment_method: `debt_${debtAccount.id}`,
        linked_account_id: null,
        linked_budget_id: null,
        tags: [item.sourceType === 'subscription' ? 'subscription' : 'fixed-expense', 'auto-charge'],
      }).select().single();
      if (spendingData) {
        set(s => ({ spending: [mapSpending(spendingData), ...s.spending] }));
      }

      // Record as processed
      await supabase.from('processed_payments').insert({
        user_id: userId, source_type: item.sourceType, source_id: item.sourceId, month: currentMonth,
      });
    }
  },
}));
