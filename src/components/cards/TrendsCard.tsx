import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatMonthLabel } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

type Metric = 'income-vs-expenses' | 'debt' | 'savings' | 'balance';

const metricLabels: Record<Metric, string> = {
  'income-vs-expenses': 'Income vs Expenses',
  debt: 'Debt Paid',
  savings: 'Savings',
  balance: 'Monthly Balance',
};

export default function TrendsCard() {
  const snapshots = useFinanceStore(s => s.snapshots);
  const [metric, setMetric] = useState<Metric>('income-vs-expenses');

  const sortedSnapshots = useMemo(() =>
    [...snapshots].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
  [snapshots]);

  const chartData = useMemo(() => {
    return sortedSnapshots.map(s => {
      const label = formatMonthLabel(s.month).split(' ')[0].slice(0, 3);
      return {
        month: label,
        income: s.totalIncome,
        expenses: s.totalExpenses,
        debtPaid: s.totalDebtPaid,
        savings: s.savings,
        balance: s.balance,
      };
    });
  }, [sortedSnapshots]);

  // Month-over-month deltas
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

  if (sortedSnapshots.length < 2) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Trends</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Save at least 2 monthly snapshots to see trends.
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
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                formatter={((value: number) => [formatCOP(value)]) as never}
              />
              {metric === 'income-vs-expenses' && (
                <>
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="income" name="Income" fill="var(--income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                </>
              )}
              {metric === 'debt' && (
                <Bar dataKey="debtPaid" name="Debt Paid" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              )}
              {metric === 'savings' && (
                <Bar dataKey="savings" name="Savings" fill="var(--income)" radius={[4, 4, 0, 0]} />
              )}
              {metric === 'balance' && (
                <Bar dataKey="balance" name="Balance" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
