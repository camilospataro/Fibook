import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCOP } from '@/lib/formatters';
import type { IncomeSource, FixedExpense, Subscription, DebtAccount } from '@/types';

interface MoneyWaterfallProps {
  incomeSources: IncomeSource[];
  incomeAmounts: Record<string, string>;
  sideIncome: number;
  fixedExpenses: FixedExpense[];
  subscriptions: Subscription[];
  debtAccounts: DebtAccount[];
  ccPayments: Record<string, string>;
  savingsGoal: number;
  variableSpending: number;
  exchangeRate: number;
}

interface WaterfallBar {
  name: string;
  value: number;
  base: number;    // invisible base segment
  visible: number; // visible colored segment
  isIncome: boolean;
  isTotal: boolean;
}

export default function MoneyWaterfall({
  incomeSources,
  incomeAmounts,
  sideIncome,
  fixedExpenses,
  subscriptions,
  debtAccounts,
  ccPayments,
  savingsGoal,
  variableSpending,
  exchangeRate,
}: MoneyWaterfallProps) {
  const bars = useMemo(() => {
    const result: WaterfallBar[] = [];
    let running = 0;

    // Income sources
    for (const src of incomeSources) {
      const amt = Number(incomeAmounts[src.id]) || 0;
      if (amt <= 0) continue;
      const copAmt = src.currency === 'USD' ? amt * exchangeRate : amt;
      result.push({ name: src.name, value: copAmt, base: running, visible: copAmt, isIncome: true, isTotal: false });
      running += copAmt;
    }
    if (sideIncome > 0) {
      result.push({ name: 'Side Income', value: sideIncome, base: running, visible: sideIncome, isIncome: true, isTotal: false });
      running += sideIncome;
    }

    // Total income bar
    const totalIncome = running;
    result.push({ name: 'TOTAL IN', value: totalIncome, base: 0, visible: totalIncome, isIncome: true, isTotal: true });

    // Fixed expenses by category
    const expByCategory = new Map<string, number>();
    for (const exp of fixedExpenses) {
      const copAmt = exp.currency === 'USD' ? exp.amount * exchangeRate : exp.amount;
      const cat = exp.category || 'other';
      expByCategory.set(cat, (expByCategory.get(cat) ?? 0) + copAmt);
    }
    for (const [cat, total] of expByCategory) {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      running -= total;
      result.push({ name: label, value: -total, base: running, visible: total, isIncome: false, isTotal: false });
    }

    // Subscriptions
    const subTotal = subscriptions
      .filter(s => s.active)
      .reduce((sum, s) => sum + (s.currency === 'USD' ? s.amount * exchangeRate : s.amount), 0);
    if (subTotal > 0) {
      running -= subTotal;
      result.push({ name: 'Subs', value: -subTotal, base: running, visible: subTotal, isIncome: false, isTotal: false });
    }

    // Variable spending
    if (variableSpending > 0) {
      running -= variableSpending;
      result.push({ name: 'Spending', value: -variableSpending, base: running, visible: variableSpending, isIncome: false, isTotal: false });
    }

    // Debt payments
    const totalDebtPaid = debtAccounts.reduce((sum, acc) => {
      const paid = Number(ccPayments[acc.id]) || 0;
      return sum + (acc.currency === 'USD' ? paid * exchangeRate : paid);
    }, 0);
    if (totalDebtPaid > 0) {
      running -= totalDebtPaid;
      result.push({ name: 'Debt', value: -totalDebtPaid, base: running, visible: totalDebtPaid, isIncome: false, isTotal: false });
    }

    // Savings
    if (savingsGoal > 0) {
      running -= savingsGoal;
      result.push({ name: 'Savings', value: -savingsGoal, base: running, visible: savingsGoal, isIncome: false, isTotal: false });
    }

    // Balance bar
    result.push({ name: 'BALANCE', value: running, base: 0, visible: Math.abs(running), isIncome: running >= 0, isTotal: true });

    return result;
  }, [incomeSources, incomeAmounts, sideIncome, fixedExpenses, subscriptions, debtAccounts, ccPayments, savingsGoal, variableSpending, exchangeRate]);

  if (bars.length <= 2) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Money Waterfall</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-8">Add income and expenses to see your waterfall</p>
        </CardContent>
      </Card>
    );
  }

  const maxVal = Math.max(...bars.map(b => b.base + b.visible), 0);
  const minVal = Math.min(...bars.map(b => b.base), 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Money Waterfall</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bars}
              margin={{ top: 10, right: 5, bottom: 5, left: 5 }}
              barCategoryGap="20%"
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => {
                  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return v;
                }}
                width={45}
                domain={[Math.min(minVal, 0), maxVal * 1.05]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(_: unknown, __: unknown, props: { payload: WaterfallBar }) => {
                  const bar = props.payload;
                  const prefix = bar.isIncome ? '+' : '-';
                  const label = bar.isTotal ? '' : prefix;
                  return [`${label}${formatCOP(bar.visible)}`, bar.name];
                }}
                labelFormatter={() => ''}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />

              {/* Invisible base */}
              <Bar dataKey="base" stackId="stack" fill="transparent" isAnimationActive={false} />

              {/* Visible segment */}
              <Bar dataKey="visible" stackId="stack" radius={[3, 3, 0, 0]} isAnimationActive={true}>
                {bars.map((bar, i) => {
                  let fill: string;
                  if (bar.isTotal) {
                    fill = bar.isIncome ? '#00D4AA' : '#FF6B6B';
                  } else if (bar.isIncome) {
                    fill = '#00D4AAcc';
                  } else {
                    fill = '#FF6B6Bcc';
                  }
                  return <Cell key={i} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend row */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#00D4AA' }} />
            <span className="text-[10px] text-muted-foreground">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#FF6B6B' }} />
            <span className="text-[10px] text-muted-foreground">Expenses</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
