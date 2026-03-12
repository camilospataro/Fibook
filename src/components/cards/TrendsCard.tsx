import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatMonthLabel } from '@/lib/formatters';
import {
  totalMonthlyIncome, totalFixedExpenses, totalSubscriptionsCOP,
  newChargesPerDebtAccount,
} from '@/lib/calculations';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts';

type Metric = 'income-vs-expenses' | 'debt' | 'savings' | 'balance';

const metricLabels: Record<Metric, string> = {
  'income-vs-expenses': 'Income vs Expenses',
  debt: 'Debt Paid',
  savings: 'Savings',
  balance: 'Monthly Balance',
};

function toCOP(amount: number, currency: 'COP' | 'USD', rate: number) {
  return currency === 'USD' ? amount * rate : amount;
}

export default function TrendsCard() {
  const snapshots = useFinanceStore(s => s.snapshots);
  const debtAccounts = useFinanceStore(s => s.debtAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subscriptions = useFinanceStore(s => s.subscriptions);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const savingsTarget = useFinanceStore(s => s.settings?.savingsTarget ?? 0);
  const [metric, setMetric] = useState<Metric>('income-vs-expenses');

  const sortedSnapshots = useMemo(() =>
    [...snapshots].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
  [snapshots]);

  const chartData = useMemo(() => {
    const income = totalMonthlyIncome(incomeSources, exchangeRate);
    const fixedExp = totalFixedExpenses(fixedExpenses, exchangeRate);
    const subsCost = totalSubscriptionsCOP(subscriptions, exchangeRate);

    // Current month key (YYYY-MM) — snapshots after this are "future" and should be projected
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Only use snapshots up to and including the current month as historical
    const pastSnapshots = sortedSnapshots.filter(s => s.month <= currentMonthKey);

    // Historical data from snapshots
    const historical = pastSnapshots.map(s => {
      const label = formatMonthLabel(s.month).split(' ')[0].slice(0, 3);
      return {
        month: label,
        income: s.totalIncome,
        expenses: s.totalExpenses,
        debtPaid: s.totalDebtPaid,
        savings: s.savings,
        balance: s.balance,
        projected: false,
      };
    });

    const lastSnapshotMonth = pastSnapshots.length > 0
      ? pastSnapshots[pastSnapshots.length - 1].month
      : currentMonthKey;

    // Generate projected future months (up to 6 months ahead)
    // Simulate per-account debt payoff with recurring charges added each month
    const recurringCharges = newChargesPerDebtAccount(debtAccounts, subscriptions, fixedExpenses, exchangeRate);
    const accountState = debtAccounts.map(acc => ({
      id: acc.id,
      balance: toCOP(acc.currentBalance, acc.currency, exchangeRate),
      payment: toCOP(acc.monthlyPayment || acc.minimumMonthlyPayment, acc.currency, exchangeRate),
      monthlyNewCharges: recurringCharges.get(acc.id) ?? 0,
    }));

    const projectedMonths: typeof historical = [];
    const [lastYear, lastMon] = lastSnapshotMonth.split('-').map(Number);
    const startDate = new Date(lastYear, lastMon - 1); // last snapshot month

    for (let i = 1; i <= 6; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i);
      const label = d.toLocaleDateString('en-US', { month: 'short' }).slice(0, 3);

      // Add new charges from subscriptions/expenses linked to each debt account
      for (const acc of accountState) {
        acc.balance += acc.monthlyNewCharges;
      }

      // Simulate debt payments for this month
      let monthDebtPayments = 0;
      const totalRecurringOnDebt = accountState.reduce((s, a) => s + a.monthlyNewCharges, 0);
      for (const acc of accountState) {
        if (acc.balance <= 0) continue;
        const pay = Math.min(acc.payment, acc.balance);
        acc.balance = Math.max(0, acc.balance - acc.payment);
        monthDebtPayments += pay;
      }

      // Debt payments include paying off recurring charges (already in fixedExp+subsCost)
      // plus paying down old principal. Only add the principal paydown to avoid double-counting.
      const principalPaydown = Math.max(0, monthDebtPayments - totalRecurringOnDebt);
      // Fixed expenses serve as the budget for projected months (no avgSpending — it overlaps)
      const projExpenses = fixedExp + subsCost + principalPaydown;
      const projBalance = income - projExpenses;
      const projSavings = Math.max(0, projBalance - savingsTarget) + savingsTarget;

      projectedMonths.push({
        month: label,
        income,
        expenses: projExpenses,
        debtPaid: monthDebtPayments,
        savings: Math.min(projSavings, Math.max(0, projBalance)),
        balance: projBalance,
        projected: true,
      });
    }

    // Combine: take last N historical + projected to fill ~12 bars
    const maxHistorical = Math.max(0, 12 - projectedMonths.length);
    const trimmedHistorical = historical.slice(-maxHistorical);
    return [...trimmedHistorical, ...projectedMonths];
  }, [sortedSnapshots, debtAccounts, incomeSources, fixedExpenses, subscriptions, exchangeRate, savingsTarget]);

  // Month-over-month deltas (from snapshots only)
  const deltas = useMemo(() => {
    if (sortedSnapshots.length < 2) return null;
    const curr = sortedSnapshots[sortedSnapshots.length - 1];
    const prev = sortedSnapshots[sortedSnapshots.length - 2];
    return {
      incomeDelta: curr.totalIncome - prev.totalIncome,
      expenseDelta: curr.totalExpenses - prev.totalExpenses,
      debtDelta: curr.totalDebtPaid - prev.totalDebtPaid,
      savingsDelta: curr.savings - prev.savings,
    };
  }, [sortedSnapshots]);

  if (sortedSnapshots.length < 1 && debtAccounts.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Trends</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Save at least 1 monthly snapshot to see trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Trends</CardTitle>
        {deltas && (
          <div className="flex gap-3 text-[10px]">
            <span className={deltas.incomeDelta >= 0 ? 'text-income' : 'text-destructive'}>
              Income {deltas.incomeDelta >= 0 ? '+' : ''}{formatCOP(deltas.incomeDelta)}
            </span>
            <span className={deltas.expenseDelta <= 0 ? 'text-income' : 'text-destructive'}>
              Expenses {deltas.expenseDelta >= 0 ? '+' : ''}{formatCOP(deltas.expenseDelta)}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Metric Toggle */}
        <div className="flex rounded-lg bg-secondary/70 p-0.5">
          {(Object.entries(metricLabels) as [Metric, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${
                metric === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--foreground)' }}
                labelStyle={{ color: 'var(--muted-foreground)' }}
                itemStyle={{ color: 'var(--foreground)' }}
                formatter={((value: number, _name: string, props: { payload: { projected: boolean } }) => {
                  const suffix = props.payload.projected ? ' (projected)' : '';
                  return [formatCOP(value) + suffix];
                }) as never}
              />
              {metric === 'income-vs-expenses' && (
                <>
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="income" name="Income" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill="var(--income)" fillOpacity={d.projected ? 0.4 : 1} />
                    ))}
                  </Bar>
                  <Bar dataKey="expenses" name="Expenses" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill="var(--expense)" fillOpacity={d.projected ? 0.4 : 1} />
                    ))}
                  </Bar>
                </>
              )}
              {metric === 'debt' && (
                <Bar dataKey="debtPaid" name="Debt Paid" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="var(--accent)" fillOpacity={d.projected ? 0.4 : 1} />
                  ))}
                </Bar>
              )}
              {metric === 'savings' && (
                <Bar dataKey="savings" name="Savings" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="var(--income)" fillOpacity={d.projected ? 0.4 : 1} />
                  ))}
                </Bar>
              )}
              {metric === 'balance' && (
                <Bar dataKey="balance" name="Balance" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill="var(--primary)" fillOpacity={d.projected ? 0.4 : 1} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend for projected */}
        {chartData.some(d => d.projected) && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground justify-center">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
            <span>Faded bars = projected (accounts for debt payoff)</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
