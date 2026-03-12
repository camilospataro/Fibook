import { useMemo } from 'react';
import type { CheckingAccount, SpendingEntry } from '@/types';
import type { SimRule, SimEvent, AccountState, ChartPoint } from '@/types/simulation';

const SPREAD_DAYS = [1, 8, 15, 22, 29];

interface SimulationInput {
  rules: SimRule[];
  checkingAccounts: CheckingAccount[];
  spending: SpendingEntry[];
  startMonth: string; // "2026-03"
  monthCount: number; // 1-6
  exchangeRate: number;
}

interface SimulationOutput {
  events: SimEvent[];
  accountStates: AccountState[];
  chartData: ChartPoint[];
  monthBoundaries: number[]; // dayIndex values where each month starts
}

function toAccountCurrency(amount: number, from: 'COP' | 'USD', to: 'COP' | 'USD', rate: number) {
  if (from === to) return amount;
  return from === 'USD' ? amount * rate : amount / rate;
}

function offsetMonth(base: string, offset: number): string {
  const [y, m] = base.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function formatMonthShort(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export function useSimulation(input: SimulationInput): SimulationOutput {
  return useMemo(() => {
    const { rules, checkingAccounts, spending, startMonth, monthCount, exchangeRate } = input;
    const accountMap = new Map(checkingAccounts.map(a => [a.id, a]));

    const allEvents: SimEvent[] = [];
    const balances = new Map<string, number>();
    const chartData: ChartPoint[] = [];
    const monthBoundaries: number[] = [];
    const monthlyEndBalances = new Map<string, number[]>();

    // Initialize balances
    for (const acc of checkingAccounts) {
      balances.set(acc.id, acc.currentBalance);
      monthlyEndBalances.set(acc.id, []);
    }

    let globalDayIndex = 0;

    // Push starting point
    const startPoint: ChartPoint = { dayIndex: 0, dayLabel: 'Start' };
    for (const acc of checkingAccounts) {
      startPoint[acc.id] = acc.currentBalance;
    }
    chartData.push(startPoint);
    globalDayIndex++;

    for (let mi = 0; mi < monthCount; mi++) {
      const month = offsetMonth(startMonth, mi);
      const days = daysInMonth(month);
      const monthShort = formatMonthShort(month);

      monthBoundaries.push(globalDayIndex);

      // Build events for this month
      const monthEvents: SimEvent[] = [];

      // Get the actual month number (1-12) for this simulation month
      const simMonthNum = parseInt(month.split('-')[1], 10);

      for (const rule of rules) {
        if (!rule.enabled || !rule.accountId) continue;
        // Skip annual subs in non-renewal months
        if (rule.billingCycle === 'annual' && rule.renewalMonth != null && rule.renewalMonth !== simMonthNum) continue;
        const acc = accountMap.get(rule.accountId);
        if (!acc) continue;

        if (rule.spread) {
          const perChunk = Math.round((rule.amount / SPREAD_DAYS.length) * 100) / 100;
          for (const sd of SPREAD_DAYS) {
            if (sd > days) continue;
            monthEvents.push({
              monthIndex: mi,
              monthLabel: month,
              day: sd,
              type: rule.sourceType,
              label: `${rule.name} (spread)`,
              amount: perChunk,
              currency: rule.currency,
              accountId: rule.accountId,
              accountName: acc.name,
              direction: rule.direction,
            });
          }
        } else {
          const effectiveDay = Math.min(rule.day, days);
          monthEvents.push({
            monthIndex: mi,
            monthLabel: month,
            day: effectiveDay,
            type: rule.sourceType,
            label: rule.name,
            amount: rule.amount,
            currency: rule.currency,
            accountId: rule.accountId,
            accountName: acc.name,
            direction: rule.direction,
          });
        }
      }

      // Real spending only for month 0
      if (mi === 0) {
        const monthSpending = spending.filter(e =>
          e.date.startsWith(startMonth) && e.paymentMethod.startsWith('checking_')
        );
        for (const entry of monthSpending) {
          const accId = entry.paymentMethod.replace('checking_', '');
          const acc = accountMap.get(accId);
          if (!acc) continue;
          const day = parseInt(entry.date.split('-')[2], 10);
          monthEvents.push({
            monthIndex: 0,
            monthLabel: startMonth,
            day,
            type: 'spending',
            label: entry.description,
            amount: entry.amount,
            currency: 'COP',
            accountId: accId,
            accountName: acc.name,
            direction: 'out',
          });
        }
      }

      monthEvents.sort((a, b) => a.day - b.day || (a.direction === 'in' ? -1 : 1));
      allEvents.push(...monthEvents);

      // Group events by day for balance tracking
      const eventsByDay = new Map<number, SimEvent[]>();
      for (const evt of monthEvents) {
        if (!eventsByDay.has(evt.day)) eventsByDay.set(evt.day, []);
        eventsByDay.get(evt.day)!.push(evt);
      }

      // Walk through each day
      for (let d = 1; d <= days; d++) {
        const dayEvents = eventsByDay.get(d);
        if (dayEvents) {
          for (const evt of dayEvents) {
            const acc = accountMap.get(evt.accountId);
            if (!acc) continue;
            const current = balances.get(evt.accountId) ?? 0;
            const converted = toAccountCurrency(evt.amount, evt.currency, acc.currency, exchangeRate);
            balances.set(evt.accountId, evt.direction === 'in' ? current + converted : current - converted);
          }
        }

        const point: ChartPoint = {
          dayIndex: globalDayIndex,
          dayLabel: monthCount > 1 ? `${monthShort} ${d}` : `${d}`,
        };
        for (const acc of checkingAccounts) {
          point[acc.id] = Math.round((balances.get(acc.id) ?? 0) * 100) / 100;
        }
        chartData.push(point);
        globalDayIndex++;
      }

      // Record end-of-month balances
      for (const acc of checkingAccounts) {
        monthlyEndBalances.get(acc.id)!.push(balances.get(acc.id) ?? 0);
      }
    }

    const accountStates: AccountState[] = checkingAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      color: acc.color,
      startBalance: acc.currentBalance,
      monthlyEndBalances: monthlyEndBalances.get(acc.id) ?? [],
      endBalance: balances.get(acc.id) ?? acc.currentBalance,
    }));

    return { events: allEvents, accountStates, chartData, monthBoundaries };
  }, [input]);
}

// Standalone function for scenario comparison (no hook, called imperatively)
export function runSimulationPure(input: SimulationInput): SimulationOutput {
  const { rules, checkingAccounts, spending, startMonth, monthCount, exchangeRate } = input;
  const accountMap = new Map(checkingAccounts.map(a => [a.id, a]));

  const allEvents: SimEvent[] = [];
  const balances = new Map<string, number>();
  const chartData: ChartPoint[] = [];
  const monthBoundaries: number[] = [];
  const monthlyEndBalances = new Map<string, number[]>();

  for (const acc of checkingAccounts) {
    balances.set(acc.id, acc.currentBalance);
    monthlyEndBalances.set(acc.id, []);
  }

  let globalDayIndex = 0;
  const startPoint: ChartPoint = { dayIndex: 0, dayLabel: 'Start' };
  for (const acc of checkingAccounts) {
    startPoint[acc.id] = acc.currentBalance;
  }
  chartData.push(startPoint);
  globalDayIndex++;

  for (let mi = 0; mi < monthCount; mi++) {
    const month = offsetMonth(startMonth, mi);
    const days = daysInMonth(month);
    const monthShort = formatMonthShort(month);
    monthBoundaries.push(globalDayIndex);

    const monthEvents: SimEvent[] = [];

    for (const rule of rules) {
      if (!rule.enabled || !rule.accountId) continue;
      const acc = accountMap.get(rule.accountId);
      if (!acc) continue;

      if (rule.spread) {
        const perChunk = Math.round((rule.amount / SPREAD_DAYS.length) * 100) / 100;
        for (const sd of SPREAD_DAYS) {
          if (sd > days) continue;
          monthEvents.push({
            monthIndex: mi, monthLabel: month, day: sd, type: rule.sourceType,
            label: `${rule.name} (spread)`, amount: perChunk, currency: rule.currency,
            accountId: rule.accountId, accountName: acc.name, direction: rule.direction,
          });
        }
      } else {
        monthEvents.push({
          monthIndex: mi, monthLabel: month, day: Math.min(rule.day, days), type: rule.sourceType,
          label: rule.name, amount: rule.amount, currency: rule.currency,
          accountId: rule.accountId, accountName: acc.name, direction: rule.direction,
        });
      }
    }

    if (mi === 0) {
      const monthSpending = spending.filter(e =>
        e.date.startsWith(startMonth) && e.paymentMethod.startsWith('checking_')
      );
      for (const entry of monthSpending) {
        const accId = entry.paymentMethod.replace('checking_', '');
        const acc = accountMap.get(accId);
        if (!acc) continue;
        monthEvents.push({
          monthIndex: 0, monthLabel: startMonth, day: parseInt(entry.date.split('-')[2], 10),
          type: 'spending', label: entry.description, amount: entry.amount, currency: 'COP',
          accountId: accId, accountName: acc.name, direction: 'out',
        });
      }
    }

    monthEvents.sort((a, b) => a.day - b.day || (a.direction === 'in' ? -1 : 1));
    allEvents.push(...monthEvents);

    const eventsByDay = new Map<number, SimEvent[]>();
    for (const evt of monthEvents) {
      if (!eventsByDay.has(evt.day)) eventsByDay.set(evt.day, []);
      eventsByDay.get(evt.day)!.push(evt);
    }

    for (let d = 1; d <= days; d++) {
      const dayEvents = eventsByDay.get(d);
      if (dayEvents) {
        for (const evt of dayEvents) {
          const acc = accountMap.get(evt.accountId);
          if (!acc) continue;
          const current = balances.get(evt.accountId) ?? 0;
          const converted = toAccountCurrency(evt.amount, evt.currency, acc.currency, exchangeRate);
          balances.set(evt.accountId, evt.direction === 'in' ? current + converted : current - converted);
        }
      }
      const point: ChartPoint = { dayIndex: globalDayIndex, dayLabel: monthCount > 1 ? `${monthShort} ${d}` : `${d}` };
      for (const acc of checkingAccounts) {
        point[acc.id] = Math.round((balances.get(acc.id) ?? 0) * 100) / 100;
      }
      chartData.push(point);
      globalDayIndex++;
    }

    for (const acc of checkingAccounts) {
      monthlyEndBalances.get(acc.id)!.push(balances.get(acc.id) ?? 0);
    }
  }

  const accountStates: AccountState[] = checkingAccounts.map(acc => ({
    id: acc.id, name: acc.name, currency: acc.currency, color: acc.color,
    startBalance: acc.currentBalance,
    monthlyEndBalances: monthlyEndBalances.get(acc.id) ?? [],
    endBalance: balances.get(acc.id) ?? acc.currentBalance,
  }));

  return { events: allEvents, accountStates, chartData, monthBoundaries };
}
