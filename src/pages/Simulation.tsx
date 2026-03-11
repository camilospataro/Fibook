import { useState, useMemo, useCallback } from 'react';
import { Play, RotateCcw, Check, ArrowUpCircle, ArrowDownCircle, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatCurrency, getCurrentMonth, formatMonthLabel } from '@/lib/formatters';
import { toast } from 'sonner';

interface SimEvent {
  day: number;
  type: 'income' | 'expense' | 'subscription' | 'debt' | 'spending';
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

  const [selectedMonth] = useState(getCurrentMonth);
  const [simulated, setSimulated] = useState(false);
  const [applied, setApplied] = useState(false);

  // Build simulation events
  const { events, accountStates } = useMemo(() => {
    if (!simulated) return { events: [] as SimEvent[], accountStates: [] as AccountState[] };

    const evts: SimEvent[] = [];
    const balances = new Map<string, number>();
    const accountMap = new Map(checkingAccounts.map(a => [a.id, a]));

    // Initialize balances
    for (const acc of checkingAccounts) {
      balances.set(acc.id, acc.currentBalance);
    }

    // Income deposits
    for (const src of incomeSources) {
      if (!src.linkedAccountId || !src.isRecurring) continue;
      const acc = accountMap.get(src.linkedAccountId);
      if (!acc) continue;
      evts.push({
        day: src.depositDay,
        type: 'income',
        label: src.name,
        amount: src.amount,
        currency: src.currency,
        accountId: src.linkedAccountId,
        accountName: acc.name,
        direction: 'in',
      });
    }

    // Fixed expenses (day 1)
    for (const exp of fixedExpenses) {
      if (!exp.linkedAccountId) continue;
      const acc = accountMap.get(exp.linkedAccountId);
      if (!acc) continue;
      evts.push({
        day: 1,
        type: 'expense',
        label: exp.name,
        amount: exp.amount,
        currency: exp.currency,
        accountId: exp.linkedAccountId,
        accountName: acc.name,
        direction: 'out',
      });
    }

    // Active subscriptions (day 1)
    for (const sub of subscriptions) {
      if (!sub.linkedAccountId || !sub.active) continue;
      const acc = accountMap.get(sub.linkedAccountId);
      if (!acc) continue;
      evts.push({
        day: 1,
        type: 'subscription',
        label: sub.name,
        amount: sub.amount,
        currency: sub.currency,
        accountId: sub.linkedAccountId,
        accountName: acc.name,
        direction: 'out',
      });
    }

    // Debt payments (day 1)
    for (const debt of debtAccounts) {
      if (!debt.linkedAccountId || !debt.monthlyPayment) continue;
      const acc = accountMap.get(debt.linkedAccountId);
      if (!acc) continue;
      evts.push({
        day: 1,
        type: 'debt',
        label: `${debt.name} payment`,
        amount: debt.monthlyPayment,
        currency: debt.currency,
        accountId: debt.linkedAccountId,
        accountName: acc.name,
        direction: 'out',
      });
    }

    // Variable spending already recorded this month (from checking accounts)
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

    // Sort by day
    evts.sort((a, b) => a.day - b.day || (a.direction === 'in' ? -1 : 1));

    // Calculate end balances
    for (const evt of evts) {
      const acc = accountMap.get(evt.accountId);
      if (!acc) continue;
      const current = balances.get(evt.accountId) ?? 0;
      // Convert if currencies differ
      let amountInAccCurrency = evt.amount;
      if (evt.currency !== acc.currency) {
        if (evt.currency === 'USD' && acc.currency === 'COP') {
          amountInAccCurrency = evt.amount * exchangeRate;
        } else if (evt.currency === 'COP' && acc.currency === 'USD') {
          amountInAccCurrency = evt.amount / exchangeRate;
        }
      }
      const newBalance = evt.direction === 'in'
        ? current + amountInAccCurrency
        : current - amountInAccCurrency;
      balances.set(evt.accountId, newBalance);
    }

    const states: AccountState[] = checkingAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      color: acc.color,
      startBalance: acc.currentBalance,
      endBalance: balances.get(acc.id) ?? acc.currentBalance,
    }));

    return { events: evts, accountStates: states };
  }, [simulated, checkingAccounts, incomeSources, fixedExpenses, subscriptions, debtAccounts, spending, selectedMonth, exchangeRate]);

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

  // Stats
  const linkedIncome = incomeSources.filter(s => s.linkedAccountId && s.isRecurring);
  const linkedExpenses = fixedExpenses.filter(e => e.linkedAccountId);
  const linkedSubs = subscriptions.filter(s => s.linkedAccountId && s.active);
  const linkedDebt = debtAccounts.filter(d => d.linkedAccountId && d.monthlyPayment);
  const unlinkedIncome = incomeSources.filter(s => !s.linkedAccountId && s.isRecurring);
  const unlinkedExpenses = fixedExpenses.filter(e => !e.linkedAccountId);
  const unlinkedSubs = subscriptions.filter(s => !s.linkedAccountId && s.active);
  const unlinkedDebt = debtAccounts.filter(d => !d.linkedAccountId);

  const totalIn = events.filter(e => e.direction === 'in').reduce((sum, e) => {
    const acc = checkingAccounts.find(a => a.id === e.accountId);
    if (!acc) return sum;
    if (e.currency === acc.currency) return sum + e.amount;
    return sum + (e.currency === 'USD' ? e.amount * exchangeRate : e.amount / exchangeRate);
  }, 0);

  const totalOut = events.filter(e => e.direction === 'out').reduce((sum, e) => {
    const acc = checkingAccounts.find(a => a.id === e.accountId);
    if (!acc) return sum;
    if (e.currency === acc.currency) return sum + e.amount;
    return sum + (e.currency === 'USD' ? e.amount * exchangeRate : e.amount / exchangeRate);
  }, 0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto pb-28 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Cash Flow Simulation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simulate monthly cash flow for {formatMonthLabel(selectedMonth)}
        </p>
      </div>

      {/* Linked Overview */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Simulation Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checkingAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No checking accounts. Add them in Monthly first.</p>
          ) : (
            checkingAccounts.map(acc => (
              <div key={acc.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                  <span className="text-sm font-medium">{acc.name}</span>
                  <Badge variant="outline" className="text-[10px]">{acc.currency}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{formatCurrency(acc.currentBalance, acc.currency)}</span>
                </div>
                <div className="pl-5 space-y-0.5">
                  {linkedIncome.filter(s => s.linkedAccountId === acc.id).map(s => (
                    <RuleRow key={s.id} direction="in" label={s.name} detail={`Day ${s.depositDay}`} amount={formatCurrency(s.amount, s.currency)} />
                  ))}
                  {linkedExpenses.filter(e => e.linkedAccountId === acc.id).map(e => (
                    <RuleRow key={e.id} direction="out" label={e.name} detail={e.category} amount={formatCurrency(e.amount, e.currency)} />
                  ))}
                  {linkedSubs.filter(s => s.linkedAccountId === acc.id).map(s => (
                    <RuleRow key={s.id} direction="out" label={s.name} detail="subscription" amount={formatCurrency(s.amount, s.currency)} />
                  ))}
                  {linkedDebt.filter(d => d.linkedAccountId === acc.id).map(d => (
                    <RuleRow key={d.id} direction="out" label={d.name} detail="debt payment" amount={formatCurrency(d.monthlyPayment, d.currency)} />
                  ))}
                  {linkedIncome.filter(s => s.linkedAccountId === acc.id).length === 0 &&
                   linkedExpenses.filter(e => e.linkedAccountId === acc.id).length === 0 &&
                   linkedSubs.filter(s => s.linkedAccountId === acc.id).length === 0 &&
                   linkedDebt.filter(d => d.linkedAccountId === acc.id).length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">No rules linked to this account</p>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Unlinked items warning */}
          {(unlinkedIncome.length > 0 || unlinkedExpenses.length > 0 || unlinkedSubs.length > 0 || unlinkedDebt.length > 0) && (
            <>
              <Separator />
              <div>
                <p className="text-[11px] text-warning font-medium mb-1">Not linked to any account:</p>
                <div className="pl-2 space-y-0.5">
                  {unlinkedIncome.map(s => (
                    <p key={s.id} className="text-[11px] text-muted-foreground">{s.name} (income)</p>
                  ))}
                  {unlinkedExpenses.map(e => (
                    <p key={e.id} className="text-[11px] text-muted-foreground">{e.name} (expense)</p>
                  ))}
                  {unlinkedSubs.map(s => (
                    <p key={s.id} className="text-[11px] text-muted-foreground">{s.name} (subscription)</p>
                  ))}
                  {unlinkedDebt.map(d => (
                    <p key={d.id} className="text-[11px] text-muted-foreground">{d.name} (debt)</p>
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
                <p className="text-xs text-muted-foreground text-center py-4">No events to simulate. Link items to checking accounts first.</p>
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

function RuleRow({ direction, label, detail, amount }: { direction: 'in' | 'out'; label: string; detail: string; amount: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {direction === 'in' ? (
        <ArrowDownCircle className="w-3 h-3 text-income shrink-0" />
      ) : (
        <ArrowUpCircle className="w-3 h-3 text-destructive shrink-0" />
      )}
      <span className="truncate">{label}</span>
      <span className="text-muted-foreground shrink-0">{detail}</span>
      <span className={`ml-auto font-medium shrink-0 ${direction === 'in' ? 'text-income' : 'text-destructive'}`}>
        {direction === 'in' ? '+' : '-'}{amount}
      </span>
    </div>
  );
}
