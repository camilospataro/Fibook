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
  exchangeRate: number
): number {
  return (
    totalFixedExpenses(fixedExpenses, exchangeRate) +
    totalDebtPaymentsCOP(accounts, exchangeRate) +
    totalSubscriptionsCOP(subs, exchangeRate)
  );
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
