import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP } from '@/lib/formatters';

export default function DebtPayoffChart() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);

  // Build per-account balances in COP with their monthly payments
  const accountData = accounts
    .filter(a => a.currentBalance > 0)
    .map(a => ({
      balance: a.currency === 'USD' ? a.currentBalance * exchangeRate : a.currentBalance,
      payment: a.currency === 'USD'
        ? (a.monthlyPayment || a.minimumMonthlyPayment) * exchangeRate
        : (a.monthlyPayment || a.minimumMonthlyPayment),
    }));

  const totalDebt = accountData.reduce((s, a) => s + a.balance, 0);
  const totalPayment = accountData.reduce((s, a) => s + a.payment, 0);

  if (totalDebt === 0 || totalPayment === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Debt Payoff Projection</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm">No active debt or no payments configured.</p></CardContent>
      </Card>
    );
  }

  // Project month by month until all debt is paid off (max 120 months)
  const now = new Date();
  let balances = accountData.map(a => a.balance);
  const data: { label: string; debt: number }[] = [];

  for (let i = 0; i <= 120; i++) {
    const total = balances.reduce((s, b) => s + b, 0);
    const date = new Date(now.getFullYear(), now.getMonth() + i);
    const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    data.push({ label, debt: Math.round(total) });
    if (total <= 0) break;
    balances = balances.map((b, idx) => Math.max(0, b - accountData[idx].payment));
  }

  const payoffMonths = data.length - 1;
  const lastDate = new Date(now.getFullYear(), now.getMonth() + payoffMonths);
  const payoffLabel = lastDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Debt Payoff Projection</CardTitle>
          <span className="text-xs text-primary font-medium">
            Debt-free by {payoffLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(data.length / 6) - 1)}
              />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
                itemStyle={{ color: '#E8ECF4' }}
                formatter={(value: number) => formatCOP(value)}
                labelStyle={{ color: '#94A3B8' }}
              />
              <Area type="monotone" dataKey="debt" stroke="#FF6B6B" fill="url(#debtGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
