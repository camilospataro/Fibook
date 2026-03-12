import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { totalDebtCOP, totalCheckingCOP } from '@/lib/calculations';
import { formatCOP } from '@/lib/formatters';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function NetWorthCard() {
  const debtAccounts = useFinanceStore(s => s.debtAccounts);
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const snapshots = useFinanceStore(s => s.snapshots);

  const totalAssets = totalCheckingCOP(checkingAccounts, exchangeRate);
  const totalLiabilities = totalDebtCOP(debtAccounts, exchangeRate);
  const netWorth = totalAssets - totalLiabilities;

  const chartData = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
    return sorted.map(s => {
      const assets = s.cashOnHand || 0;
      const debt = (s.debtBalances ?? []).reduce((sum, d) => sum + d.balance, 0);
      return {
        month: s.month.split('-')[1] + '/' + s.month.split('-')[0].slice(2),
        netWorth: assets - debt,
      };
    });
  }, [snapshots]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Net Worth</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-3">
          <p className={`text-2xl font-bold font-[family-name:var(--font-display)] ${netWorth >= 0 ? 'text-income' : 'text-destructive'}`}>
            {formatCOP(netWorth)}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Assets: <span className="text-income">{formatCOP(totalAssets)}</span></span>
          <span>Debt: <span className="text-destructive">{formatCOP(totalLiabilities)}</span></span>
        </div>
        {chartData.length >= 2 && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  formatter={((value: number) => [formatCOP(value), 'Net Worth']) as never}
                />
                <defs>
                  <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="netWorth" stroke="var(--primary)" fill="url(#netWorthGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
