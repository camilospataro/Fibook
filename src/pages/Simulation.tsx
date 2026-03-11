import { useState, useMemo, useCallback } from 'react';
import { Play, RotateCcw, Check, ArrowUpCircle, ArrowDownCircle, Calendar, Pencil, Link2, Repeat } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatCurrency, getCurrentMonth, formatMonthLabel } from '@/lib/formatters';
import { toast } from 'sonner';

const SPREAD_DAYS = [1, 8, 15, 22, 29]; // Weekly spread points

interface SimRule {
  id: string;
  sourceType: 'income' | 'expense' | 'subscription' | 'debt';
  name: string;
  amount: number;
  currency: 'COP' | 'USD';
  direction: 'in' | 'out';
  accountId: string | null;
  day: number;
  enabled: boolean;
  spread: boolean; // distribute across the month instead of single day
}

interface SimEvent {
  day: number;
  type: string;
  label: string;
  amount: number;
  currency: 'COP' | 'USD';
  accountId: string;
  accountName: string;
  direction: 'in' | 'out';
}

interface AccountState {
  id: string;
  name: string;
  currency: 'COP' | 'USD';
  color: string;
  startBalance: number;
  endBalance: number;
}

export default function Simulation() {
  const { checkingAccounts, incomeSources, fixedExpenses, subscriptions, debtAccounts, spending } = useFinanceStore();
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const updateCheckingAccount = useFinanceStore(s => s.updateCheckingAccount);
  const updateIncomeSource = useFinanceStore(s => s.updateIncomeSource);
  const updateFixedExpense = useFinanceStore(s => s.updateFixedExpense);
  const updateSubscription = useFinanceStore(s => s.updateSubscription);
  const updateDebtAccount = useFinanceStore(s => s.updateDebtAccount);

  const [selectedMonth] = useState(getCurrentMonth);
  const [simulated, setSimulated] = useState(false);
  const [applied, setApplied] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);

  const [overrides, setOverrides] = useState<Record<string, { amount?: number; day?: number; enabled?: boolean; accountId?: string | null; spread?: boolean }>>({});

  const rules: SimRule[] = useMemo(() => {
    const r: SimRule[] = [];

    for (const src of incomeSources) {
      if (!src.isRecurring) continue;
      const ov = overrides[`income-${src.id}`];
      r.push({
        id: `income-${src.id}`,
        sourceType: 'income',
        name: src.name,
        amount: ov?.amount ?? src.amount,
        currency: src.currency,
        direction: 'in',
        accountId: ov?.accountId !== undefined ? ov.accountId : src.linkedAccountId,
        day: ov?.day ?? src.depositDay,
        enabled: ov?.enabled ?? true,
        spread: ov?.spread ?? false,
      });
    }

    for (const exp of fixedExpenses) {
      const ov = overrides[`expense-${exp.id}`];
      r.push({
        id: `expense-${exp.id}`,
        sourceType: 'expense',
        name: exp.name,
        amount: ov?.amount ?? exp.amount,
        currency: exp.currency,
        direction: 'out',
        accountId: ov?.accountId !== undefined ? ov.accountId : exp.linkedAccountId,
        day: ov?.day ?? 1,
        enabled: ov?.enabled ?? true,
        spread: ov?.spread ?? false,
      });
    }

    for (const sub of subscriptions) {
      if (!sub.active) continue;
      const ov = overrides[`sub-${sub.id}`];
      r.push({
        id: `sub-${sub.id}`,
        sourceType: 'subscription',
        name: sub.name,
        amount: ov?.amount ?? sub.amount,
        currency: sub.currency,
        direction: 'out',
        accountId: ov?.accountId !== undefined ? ov.accountId : sub.linkedAccountId,
        day: ov?.day ?? 1,
        enabled: ov?.enabled ?? true,
        spread: ov?.spread ?? false,
      });
    }

    for (const debt of debtAccounts) {
      if (!debt.monthlyPayment) continue;
      const ov = overrides[`debt-${debt.id}`];
      r.push({
        id: `debt-${debt.id}`,
        sourceType: 'debt',
        name: `${debt.name} payment`,
        amount: ov?.amount ?? debt.monthlyPayment,
        currency: debt.currency,
        direction: 'out',
        accountId: ov?.accountId !== undefined ? ov.accountId : debt.linkedAccountId,
        day: ov?.day ?? 1,
        enabled: ov?.enabled ?? true,
        spread: ov?.spread ?? false,
      });
    }

    return r;
  }, [incomeSources, fixedExpenses, subscriptions, debtAccounts, overrides]);

  const linkedRules = rules.filter(r => r.accountId);
  const unlinkedRules = rules.filter(r => !r.accountId);

  function updateOverride(ruleId: string, patch: { amount?: number; day?: number; enabled?: boolean; accountId?: string | null; spread?: boolean }) {
    setOverrides(prev => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], ...patch },
    }));
    setSimulated(false);
    setApplied(false);
  }

  function saveAccountLink(rule: SimRule) {
    const entityId = rule.id.split('-').slice(1).join('-');
    if (rule.sourceType === 'income') updateIncomeSource(entityId, { linkedAccountId: rule.accountId });
    else if (rule.sourceType === 'expense') updateFixedExpense(entityId, { linkedAccountId: rule.accountId });
    else if (rule.sourceType === 'subscription') updateSubscription(entityId, { linkedAccountId: rule.accountId });
    else if (rule.sourceType === 'debt') updateDebtAccount(entityId, { linkedAccountId: rule.accountId });
  }

  function saveDayToDb(rule: SimRule) {
    if (rule.sourceType === 'income') {
      const entityId = rule.id.split('-').slice(1).join('-');
      updateIncomeSource(entityId, { depositDay: rule.day });
    }
  }

  // Convert amount to account currency
  function toAccountCurrency(amount: number, fromCurrency: 'COP' | 'USD', accCurrency: 'COP' | 'USD') {
    if (fromCurrency === accCurrency) return amount;
    if (fromCurrency === 'USD' && accCurrency === 'COP') return amount * exchangeRate;
    return amount / exchangeRate;
  }

  // Build simulation events and daily balance series
  const { events, accountStates, chartData } = useMemo(() => {
    if (!simulated) return { events: [] as SimEvent[], accountStates: [] as AccountState[], chartData: [] as Record<string, unknown>[] };

    const evts: SimEvent[] = [];
    const accountMap = new Map(checkingAccounts.map(a => [a.id, a]));

    // Events from rules — handle spread
    for (const rule of rules) {
      if (!rule.enabled || !rule.accountId) continue;
      const acc = accountMap.get(rule.accountId);
      if (!acc) continue;

      if (rule.spread) {
        const perChunk = Math.round((rule.amount / SPREAD_DAYS.length) * 100) / 100;
        for (const spreadDay of SPREAD_DAYS) {
          evts.push({
            day: spreadDay,
            type: rule.sourceType,
            label: `${rule.name} (spread)`,
            amount: perChunk,
            currency: rule.currency,
            accountId: rule.accountId,
            accountName: acc.name,
            direction: rule.direction,
          });
        }
      } else {
        evts.push({
          day: rule.day,
          type: rule.sourceType,
          label: rule.name,
          amount: rule.amount,
          currency: rule.currency,
          accountId: rule.accountId,
          accountName: acc.name,
          direction: rule.direction,
        });
      }
    }

    // Variable spending already recorded this month
    const monthSpending = spending.filter(e =>
      e.date.startsWith(selectedMonth) && e.paymentMethod.startsWith('checking_')
    );
    for (const entry of monthSpending) {
      const accId = entry.paymentMethod.replace('checking_', '');
      const acc = accountMap.get(accId);
      if (!acc) continue;
      const day = parseInt(entry.date.split('-')[2], 10);
      evts.push({
        day,
        type: 'spending',
        label: entry.description,
        amount: entry.amount,
        currency: 'COP',
        accountId: accId,
        accountName: acc.name,
        direction: 'out',
      });
    }

    evts.sort((a, b) => a.day - b.day || (a.direction === 'in' ? -1 : 1));

    // Build day-by-day balance series for chart
    const balances = new Map<string, number>();
    for (const acc of checkingAccounts) {
      balances.set(acc.id, acc.currentBalance);
    }

    // Determine days in month
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // Group events by day
    const eventsByDay = new Map<number, SimEvent[]>();
    for (const evt of evts) {
      if (!eventsByDay.has(evt.day)) eventsByDay.set(evt.day, []);
      eventsByDay.get(evt.day)!.push(evt);
    }

    const series: Record<string, unknown>[] = [];

    // Day 0 = starting balances
    const day0: Record<string, unknown> = { day: 0 };
    for (const acc of checkingAccounts) {
      day0[acc.id] = acc.currentBalance;
    }
    series.push(day0);

    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvents = eventsByDay.get(d) ?? [];
      for (const evt of dayEvents) {
        const acc = accountMap.get(evt.accountId);
        if (!acc) continue;
        const current = balances.get(evt.accountId) ?? 0;
        const converted = toAccountCurrency(evt.amount, evt.currency, acc.currency);
        balances.set(evt.accountId, evt.direction === 'in' ? current + converted : current - converted);
      }
      const point: Record<string, unknown> = { day: d };
      for (const acc of checkingAccounts) {
        point[acc.id] = Math.round((balances.get(acc.id) ?? 0) * 100) / 100;
      }
      series.push(point);
    }

    const states: AccountState[] = checkingAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      color: acc.color,
      startBalance: acc.currentBalance,
      endBalance: balances.get(acc.id) ?? acc.currentBalance,
    }));

    return { events: evts, accountStates: states, chartData: series };
  }, [simulated, checkingAccounts, rules, spending, selectedMonth, exchangeRate]);

  const runSimulation = useCallback(() => {
    setSimulated(true);
    setApplied(false);
  }, []);

  const resetSimulation = useCallback(() => {
    setSimulated(false);
    setApplied(false);
  }, []);

  const applySimulation = useCallback(async () => {
    for (const acc of accountStates) {
      if (acc.endBalance !== acc.startBalance) {
        await updateCheckingAccount(acc.id, { currentBalance: Math.round(acc.endBalance * 100) / 100 });
      }
    }
    setApplied(true);
    toast.success('Simulation applied — checking balances updated');
  }, [accountStates, updateCheckingAccount]);

  const totalIn = events.filter(e => e.direction === 'in').reduce((sum, e) => {
    const acc = checkingAccounts.find(a => a.id === e.accountId);
    if (!acc) return sum;
    return sum + toAccountCurrency(e.amount, e.currency, acc.currency);
  }, 0);

  const totalOut = events.filter(e => e.direction === 'out').reduce((sum, e) => {
    const acc = checkingAccounts.find(a => a.id === e.accountId);
    if (!acc) return sum;
    return sum + toAccountCurrency(e.amount, e.currency, acc.currency);
  }, 0);

  const typeLabel: Record<string, string> = {
    income: 'Income', expense: 'Expense', subscription: 'Subscription', debt: 'Debt',
  };
  const typeColor: Record<string, string> = {
    income: 'text-income', expense: 'text-muted-foreground', subscription: 'text-muted-foreground', debt: 'text-warning',
  };

  const rulesByAccount = useMemo(() => {
    const map = new Map<string, SimRule[]>();
    for (const r of linkedRules) {
      if (!r.accountId) continue;
      if (!map.has(r.accountId)) map.set(r.accountId, []);
      map.get(r.accountId)!.push(r);
    }
    return map;
  }, [linkedRules]);

  // Render a rule row (used for both linked and unlinked)
  function renderRuleRow(rule: SimRule) {
    return (
      <div key={rule.id}>
        <div className="flex items-center gap-1.5 py-0.5">
          <Switch
            checked={rule.enabled}
            onCheckedChange={v => updateOverride(rule.id, { enabled: v })}
            className="scale-[0.6] shrink-0"
          />
          {rule.direction === 'in' ? (
            <ArrowDownCircle className="w-3 h-3 text-income shrink-0" />
          ) : (
            <ArrowUpCircle className="w-3 h-3 text-destructive shrink-0" />
          )}
          <span className={`text-[11px] truncate flex-1 ${!rule.enabled ? 'text-muted-foreground line-through' : ''}`}>{rule.name}</span>
          {rule.spread && (
            <Repeat className="w-3 h-3 text-accent shrink-0" title="Spread across month" />
          )}
          <Badge variant="secondary" className="text-[9px] shrink-0">{typeLabel[rule.sourceType]}</Badge>
          {!rule.spread && <span className="text-[10px] text-muted-foreground shrink-0">Day {rule.day}</span>}
          {rule.spread && <span className="text-[10px] text-accent shrink-0">Weekly</span>}
          <span className={`text-[11px] font-medium shrink-0 ${rule.direction === 'in' ? 'text-income' : 'text-destructive'} ${!rule.enabled ? 'opacity-40' : ''}`}>
            {rule.direction === 'in' ? '+' : '-'}{formatCurrency(rule.amount, rule.currency)}
          </span>
          <button
            onClick={() => setEditingRule(editingRule === rule.id ? null : rule.id)}
            className={`p-0.5 transition-colors shrink-0 ${editingRule === rule.id ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
        {editingRule === rule.id && (
          <div className="pl-5 pb-2 pt-1 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Day of Month</label>
              <Input
                type="number"
                min="1"
                max="31"
                defaultValue={rule.day}
                disabled={rule.spread}
                onBlur={e => {
                  const v = Math.min(31, Math.max(1, Number(e.target.value) || 1));
                  updateOverride(rule.id, { day: v });
                  if (rule.sourceType === 'income') saveDayToDb({ ...rule, day: v });
                }}
                className="h-7 text-xs bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Amount Override</label>
              <Input
                type="number"
                defaultValue={rule.amount}
                onBlur={e => {
                  const v = Number(e.target.value);
                  if (v > 0) updateOverride(rule.id, { amount: v });
                }}
                className="h-7 text-xs bg-secondary border-border"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground">Account</label>
              <Select
                value={rule.accountId ?? 'none'}
                onValueChange={v => {
                  const newId = v === 'none' ? null : v;
                  updateOverride(rule.id, { accountId: newId });
                  saveAccountLink({ ...rule, accountId: newId });
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                checked={rule.spread}
                onCheckedChange={v => updateOverride(rule.id, { spread: v })}
                className="scale-75"
              />
              <div>
                <span className="text-[11px]">Spread across month</span>
                <p className="text-[9px] text-muted-foreground">
                  Divides total into weekly portions (days 1, 8, 15, 22, 29)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto pb-28 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Cash Flow Simulation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure rules and simulate {formatMonthLabel(selectedMonth)}
        </p>
      </div>

      {/* Simulation Rules */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Simulation Rules</CardTitle>
            <span className="text-[10px] text-muted-foreground">{linkedRules.filter(r => r.enabled).length} active / {rules.length} total</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {checkingAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No checking accounts. Add them in Monthly first.</p>
          ) : (
            checkingAccounts.map(acc => {
              const accRules = rulesByAccount.get(acc.id) ?? [];
              return (
                <div key={acc.id}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                    <span className="text-sm font-medium">{acc.name}</span>
                    <Badge variant="outline" className="text-[10px]">{acc.currency}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{formatCurrency(acc.currentBalance, acc.currency)}</span>
                  </div>
                  <div className="pl-5 space-y-0.5">
                    {accRules.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic">No rules linked to this account</p>
                    )}
                    {accRules.map(renderRuleRow)}
                  </div>
                </div>
              );
            })
          )}

          {unlinkedRules.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-[11px] text-warning font-medium mb-1.5">Not linked — won't be simulated:</p>
                <div className="space-y-1">
                  {unlinkedRules.map(rule => (
                    <div key={rule.id}>
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-[11px] truncate flex-1">{rule.name}</span>
                        <Badge variant="secondary" className={`text-[9px] shrink-0 ${typeColor[rule.sourceType]}`}>{typeLabel[rule.sourceType]}</Badge>
                        <span className={`text-[11px] font-medium shrink-0 ${rule.direction === 'in' ? 'text-income' : 'text-destructive'}`}>
                          {formatCurrency(rule.amount, rule.currency)}
                        </span>
                        <button
                          onClick={() => setEditingRule(editingRule === rule.id ? null : rule.id)}
                          className={`p-0.5 transition-colors shrink-0 ${editingRule === rule.id ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                      {editingRule === rule.id && (
                        <div className="pl-5 pb-2 pt-1 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Day of Month</label>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              defaultValue={rule.day}
                              onBlur={e => {
                                const v = Math.min(31, Math.max(1, Number(e.target.value) || 1));
                                updateOverride(rule.id, { day: v });
                                if (rule.sourceType === 'income') saveDayToDb({ ...rule, day: v });
                              }}
                              className="h-7 text-xs bg-secondary border-border"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Amount Override</label>
                            <Input
                              type="number"
                              defaultValue={rule.amount}
                              onBlur={e => {
                                const v = Number(e.target.value);
                                if (v > 0) updateOverride(rule.id, { amount: v });
                              }}
                              className="h-7 text-xs bg-secondary border-border"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground">Link to Account</label>
                            <Select
                              value="none"
                              onValueChange={v => {
                                const newId = v === 'none' ? null : v;
                                updateOverride(rule.id, { accountId: newId });
                                saveAccountLink({ ...rule, accountId: newId });
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue placeholder="Select account..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 flex items-center gap-2">
                            <Switch
                              checked={rule.spread}
                              onCheckedChange={v => updateOverride(rule.id, { spread: v })}
                              className="scale-75"
                            />
                            <div>
                              <span className="text-[11px]">Spread across month</span>
                              <p className="text-[9px] text-muted-foreground">Weekly portions (days 1, 8, 15, 22, 29)</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={runSimulation} className="flex-1 gap-2" disabled={checkingAccounts.length === 0}>
          <Play className="w-4 h-4" />
          {simulated ? 'Re-run Simulation' : 'Run Simulation'}
        </Button>
        {simulated && (
          <Button onClick={resetSimulation} variant="secondary" size="icon">
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Results */}
      {simulated && (
        <>
          {/* Cash Flow Chart */}
          {chartData.length > 0 && checkingAccounts.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Monthly Cash Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => v === 0 ? 'Start' : `${v}`}
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
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={v => v === 0 ? 'Starting Balance' : `Day ${v}`}
                        formatter={(value: number, name: string) => {
                          const acc = checkingAccounts.find(a => a.id === name);
                          if (!acc) return [value, name];
                          return [formatCurrency(value, acc.currency), acc.name];
                        }}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" opacity={0.5} />
                      {checkingAccounts.map(acc => (
                        <Area
                          key={acc.id}
                          type="stepAfter"
                          dataKey={acc.id}
                          name={acc.id}
                          stroke={acc.color}
                          fill={acc.color}
                          fillOpacity={0.1}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 0 }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {checkingAccounts.map(acc => (
                    <div key={acc.id} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                      <span className="text-[10px] text-muted-foreground">{acc.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account projections */}
          <Card className="bg-card border-primary/20 border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Projected Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {accountStates.map(acc => {
                const diff = acc.endBalance - acc.startBalance;
                return (
                  <div key={acc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                      <span className="text-sm">{acc.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold">{formatCurrency(acc.endBalance, acc.currency)}</span>
                      <span className={`text-[11px] ml-2 ${diff >= 0 ? 'text-income' : 'text-destructive'}`}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff, acc.currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <Separator />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Total In: <span className="text-income font-medium">{formatCOP(totalIn)}</span></span>
                <span>Total Out: <span className="text-destructive font-medium">{formatCOP(totalOut)}</span></span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Event Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No events to simulate. Link and enable rules above.</p>
              ) : (
                <div className="space-y-1">
                  {events.map((evt, i) => {
                    const showDaySeparator = i === 0 || events[i - 1].day !== evt.day;
                    return (
                      <div key={`${evt.type}-${evt.label}-${i}`}>
                        {showDaySeparator && (
                          <div className="flex items-center gap-2 mt-2 mb-1 first:mt-0">
                            <Badge variant="secondary" className="text-[10px] font-mono">Day {evt.day}</Badge>
                            <div className="flex-1 h-px bg-border/50" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 py-1 pl-2">
                          {evt.direction === 'in' ? (
                            <ArrowDownCircle className="w-3.5 h-3.5 text-income shrink-0" />
                          ) : (
                            <ArrowUpCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          )}
                          <span className="text-xs flex-1 truncate">{evt.label}</span>
                          <Badge variant="outline" className="text-[9px] shrink-0">{evt.accountName}</Badge>
                          <span className={`text-xs font-medium shrink-0 ${evt.direction === 'in' ? 'text-income' : 'text-destructive'}`}>
                            {evt.direction === 'in' ? '+' : '-'}{formatCurrency(evt.amount, evt.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Apply */}
          {events.length > 0 && (
            <Button
              onClick={applySimulation}
              disabled={applied}
              variant={applied ? 'secondary' : 'default'}
              className="w-full gap-2"
              size="lg"
            >
              {applied ? (
                <><Check className="w-4 h-4" /> Applied</>
              ) : (
                <><Check className="w-4 h-4" /> Apply to Checking Balances</>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
