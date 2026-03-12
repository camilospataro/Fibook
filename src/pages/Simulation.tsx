import { useState, useMemo, useCallback } from 'react';
import { Play, RotateCcw, Check, ArrowUpCircle, ArrowDownCircle, Pencil, Link2, Repeat, BarChart3, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCurrency, getCurrentMonth, formatMonthLabel } from '@/lib/formatters';
import { toast } from 'sonner';
import { useSimulation, runSimulationPure } from '@/hooks/useSimulation';
import type { SimRule, RuleOverrides, Scenario, ScenarioResult, ChartPoint } from '@/types/simulation';
import SimulationChart from '@/components/simulation/SimulationChart';
import SimulationTimeline from '@/components/simulation/SimulationTimeline';
import SimulationProjections from '@/components/simulation/SimulationProjections';
import ScenarioManager from '@/components/simulation/ScenarioManager';
import SimulationPlayback from '@/components/simulation/SimulationPlayback';
import CashFlowCalendar from '@/components/simulation/CashFlowCalendar';
import DayBar from '@/components/simulation/DayBar';

const typeLabel: Record<string, string> = {
  income: 'Income', expense: 'Expense', subscription: 'Subscription', debt: 'Debt',
};
const typeColor: Record<string, string> = {
  income: 'text-income', expense: 'text-muted-foreground', subscription: 'text-muted-foreground', debt: 'text-warning',
};

export default function Simulation() {
  const { checkingAccounts, incomeSources, fixedExpenses, subscriptions, debtAccounts, spending } = useFinanceStore();
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const userId = useFinanceStore(s => s.userId);
  const updateCheckingAccount = useFinanceStore(s => s.updateCheckingAccount);
  const updateIncomeSource = useFinanceStore(s => s.updateIncomeSource);
  const updateFixedExpense = useFinanceStore(s => s.updateFixedExpense);
  const updateSubscription = useFinanceStore(s => s.updateSubscription);
  const updateDebtAccount = useFinanceStore(s => s.updateDebtAccount);

  const [startMonth] = useState(getCurrentMonth);
  const [monthCount, setMonthCount] = useState(1);
  const [simulated, setSimulated] = useState(false);
  const [applied, setApplied] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);

  // Visual mode
  const [viewMode, setViewMode] = useState<'chart' | 'calendar'>('chart');
  const [activeDay, setActiveDay] = useState(0);

  // Overrides & scenarios
  const [overrides, setOverrides] = useState<RuleOverrides>({});
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [compareScenarioIds, setCompareScenarioIds] = useState<string[]>([]);

  // Build rules from store + overrides
  const rules: SimRule[] = useMemo(() => {
    const r: SimRule[] = [];

    for (const src of incomeSources) {
      if (!src.isRecurring) continue;
      const ov = overrides[`income-${src.id}`];
      r.push({
        id: `income-${src.id}`, sourceType: 'income', name: src.name,
        amount: ov?.amount ?? src.amount, currency: src.currency, direction: 'in',
        accountId: ov?.accountId !== undefined ? ov.accountId : src.linkedAccountId,
        day: ov?.day ?? src.depositDay, enabled: ov?.enabled ?? true, spread: ov?.spread ?? false,
      });
    }

    for (const exp of fixedExpenses) {
      const ov = overrides[`expense-${exp.id}`];
      r.push({
        id: `expense-${exp.id}`, sourceType: 'expense', name: exp.name,
        amount: ov?.amount ?? exp.amount, currency: exp.currency, direction: 'out',
        accountId: ov?.accountId !== undefined ? ov.accountId : exp.linkedAccountId,
        day: ov?.day ?? 1, enabled: ov?.enabled ?? true, spread: ov?.spread ?? false,
      });
    }

    for (const sub of subscriptions) {
      if (!sub.active) continue;
      const ov = overrides[`sub-${sub.id}`];
      r.push({
        id: `sub-${sub.id}`, sourceType: 'subscription', name: sub.name,
        amount: ov?.amount ?? sub.amount, currency: sub.currency, direction: 'out',
        accountId: ov?.accountId !== undefined ? ov.accountId : sub.linkedAccountId,
        day: ov?.day ?? sub.paymentDay, enabled: ov?.enabled ?? true, spread: ov?.spread ?? false,
        billingCycle: sub.billingCycle, renewalMonth: sub.renewalMonth,
      });
    }

    for (const debt of debtAccounts) {
      if (!debt.monthlyPayment) continue;
      const ov = overrides[`debt-${debt.id}`];
      r.push({
        id: `debt-${debt.id}`, sourceType: 'debt', name: `${debt.name} payment`,
        amount: ov?.amount ?? debt.monthlyPayment, currency: debt.currency, direction: 'out',
        accountId: ov?.accountId !== undefined ? ov.accountId : debt.linkedAccountId,
        day: ov?.day ?? 1, enabled: ov?.enabled ?? true, spread: ov?.spread ?? false,
      });
    }

    return r;
  }, [incomeSources, fixedExpenses, subscriptions, debtAccounts, overrides]);

  const linkedRules = rules.filter(r => r.accountId);
  const unlinkedRules = rules.filter(r => !r.accountId);

  // Main simulation
  const simInput = useMemo(() => ({
    rules, checkingAccounts, spending, startMonth, monthCount, exchangeRate,
  }), [rules, checkingAccounts, spending, startMonth, monthCount, exchangeRate]);

  const { events, accountStates, chartData, monthBoundaries } = useSimulation(
    simulated ? simInput : { rules: [], checkingAccounts: [], spending: [], startMonth, monthCount: 1, exchangeRate }
  );

  // Scenario comparison results
  const scenarioResults: ScenarioResult[] = useMemo(() => {
    if (!simulated || compareScenarioIds.length === 0) return [];

    return compareScenarioIds.map(sid => {
      const scenario = scenarios.find(s => s.id === sid);
      if (!scenario) return null;

      // Build rules with scenario overrides
      const scenarioRules = rules.map(r => {
        const ov = scenario.overrides[r.id];
        if (!ov) return r;
        return {
          ...r,
          amount: ov.amount ?? r.amount,
          day: ov.day ?? r.day,
          enabled: ov.enabled ?? r.enabled,
          accountId: ov.accountId !== undefined ? ov.accountId : r.accountId,
          spread: ov.spread ?? r.spread,
        };
      });

      const result = runSimulationPure({
        rules: scenarioRules, checkingAccounts, spending,
        startMonth, monthCount: scenario.monthCount, exchangeRate,
      });

      return {
        scenarioId: sid,
        scenarioName: scenario.name,
        chartData: result.chartData,
        accountStates: result.accountStates,
      };
    }).filter(Boolean) as ScenarioResult[];
  }, [simulated, compareScenarioIds, scenarios, rules, checkingAccounts, spending, startMonth, monthCount, exchangeRate]);

  // Merge scenario chart data into main chartData for Recharts
  const mergedChartData: ChartPoint[] = useMemo(() => {
    if (scenarioResults.length === 0) return chartData;

    return chartData.map((point, i) => {
      const merged = { ...point };
      for (const sr of scenarioResults) {
        const scenarioPoint = sr.chartData[i];
        if (!scenarioPoint) continue;
        for (const acc of checkingAccounts) {
          merged[`${sr.scenarioId}_${acc.id}`] = scenarioPoint[acc.id] ?? 0;
        }
      }
      return merged;
    });
  }, [chartData, scenarioResults, checkingAccounts]);

  // Totals
  function toAccountCurrency(amount: number, from: 'COP' | 'USD', accId: string) {
    const acc = checkingAccounts.find(a => a.id === accId);
    if (!acc || from === acc.currency) return amount;
    return from === 'USD' ? amount * exchangeRate : amount / exchangeRate;
  }

  const totalIn = events.filter(e => e.direction === 'in').reduce((sum, e) => sum + toAccountCurrency(e.amount, e.currency, e.accountId), 0);
  const totalOut = events.filter(e => e.direction === 'out').reduce((sum, e) => sum + toAccountCurrency(e.amount, e.currency, e.accountId), 0);

  // Override helpers
  function updateOverride(ruleId: string, patch: RuleOverrides[string]) {
    setOverrides(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], ...patch } }));
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

  // Scenario handlers
  function handleSaveScenario(scenario: Scenario) {
    setScenarios(prev => [...prev, scenario]);
    setActiveScenarioId(scenario.id);
    toast.success(`Scenario "${scenario.name}" saved`);
  }

  function handleLoadScenario(scenarioId: string) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    setOverrides(scenario.overrides);
    setMonthCount(scenario.monthCount);
    setActiveScenarioId(scenarioId);
    setSimulated(false);
    setApplied(false);
  }

  function handleDeleteScenario(scenarioId: string) {
    setScenarios(prev => prev.filter(s => s.id !== scenarioId));
    setCompareScenarioIds(prev => prev.filter(id => id !== scenarioId));
    if (activeScenarioId === scenarioId) setActiveScenarioId(null);
  }

  function handleToggleCompare(scenarioId: string) {
    setCompareScenarioIds(prev =>
      prev.includes(scenarioId) ? prev.filter(id => id !== scenarioId) : [...prev, scenarioId]
    );
  }

  // Playback day handler
  const handleDayChange = useCallback((dayIndex: number) => {
    if (dayIndex === -1) {
      // Increment from playback auto-advance
      setActiveDay(prev => Math.min(prev + 1, chartData.length - 1));
    } else {
      setActiveDay(dayIndex);
    }
  }, [chartData.length]);

  // Simulation controls
  const runSim = useCallback(() => {
    setSimulated(true);
    setApplied(false);
    setActiveDay(0);
  }, []);

  const resetSim = useCallback(() => {
    setSimulated(false);
    setApplied(false);
    setActiveDay(0);
  }, []);

  const applySim = useCallback(async () => {
    for (const acc of accountStates) {
      if (acc.endBalance !== acc.startBalance) {
        await updateCheckingAccount(acc.id, { currentBalance: Math.round(acc.endBalance * 100) / 100 });
      }
    }
    setApplied(true);
    toast.success('Simulation applied — checking balances updated');
  }, [accountStates, updateCheckingAccount]);

  // Days in current start month (for DayBar)
  const daysInStartMonth = useMemo(() => {
    const [y, m] = startMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [startMonth]);

  // Group linked rules by account
  const rulesByAccount = useMemo(() => {
    const map = new Map<string, SimRule[]>();
    for (const r of linkedRules) {
      if (!r.accountId) continue;
      if (!map.has(r.accountId)) map.set(r.accountId, []);
      map.get(r.accountId)!.push(r);
    }
    return map;
  }, [linkedRules]);

  // Render a rule row
  function renderRuleRow(rule: SimRule) {
    return (
      <div key={rule.id}>
        <div className="flex items-center gap-1.5 py-0.5">
          <Switch checked={rule.enabled} onCheckedChange={v => updateOverride(rule.id, { enabled: v })} className="scale-[0.6] shrink-0" />
          {rule.direction === 'in' ? (
            <ArrowDownCircle className="w-3 h-3 text-income shrink-0" />
          ) : (
            <ArrowUpCircle className="w-3 h-3 text-destructive shrink-0" />
          )}
          <span className={`text-[11px] truncate flex-1 ${!rule.enabled ? 'text-muted-foreground line-through' : ''}`}>{rule.name}</span>
          {rule.spread && <span title="Spread across month"><Repeat className="w-3 h-3 text-accent shrink-0" /></span>}
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
              <Input type="number" min="1" max="31" defaultValue={rule.day} disabled={rule.spread}
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
              <Input type="number" defaultValue={rule.amount}
                onBlur={e => { const v = Number(e.target.value); if (v > 0) updateOverride(rule.id, { amount: v }); }}
                className="h-7 text-xs bg-secondary border-border"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground">Account</label>
              <Select value={rule.accountId ?? 'none'}
                onValueChange={v => {
                  const newId = v === 'none' ? null : v;
                  updateOverride(rule.id, { accountId: newId });
                  saveAccountLink({ ...rule, accountId: newId });
                }}>
                <SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={rule.spread} onCheckedChange={v => updateOverride(rule.id, { spread: v })} className="scale-75" />
              <div>
                <span className="text-[11px]">Spread across month</span>
                <p className="text-[9px] text-muted-foreground">Weekly portions (days 1, 8, 15, 22, 29)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto pb-28 md:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Cash Flow Simulation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure rules and simulate {formatMonthLabel(startMonth)}
            {monthCount > 1 && ` + ${monthCount - 1} more`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground whitespace-nowrap">Months:</label>
          <Select value={String(monthCount)} onValueChange={v => { setMonthCount(Number(v)); setSimulated(false); }}>
            <SelectTrigger className="h-7 w-16 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scenario Manager */}
      <ScenarioManager
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        compareScenarioIds={compareScenarioIds}
        currentOverrides={overrides}
        monthCount={monthCount}
        onSave={handleSaveScenario}
        onLoad={handleLoadScenario}
        onDelete={handleDeleteScenario}
        onToggleCompare={handleToggleCompare}
        onClearComparison={() => setCompareScenarioIds([])}
      />

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

                  {/* DayBar — drag to reorder payment days */}
                  {accRules.length > 0 && (
                    <DayBar
                      daysInMonth={daysInStartMonth}
                      rules={accRules}
                      onDayChange={(ruleId, newDay) => {
                        updateOverride(ruleId, { day: newDay });
                        const rule = accRules.find(r => r.id === ruleId);
                        if (rule?.sourceType === 'income') saveDayToDb({ ...rule, day: newDay });
                      }}
                    />
                  )}

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

          {/* Unlinked items */}
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
                            <Input type="number" min="1" max="31" defaultValue={rule.day}
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
                            <Input type="number" defaultValue={rule.amount}
                              onBlur={e => { const v = Number(e.target.value); if (v > 0) updateOverride(rule.id, { amount: v }); }}
                              className="h-7 text-xs bg-secondary border-border"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground">Link to Account</label>
                            <Select value="none"
                              onValueChange={v => {
                                const newId = v === 'none' ? null : v;
                                updateOverride(rule.id, { accountId: newId });
                                saveAccountLink({ ...rule, accountId: newId });
                              }}>
                              <SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue placeholder="Select account..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 flex items-center gap-2">
                            <Switch checked={rule.spread} onCheckedChange={v => updateOverride(rule.id, { spread: v })} className="scale-75" />
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
        <Button onClick={runSim} className="flex-1 gap-2" disabled={checkingAccounts.length === 0}>
          <Play className="w-4 h-4" />
          {simulated ? 'Re-run Simulation' : 'Run Simulation'}
        </Button>
        {simulated && (
          <Button onClick={resetSim} variant="secondary" size="icon">
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Results */}
      {simulated && (
        <>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'chart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Chart
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>

          {viewMode === 'chart' ? (
            <>
              <SimulationChart
                chartData={mergedChartData}
                checkingAccounts={checkingAccounts}
                monthBoundaries={monthBoundaries}
                monthCount={monthCount}
                events={events}
                scenarioResults={scenarioResults}
                activeDay={activeDay}
                onDayClick={handleDayChange}
              />

              {/* Playback scrubber */}
              <SimulationPlayback
                chartData={chartData}
                events={events}
                checkingAccounts={checkingAccounts}
                activeDay={activeDay}
                onDayChange={handleDayChange}
              />
            </>
          ) : (
            <CashFlowCalendar
              chartData={chartData}
              events={events}
              checkingAccounts={checkingAccounts}
              startMonth={startMonth}
              monthCount={monthCount}
            />
          )}

          <SimulationProjections
            accountStates={accountStates}
            totalIn={totalIn}
            totalOut={totalOut}
            checkingAccounts={checkingAccounts}
            userId={userId}
            startMonth={startMonth}
          />

          <SimulationTimeline events={events} monthCount={monthCount} />

          {events.length > 0 && (
            <Button
              onClick={applySim}
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
