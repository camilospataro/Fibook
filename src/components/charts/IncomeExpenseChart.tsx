import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatMonthLabel } from '@/lib/formatters';

export default function IncomeExpenseChart() {
  const snapshots = useFinanceStore(s => s.snapshots);

  const data = snapshots
    .slice(0, 6)
    .reverse()
    .map(s => ({
      month: formatMonthLabel(s.month).split(' ')[0].slice(0, 3),
      income: s.totalIncome,
      expenses: s.totalExpenses,
    }));

  if (data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Income vs Expenses</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Complete your first monthly update to see trends.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Income vs Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
                itemStyle={{ color: '#E8ECF4' }}
                formatter={(value: number | undefined) => formatCOP(value ?? 0)}
              />
              <Bar dataKey="income" fill="#00D4AA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
