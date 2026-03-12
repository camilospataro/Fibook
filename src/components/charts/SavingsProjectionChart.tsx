import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, getCurrentMonth } from '@/lib/formatters';

export default function SavingsProjectionChart() {
  const savingsTarget = useFinanceStore(s => s.settings?.savingsTarget ?? 0);
  const snapshots = useFinanceStore(s => s.snapshots);

  // Get current accumulated savings from the latest snapshot
  const currentMonth = getCurrentMonth();
  const currentSnapshot = snapshots.find(sn => sn.month === currentMonth);
  const startingSavings = currentSnapshot?.savings ?? 0;

  if (savingsTarget <= 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Savings Projection — 2026</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm">Set a monthly savings target in the Monthly page to see projections.</p></CardContent>
      </Card>
    );
  }

  // Project from current month through Dec 2026
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-based
  const endMonth = currentYear === 2026 ? 11 : 11; // always show through Dec 2026
  const endYear = 2026;

  const data: { label: string; savings: number }[] = [];
  let accumulated = startingSavings;

  // Start from current month, go through Dec 2026
  const startDate = new Date(currentYear, currentMonthIdx);
  const endDate = new Date(endYear, endMonth);

  let d = new Date(startDate);
  let isFirst = true;
  while (d <= endDate) {
    if (!isFirst) {
      accumulated += savingsTarget;
    }
    isFirst = false;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    data.push({ label, savings: Math.round(accumulated) });
    d = new Date(d.getFullYear(), d.getMonth() + 1);
  }

  const totalByEnd = data[data.length - 1]?.savings ?? 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Savings Projection — 2026</CardTitle>
          <span className="text-xs text-primary font-medium">
            {formatCOP(totalByEnd)} by Dec 2026
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
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
                formatter={((value: number) => formatCOP(value)) as never}
                labelStyle={{ color: '#94A3B8' }}
              />
              <Area type="monotone" dataKey="savings" stroke="#00D4AA" fill="url(#savingsGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
