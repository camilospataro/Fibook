import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP } from '@/lib/formatters';

export default function DebtDonut() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);

  const data = accounts
    .filter(a => a.currentBalance > 0)
    .map(a => ({
      name: a.name,
      value: a.currency === 'USD' ? a.currentBalance * exchangeRate : a.currentBalance,
      color: a.color,
    }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Debt Overview</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm">No debt accounts with balances.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Debt Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={35} outerRadius={55} paddingAngle={2} strokeWidth={0}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8' }}
                  itemStyle={{ color: '#E8ECF4' }}
                  formatter={(value: number | undefined) => formatCOP(value ?? 0)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {data.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-medium">{formatCOP(d.value)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
              <span>Total</span>
              <span className="text-destructive">{formatCOP(total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
