import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP } from '@/lib/formatters';
import { debtPayoffTimeline, totalDebtCOP, totalMonthlyIncome, totalMonthlyExpenses, monthsToPayoff, totalMinimumPaymentsCOP } from '@/lib/calculations';

export default function Projections() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subs = useFinanceStore(s => s.subscriptions);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);

  const totalDebt = totalDebtCOP(accounts, exchangeRate);
  const income = totalMonthlyIncome(incomeSources, exchangeRate);
  const expenses = totalMonthlyExpenses(fixedExpenses, accounts, subs, exchangeRate);
  const minPayments = totalMinimumPaymentsCOP(accounts, exchangeRate);
  const balance = income - expenses;

  // Per-account extra payment sliders
  const [extraPayments, setExtraPayments] = useState<Record<string, number>>(() =>
    Object.fromEntries(accounts.map(a => [a.id, 0]))
  );

  const totalExtra = Object.values(extraPayments).reduce((sum, v) => sum + v, 0);
  const totalPayment = minPayments + totalExtra;

  // Debt payoff timeline
  const timeline = useMemo(() => debtPayoffTimeline(totalDebt, totalPayment), [totalDebt, totalPayment]);
  const payoffMonths = monthsToPayoff(totalDebt, totalPayment);

  // Savings projection
  const monthlySavings = Math.max(0, balance - totalExtra);
  const savingsData = useMemo(() => {
    const data: { month: number; savings: number }[] = [];
    for (let i = 0; i <= 24; i++) {
      data.push({ month: i, savings: monthlySavings * i });
    }
    return data;
  }, [monthlySavings]);

  // Scenario comparison
  const aggressiveExtra = Math.max(0, balance * 0.5);
  const aggressivePayoff = monthsToPayoff(totalDebt, minPayments + aggressiveExtra);
  const currentPayoff = monthsToPayoff(totalDebt, totalPayment);

  const comparisonTimeline = useMemo(() => {
    const current = debtPayoffTimeline(totalDebt, totalPayment);
    const aggressive = debtPayoffTimeline(totalDebt, minPayments + aggressiveExtra);
    const maxLen = Math.max(current.length, aggressive.length);
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        month: i,
        current: current[i]?.balance ?? 0,
        aggressive: aggressive[i]?.balance ?? 0,
      });
    }
    return data;
  }, [totalDebt, totalPayment, minPayments, aggressiveExtra]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Projections</h1>
        {payoffMonths !== Infinity && (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            Debt-free in ~{payoffMonths} months
          </Badge>
        )}
      </div>

      {/* Debt Payoff Sliders */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Debt Payoff — Extra Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.map(acc => {
            const balCOP = acc.currency === 'USD' ? acc.currentBalance * exchangeRate : acc.currentBalance;
            return (
              <div key={acc.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                    <Label className="text-sm">{acc.name}</Label>
                  </div>
                  <span className="text-xs text-muted-foreground">Balance: {formatCOP(balCOP)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[extraPayments[acc.id] ?? 0]}
                    onValueChange={([v]) => setExtraPayments(p => ({ ...p, [acc.id]: v }))}
                    min={0}
                    max={Math.min(2000000, balCOP)}
                    step={50000}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-32 text-right">+{formatCOP(extraPayments[acc.id] ?? 0)}</span>
                </div>
              </div>
            );
          })}
          <div className="flex justify-between pt-2 text-sm font-bold border-t border-border">
            <span>Total Monthly Payment</span>
            <span className="text-primary">{formatCOP(totalPayment)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Debt Payoff Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Debt Payoff Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} label={{ value: 'Months', position: 'insideBottom', offset: -5, fill: '#94A3B8' }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => formatCOP(value ?? 0)}
                />
                <Line type="monotone" dataKey="balance" stroke="#FF6B6B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Savings Projection */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Savings Projection (24 months)</CardTitle>
          <p className="text-xs text-muted-foreground">Saving {formatCOP(monthlySavings)}/month after expenses & extra payments</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => formatCOP(value ?? 0)}
                />
                <Line type="monotone" dataKey="savings" stroke="#00D4AA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Comparison */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Scenario Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-muted-foreground text-xs">Current Plan</p>
              <p className="font-bold text-info">{currentPayoff === Infinity ? 'Never' : `${currentPayoff} months`}</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-muted-foreground text-xs">Aggressive (50% of balance)</p>
              <p className="font-bold text-primary">{aggressivePayoff === Infinity ? 'Never' : `${aggressivePayoff} months`}</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => formatCOP(value ?? 0)}
                />
                <Legend />
                <Line type="monotone" dataKey="current" stroke="#4F8EF7" strokeWidth={2} dot={false} name="Current" />
                <Line type="monotone" dataKey="aggressive" stroke="#00D4AA" strokeWidth={2} dot={false} name="Aggressive" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
