import { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP } from '@/lib/formatters';
import {
  totalDebtCOP, totalCheckingCOP, totalSubscriptionsCOP,
  totalMonthlyIncome, totalFixedExpenses,
  totalMinimumPaymentsCOP, totalDebtPaymentsCOP,
  monthsToPayoff,
} from '@/lib/calculations';
import type { DebtAccount } from '@/types';

// ─── Helpers ────────────────────────────────────────────────

function toCOP(amount: number, currency: 'COP' | 'USD', rate: number) {
  return currency === 'USD' ? amount * rate : amount;
}

function monthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function monthLabelFull(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtAxis(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function perAccountTimeline(
  acc: DebtAccount,
  extra: number,
  exchangeRate: number,
  maxMonths = 360,
) {
  const bal = toCOP(acc.currentBalance, acc.currency, exchangeRate);
  const payment = toCOP(acc.monthlyPayment || acc.minimumMonthlyPayment, acc.currency, exchangeRate) + extra;
  const points: { month: number; balance: number }[] = [{ month: 0, balance: bal }];
  let b = bal;
  for (let m = 1; m <= maxMonths && b > 0; m++) {
    b = Math.max(0, b - payment);
    points.push({ month: m, balance: b });
  }
  return points;
}

/** Snowball: allocate surplus to smallest-balance-first */
function snowballPayoff(
  accounts: DebtAccount[],
  surplus: number,
  exchangeRate: number,
  maxMonths = 360,
) {
  if (accounts.length === 0) return [];
  // Each account starts with its balance and minimum payment
  const state = accounts
    .map(a => ({
      id: a.id,
      balance: toCOP(a.currentBalance, a.currency, exchangeRate),
      minPayment: toCOP(a.minimumMonthlyPayment, a.currency, exchangeRate),
    }))
    .sort((a, b) => a.balance - b.balance);

  const totalMinimums = state.reduce((s, a) => s + a.minPayment, 0);
  let extraPool = Math.max(0, surplus);

  const timeline: { month: number; total: number }[] = [
    { month: 0, total: state.reduce((s, a) => s + a.balance, 0) },
  ];

  for (let m = 1; m <= maxMonths; m++) {
    let remaining = extraPool;
    for (const a of state) {
      if (a.balance <= 0) continue;
      let pay = a.minPayment;
      // Snowball: pour extra into smallest remaining
      if (remaining > 0) {
        pay += remaining;
        remaining = 0;
      }
      a.balance = Math.max(0, a.balance - pay);
    }
    const total = state.reduce((s, a) => s + a.balance, 0);
    timeline.push({ month: m, total });
    if (total <= 0) break;
    // Freed-up minimums from paid-off accounts go to pool next month
    extraPool = surplus + state.filter(a => a.balance <= 0).reduce((s, a) => s + a.minPayment, 0);
  }
  return timeline;
}

const TOOLTIP_STYLE = { backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' };
const GRID_STROKE = '#1E293B';
const TICK_STYLE = { fill: '#94A3B8', fontSize: 11 };

// ─── Component ──────────────────────────────────────────────

export default function Projections() {
  const debtAccounts = useFinanceStore(s => s.debtAccounts);
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subscriptions = useFinanceStore(s => s.subscriptions);
  const spending = useFinanceStore(s => s.spending);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const savingsTarget = useFinanceStore(s => s.settings?.savingsTarget ?? 0);

  // ─── Base calculations ──────────────────────────────────
  const income = totalMonthlyIncome(incomeSources, exchangeRate);
  const fixedExp = totalFixedExpenses(fixedExpenses, exchangeRate);
  const subsCost = totalSubscriptionsCOP(subscriptions, exchangeRate);
  const debtPayments = totalDebtPaymentsCOP(debtAccounts, exchangeRate);
  const minPayments = totalMinimumPaymentsCOP(debtAccounts, exchangeRate);
  const debt = totalDebtCOP(debtAccounts, exchangeRate);
  const checking = totalCheckingCOP(checkingAccounts, exchangeRate);

  // Average monthly discretionary spending (last 90 days)
  const avgSpending = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recent = spending.filter(e => e.date >= cutoffStr);
    const total = recent.reduce((s, e) => s + e.amount, 0);
    return recent.length > 0 ? (total / 3) : 0; // average per month over 3 months
  }, [spending]);

  const totalOutflows = fixedExp + subsCost + debtPayments + avgSpending + savingsTarget;
  const surplus = income - totalOutflows;

  // ─── Milestones ─────────────────────────────────────────
  const milestones = useMemo(() => {
    // Debt-free: max payoff across all accounts (using actual payments + extra)
    let debtFreeMonths = 0;
    debtAccounts.forEach(acc => {
      const bal = toCOP(acc.currentBalance, acc.currency, exchangeRate);
      const pay = toCOP(acc.monthlyPayment || acc.minimumMonthlyPayment, acc.currency, exchangeRate);
      const m = pay > 0 ? monthsToPayoff(bal, pay) : Infinity;
      if (m > debtFreeMonths) debtFreeMonths = m;
    });

    // Emergency fund months
    const monthlyExp = fixedExp + subsCost + debtPayments + avgSpending;
    const emergencyMonths = monthlyExp > 0 ? checking / monthlyExp : Infinity;

    // Savings target months
    const monthlySavings = Math.max(0, surplus);
    const savingsMonths = savingsTarget > 0 && monthlySavings > 0
      ? Math.ceil(savingsTarget / monthlySavings) : savingsTarget > 0 ? Infinity : 0;

    const netWorth = checking - debt;

    return { debtFreeMonths, emergencyMonths, savingsMonths, netWorth };
  }, [debtAccounts, exchangeRate, fixedExp, subsCost, debtPayments, avgSpending, checking, debt, surplus, savingsTarget]);

  // ─── Cash flow waterfall ────────────────────────────────
  const waterfallData = useMemo(() => {
    const items = [
      { name: 'Income', amount: income, running: income },
    ];
    let running = income;

    const outflows: [string, number, string][] = [
      ['Fixed Exp.', fixedExp, '#FF6B6B'],
      ['Subscriptions', subsCost, '#FF6B6B'],
      ['Debt Payments', debtPayments, '#FBBF24'],
      ['Avg. Spending', avgSpending, '#FF6B6B'],
      ['Savings', savingsTarget, '#4F8EF7'],
    ];

    for (const [name, amount, color] of outflows) {
      if (amount <= 0) continue;
      running -= amount;
      items.push({ name, amount: -amount, running });
    }

    items.push({ name: 'Surplus', amount: 0, running });

    // For waterfall: base (invisible) + visible segment
    return items.map((item, i) => {
      if (i === 0) return { name: item.name, base: 0, value: item.running, fill: '#00D4AA' };
      if (i === items.length - 1) return { name: item.name, base: 0, value: item.running, fill: item.running >= 0 ? '#00D4AA' : '#FF6B6B' };
      return { name: item.name, base: item.running, value: -item.amount, fill: (outflows[i - 1]?.[2] ?? '#FF6B6B') as string };
    });
  }, [income, fixedExp, subsCost, debtPayments, avgSpending, savingsTarget]);

  // ─── Per-account debt timelines ─────────────────────────
  const { debtChartData, accountMeta } = useMemo(() => {
    if (debtAccounts.length === 0) return { debtChartData: [], accountMeta: [] };

    const timelines = debtAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      color: acc.color,
      timeline: perAccountTimeline(acc, 0, exchangeRate),
    }));

    const maxLen = Math.max(...timelines.map(t => t.timeline.length));
    const data: Record<string, unknown>[] = [];
    for (let m = 0; m < maxLen; m++) {
      const point: Record<string, unknown> = { month: m, label: monthLabel(m) };
      for (const t of timelines) {
        point[t.id] = t.timeline[m]?.balance ?? 0;
      }
      data.push(point);
    }

    return {
      debtChartData: data,
      accountMeta: timelines.map(t => ({ id: t.id, name: t.name, color: t.color })),
    };
  }, [debtAccounts, exchangeRate]);

  // ─── Net worth projection ───────────────────────────────
  const netWorthData = useMemo(() => {
    const months = Math.max(milestones.debtFreeMonths === Infinity ? 36 : milestones.debtFreeMonths + 6, 24);
    const capped = Math.min(months, 120);
    const data: { month: number; label: string; checking: number; debt: number; netWorth: number }[] = [];

    for (let m = 0; m <= capped; m++) {
      // Checking grows by surplus each month
      const chk = checking + Math.max(0, surplus) * m;

      // Debt decreases per account
      let dbt = 0;
      for (const acc of debtAccounts) {
        const bal = toCOP(acc.currentBalance, acc.currency, exchangeRate);
        const pay = toCOP(acc.monthlyPayment || acc.minimumMonthlyPayment, acc.currency, exchangeRate);
        dbt += Math.max(0, bal - pay * m);
      }

      data.push({
        month: m,
        label: monthLabel(m),
        checking: chk,
        debt: -dbt,
        netWorth: chk - dbt,
      });
    }
    return data;
  }, [checking, surplus, debtAccounts, exchangeRate, milestones.debtFreeMonths]);

  // ─── Scenario comparison ────────────────────────────────
  const scenarios = useMemo(() => {
    if (debtAccounts.length === 0 || debt <= 0) return null;

    // 1. Minimum payments only
    const minTimeline: { month: number; total: number }[] = [{ month: 0, total: debt }];
    let minBal = debt;
    for (let m = 1; m <= 360 && minBal > 0; m++) {
      minBal = Math.max(0, minBal - minPayments);
      minTimeline.push({ month: m, total: minBal });
    }
    const minMonths = minPayments > 0 ? monthsToPayoff(debt, minPayments) : Infinity;

    // 2. Current plan (actual payments + extras)
    const currentTotal = debtPayments;
    const currentTimeline: { month: number; total: number }[] = [{ month: 0, total: debt }];
    let curBal = debt;
    for (let m = 1; m <= 360 && curBal > 0; m++) {
      curBal = Math.max(0, curBal - currentTotal);
      currentTimeline.push({ month: m, total: curBal });
    }
    const currentMonths = currentTotal > 0 ? monthsToPayoff(debt, currentTotal) : Infinity;

    // 3. Aggressive (snowball)
    const surplusForSnowball = Math.max(0, income - fixedExp - subsCost - avgSpending - savingsTarget - minPayments);
    const aggressiveTimeline = snowballPayoff(debtAccounts, surplusForSnowball, exchangeRate);
    const aggressiveMonths = aggressiveTimeline.length > 0 ? aggressiveTimeline.length - 1 : Infinity;

    // Merge into chart data
    const maxLen = Math.max(minTimeline.length, currentTimeline.length, aggressiveTimeline.length);
    const data: { month: number; label: string; minimum: number; current: number; aggressive: number }[] = [];
    for (let m = 0; m < maxLen; m++) {
      data.push({
        month: m,
        label: monthLabel(m),
        minimum: minTimeline[m]?.total ?? 0,
        current: currentTimeline[m]?.total ?? 0,
        aggressive: aggressiveTimeline[m]?.total ?? 0,
      });
    }

    return { data, minMonths, currentMonths, aggressiveMonths };
  }, [debt, debtAccounts, debtPayments, minPayments, income, fixedExp, subsCost, avgSpending, savingsTarget, exchangeRate]);

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Projections</h1>
        {milestones.debtFreeMonths > 0 && milestones.debtFreeMonths !== Infinity && (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            Debt-free {monthLabelFull(milestones.debtFreeMonths)}
          </Badge>
        )}
      </div>

      {/* ── Section 1: Milestone KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MilestoneBox
          label="Debt-Free In"
          value={milestones.debtFreeMonths === 0 ? 'Now!' : milestones.debtFreeMonths === Infinity ? 'Never' : `${milestones.debtFreeMonths} mo`}
          sub={milestones.debtFreeMonths > 0 && milestones.debtFreeMonths !== Infinity ? monthLabelFull(milestones.debtFreeMonths) : undefined}
          color={milestones.debtFreeMonths === 0 ? 'text-primary' : milestones.debtFreeMonths === Infinity ? 'text-destructive' : 'text-foreground'}
        />
        <MilestoneBox
          label="Net Worth"
          value={formatCOP(milestones.netWorth)}
          color={milestones.netWorth >= 0 ? 'text-primary' : 'text-destructive'}
        />
        <MilestoneBox
          label="Emergency Fund"
          value={milestones.emergencyMonths === Infinity ? '∞' : `${milestones.emergencyMonths.toFixed(1)} mo`}
          sub="of expenses covered"
          color={milestones.emergencyMonths >= 6 ? 'text-primary' : milestones.emergencyMonths >= 3 ? 'text-warning' : 'text-destructive'}
        />
        <MilestoneBox
          label="Monthly Surplus"
          value={formatCOP(surplus)}
          sub={surplus < 0 ? 'Spending exceeds income' : 'after all outflows'}
          color={surplus >= 0 ? 'text-primary' : 'text-destructive'}
        />
      </div>

      {/* ── Section 2: Cash Flow Waterfall ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Cash Flow</CardTitle>
          <p className="text-xs text-muted-foreground">How your income is allocated each month</p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={TICK_STYLE} tickFormatter={fmtAxis} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => formatCOP(Math.abs(value))}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <ReferenceLine y={0} stroke="#334155" />
                <Bar dataKey="base" stackId="stack" fill="transparent" />
                <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Per-Account Debt Payoff ── */}
      {debtAccounts.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Debt Payoff Timeline</CardTitle>
            <p className="text-xs text-muted-foreground">Per-account projected balance using your set payments</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={debtChartData}>
                  <defs>
                    {accountMeta.map(a => (
                      <linearGradient key={a.id} id={`grad-${a.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={a.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={a.color} stopOpacity={0.05} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="label"
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(debtChartData.length / 8) - 1)}
                  />
                  <YAxis tick={TICK_STYLE} tickFormatter={fmtAxis} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      const meta = accountMeta.find(a => a.id === name);
                      return [formatCOP(value), meta?.name ?? name];
                    }}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  {accountMeta.map(a => (
                    <Area
                      key={a.id}
                      type="monotone"
                      dataKey={a.id}
                      stroke={a.color}
                      fill={`url(#grad-${a.id})`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3">
              {accountMeta.map(a => (
                <div key={a.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-xs text-muted-foreground">{a.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 4: Net Worth Projection ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Net Worth Projection</CardTitle>
          <p className="text-xs text-muted-foreground">Checking growth vs debt reduction over time</p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthData}>
                <defs>
                  <linearGradient id="gradChecking" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4AA" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#00D4AA" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradDebt" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="label"
                  tick={TICK_STYLE}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(netWorthData.length / 8) - 1)}
                />
                <YAxis tick={TICK_STYLE} tickFormatter={fmtAxis} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { checking: 'Checking', debt: 'Debt', netWorth: 'Net Worth' };
                    return [formatCOP(Math.abs(value)), labels[name] ?? name];
                  }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="checking" stroke="#00D4AA" fill="url(#gradChecking)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="debt" stroke="#FF6B6B" fill="url(#gradDebt)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="netWorth" stroke="#4F8EF7" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary" /><span className="text-xs text-muted-foreground">Checking</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-destructive" /><span className="text-xs text-muted-foreground">Debt</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4F8EF7' }} /><span className="text-xs text-muted-foreground">Net Worth</span></div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Scenario Comparison ── */}
      {scenarios && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scenario Comparison</CardTitle>
            <p className="text-xs text-muted-foreground">Minimum vs current vs aggressive (snowball) strategy</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-secondary rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Minimum</p>
                <p className="font-bold text-sm text-muted-foreground">
                  {scenarios.minMonths === Infinity ? 'Never' : `${scenarios.minMonths} mo`}
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-lg text-center border border-accent/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Plan</p>
                <p className="font-bold text-sm text-accent">
                  {scenarios.currentMonths === Infinity ? 'Never' : `${scenarios.currentMonths} mo`}
                </p>
                {scenarios.minMonths !== Infinity && scenarios.currentMonths < scenarios.minMonths && (
                  <p className="text-[10px] text-primary mt-0.5">
                    {scenarios.minMonths - scenarios.currentMonths} mo saved
                  </p>
                )}
              </div>
              <div className="p-3 bg-secondary rounded-lg text-center border border-primary/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Aggressive</p>
                <p className="font-bold text-sm text-primary">
                  {scenarios.aggressiveMonths === Infinity ? 'Never' : `${scenarios.aggressiveMonths} mo`}
                </p>
                {scenarios.minMonths !== Infinity && scenarios.aggressiveMonths < scenarios.minMonths && (
                  <p className="text-[10px] text-primary mt-0.5">
                    {scenarios.minMonths - scenarios.aggressiveMonths} mo saved
                  </p>
                )}
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scenarios.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="label"
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(scenarios.data.length / 8) - 1)}
                  />
                  <YAxis tick={TICK_STYLE} tickFormatter={fmtAxis} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => formatCOP(value)}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  <Line type="monotone" dataKey="minimum" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="Minimum" />
                  <Line type="monotone" dataKey="current" stroke="#4F8EF7" strokeWidth={2} dot={false} name="Current" />
                  <Line type="monotone" dataKey="aggressive" stroke="#00D4AA" strokeWidth={2} dot={false} name="Aggressive" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-muted-foreground" style={{ borderTop: '2px dashed #94A3B8' }} /><span className="text-xs text-muted-foreground">Minimum</span></div>
              <div className="flex items-center gap-1.5"><div className="w-6 h-0.5" style={{ backgroundColor: '#4F8EF7' }} /><span className="text-xs text-muted-foreground">Current Plan</span></div>
              <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-primary" /><span className="text-xs text-muted-foreground">Aggressive</span></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function MilestoneBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="p-3 bg-card border border-border rounded-lg">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold text-sm ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
