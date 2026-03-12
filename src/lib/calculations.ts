import type { DebtAccount, CheckingAccount, Subscription, IncomeSource, FixedExpense } from '@/types';

export function totalDebtCOP(accounts: DebtAccount[], exchangeRate: number): number {
  return accounts.reduce((sum, acc) => {
    const balanceCOP = acc.currency === 'USD' ? acc.currentBalance * exchangeRate : acc.currentBalance;
    return sum + balanceCOP;
  }, 0);
}

export function totalCheckingCOP(accounts: CheckingAccount[], exchangeRate: number): number {
  return accounts.reduce((sum, acc) => {
    const balanceCOP = acc.currency === 'USD' ? acc.currentBalance * exchangeRate : acc.currentBalance;
    return sum + balanceCOP;
  }, 0);
}

/**
 * Total monthly subscriptions in COP.
 * If `month` is provided (1-12), annual subs only count in their renewal month (full amount).
 * If `month` is omitted, annual subs are spread across 12 months (cost/12).
 */
export function totalSubscriptionsCOP(subs: Subscription[], exchangeRate: number, month?: number): number {
  return subs
    .filter(s => s.active)
    .reduce((sum, s) => {
      const cost = s.currency === 'USD' ? s.amount * exchangeRate : s.amount;
      if (s.billingCycle === 'annual') {
        if (month != null) {
          // Only charge in the renewal month
          return sum + (s.renewalMonth === month ? cost : 0);
        }
        return sum + cost / 12; // spread evenly when no month specified
      }
      return sum + cost;
    }, 0);
}

export function totalMonthlyIncome(sources: IncomeSource[], exchangeRate: number): number {
  return sources.reduce((sum, s) => {
    const amount = s.currency === 'USD' ? s.amount * exchangeRate : s.amount;
    return sum + amount;
  }, 0);
}

export function totalFixedExpenses(expenses: FixedExpense[], exchangeRate: number): number {
  return expenses.reduce((sum, e) => {
    const amount = e.currency === 'USD' ? e.amount * exchangeRate : e.amount;
    return sum + amount;
  }, 0);
}

export function totalMinimumPaymentsCOP(accounts: DebtAccount[], exchangeRate: number): number {
  return accounts.reduce((sum, acc) => {
    const payment = acc.currency === 'USD' ? acc.minimumMonthlyPayment * exchangeRate : acc.minimumMonthlyPayment;
    return sum + payment;
  }, 0);
}

export function totalDebtPaymentsCOP(accounts: DebtAccount[], exchangeRate: number): number {
  return accounts.reduce((sum, acc) => {
    const payment = acc.currency === 'USD' ? (acc.monthlyPayment || 0) * exchangeRate : (acc.monthlyPayment || 0);
    return sum + payment;
  }, 0);
}

export function totalMonthlyExpenses(
  fixedExpenses: FixedExpense[],
  accounts: DebtAccount[],
  subs: Subscription[],
  exchangeRate: number,
  month?: number
): number {
  const fixed = totalFixedExpenses(fixedExpenses, exchangeRate);
  const subsCost = totalSubscriptionsCOP(subs, exchangeRate, month);
  const debtPayments = totalDebtPaymentsCOP(accounts, exchangeRate);
  // Recurring charges on debt cards are already in fixed + subsCost.
  // Only add the principal paydown portion of debt payments to avoid double-counting.
  const recurringOnDebt = [...newChargesPerDebtAccount(accounts, subs, fixedExpenses, exchangeRate, month).values()]
    .reduce((s, v) => s + v, 0);
  const principalPaydown = Math.max(0, debtPayments - recurringOnDebt);
  return fixed + subsCost + principalPaydown;
}

/**
 * Compute monthly recurring charges per debt account (from subscriptions + auto fixed expenses).
 * Returns a Map of debtAccountId → monthly COP charge amount.
 * For annual subs, spreads across 12 months (or pass calendarMonth 1-12 for exact).
 */
export function newChargesPerDebtAccount(
  debtAccounts: DebtAccount[],
  subscriptions: Subscription[],
  fixedExpenses: FixedExpense[],
  exchangeRate: number,
  calendarMonth?: number,
): Map<string, number> {
  const debtIds = new Set(debtAccounts.map(a => a.id));
  const charges = new Map<string, number>();

  for (const sub of subscriptions) {
    if (!sub.active || !sub.linkedAccountId || !debtIds.has(sub.linkedAccountId)) continue;
    const cost = sub.currency === 'USD' ? sub.amount * exchangeRate : sub.amount;
    if (sub.billingCycle === 'annual') {
      if (calendarMonth != null) {
        if (sub.renewalMonth !== calendarMonth) continue;
      } else {
        charges.set(sub.linkedAccountId, (charges.get(sub.linkedAccountId) ?? 0) + cost / 12);
        continue;
      }
    }
    charges.set(sub.linkedAccountId, (charges.get(sub.linkedAccountId) ?? 0) + cost);
  }

  for (const exp of fixedExpenses) {
    if (exp.paymentMode !== 'auto' || !exp.linkedAccountId || !debtIds.has(exp.linkedAccountId)) continue;
    const cost = exp.currency === 'USD' ? exp.amount * exchangeRate : exp.amount;
    charges.set(exp.linkedAccountId, (charges.get(exp.linkedAccountId) ?? 0) + cost);
  }

  return charges;
}

export function monthlyBalance(income: number, expenses: number): number {
  return income - expenses;
}

export function monthsToPayoff(balance: number, monthlyPayment: number, newChargesPerMonth: number = 0): number {
  if (monthlyPayment <= newChargesPerMonth) return Infinity;
  return Math.ceil(balance / (monthlyPayment - newChargesPerMonth));
}

export function projectedDebt(balance: number, payment: number, newCharges: number, months: number): number {
  let b = balance;
  for (let i = 0; i < months; i++) {
    b = Math.max(0, b + newCharges - payment);
  }
  return b;
}

export function projectedSavings(monthlySavings: number, months: number, startingSavings: number = 0): number {
  return startingSavings + (monthlySavings * months);
}

export function debtPayoffTimeline(balance: number, payment: number, newCharges: number = 0): { month: number; balance: number }[] {
  const timeline: { month: number; balance: number }[] = [{ month: 0, balance }];
  let b = balance;
  let month = 0;
  const maxMonths = 360;

  while (b > 0 && month < maxMonths) {
    month++;
    b = Math.max(0, b + newCharges - payment);
    timeline.push({ month, balance: b });
    if (payment <= newCharges && b > 0) break;
  }
  return timeline;
}
