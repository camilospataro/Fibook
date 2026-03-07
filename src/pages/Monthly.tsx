import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, getCurrentMonth, formatMonthLabel } from '@/lib/formatters';
import { totalFixedExpenses, totalSubscriptionsCOP } from '@/lib/calculations';
import { toast } from 'sonner';

export default function Monthly() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subs = useFinanceStore(s => s.subscriptions);
  const spending = useFinanceStore(s => s.spending);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const saveSnapshot = useFinanceStore(s => s.saveSnapshot);
  const updateDebtAccount = useFinanceStore(s => s.updateDebtAccount);

  const currentMonth = getCurrentMonth();

  // Section A: Debt balances
  const [debtBalances, setDebtBalances] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map(a => [a.id, String(a.currentBalance)]))
  );

  // Section B: Income
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(incomeSources.map(s => [s.id, String(s.amount)]))
  );
  const [sideIncome, setSideIncome] = useState('0');

  // Section C: New credit card charges (auto-calculated from spending)
  const monthlySpending = useMemo(
    () => spending.filter(e => e.date.startsWith(currentMonth)),
    [spending, currentMonth]
  );
  const ccCharges = useMemo(() => {
    return monthlySpending
      .filter(e => e.paymentMethod.startsWith('credit_'))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [monthlySpending]);

  // Section D: CC payment
  const [ccPayment, setCcPayment] = useState('0');

  // Recap modal
  const [showRecap, setShowRecap] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calculations
  const totalIncome = Object.values(incomeAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (Number(sideIncome) || 0);
  const fixed = totalFixedExpenses(fixedExpenses);
  const subsCost = totalSubscriptionsCOP(subs, exchangeRate);
  const totalSpending = monthlySpending.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = fixed + subsCost + totalSpending;
  const balance = totalIncome - totalExpenses;
  const debtPaid = Number(ccPayment) || 0;

  async function handleSave() {
    setSaving(true);

    // Update debt balances in store
    for (const acc of accounts) {
      const newBalance = Number(debtBalances[acc.id]) || 0;
      if (newBalance !== acc.currentBalance) {
        await updateDebtAccount(acc.id, { currentBalance: newBalance });
      }
    }

    await saveSnapshot({
      month: currentMonth,
      debtBalances: accounts.map(a => ({ accountId: a.id, balance: Number(debtBalances[a.id]) || 0 })),
      incomeEntries: incomeSources.map(s => ({ sourceId: s.id, amount: Number(incomeAmounts[s.id]) || 0 })),
      sideIncome: Number(sideIncome) || 0,
      totalIncome,
      totalExpenses,
      totalDebtPaid: debtPaid,
      newCharges: ccCharges,
      balance,
      cashOnHand: Math.max(0, balance),
      savings: Math.max(0, balance - debtPaid),
    });

    toast.success('Monthly snapshot saved!');
    setSaving(false);
    setShowRecap(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">
        Monthly Update — {formatMonthLabel(currentMonth)}
      </h1>

      {/* Section A: Debt Balances */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">A. Update Debt Balances</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
              <Label className="flex-1 text-sm">{acc.name} ({acc.currency})</Label>
              <Input
                type="number"
                value={debtBalances[acc.id] ?? ''}
                onChange={e => setDebtBalances(p => ({ ...p, [acc.id]: e.target.value }))}
                className="w-40 bg-secondary border-border text-right"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section B: Income */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">B. Income This Month</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {incomeSources.map(src => (
            <div key={src.id} className="flex items-center gap-3">
              <Label className="flex-1 text-sm">{src.name}</Label>
              <Input
                type="number"
                value={incomeAmounts[src.id] ?? ''}
                onChange={e => setIncomeAmounts(p => ({ ...p, [src.id]: e.target.value }))}
                className="w-40 bg-secondary border-border text-right"
              />
            </div>
          ))}
          <Separator />
          <div className="flex items-center gap-3">
            <Label className="flex-1 text-sm">Side Income</Label>
            <Input
              type="number"
              value={sideIncome}
              onChange={e => setSideIncome(e.target.value)}
              className="w-40 bg-secondary border-border text-right"
            />
          </div>
          <div className="flex justify-between text-sm font-bold pt-2">
            <span>Total Income</span>
            <span className="text-income">{formatCOP(totalIncome)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Section C: CC Charges */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">C. New Credit Card Charges</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">Auto-calculated from spending entries paid with credit cards this month.</p>
          <p className="text-xl font-bold text-warning">{formatCOP(ccCharges)}</p>
        </CardContent>
      </Card>

      {/* Section D: CC Payment */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">D. Credit Card Payment Applied</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label className="flex-1 text-sm">Total paid towards CC debt</Label>
            <Input
              type="number"
              value={ccPayment}
              onChange={e => setCcPayment(e.target.value)}
              className="w-40 bg-secondary border-border text-right"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">E. Month Summary</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Total Income</span><span className="text-income">{formatCOP(totalIncome)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Fixed Expenses</span><span>{formatCOP(fixed)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Subscriptions</span><span>{formatCOP(subsCost)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Variable Spending</span><span>{formatCOP(totalSpending)}</span></div>
          <Separator />
          <div className="flex justify-between font-bold"><span>Balance</span><span className={balance >= 0 ? 'text-income' : 'text-destructive'}>{formatCOP(balance)}</span></div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full" size="lg" disabled={saving}>
        {saving ? 'Saving...' : 'Save Month Snapshot'}
      </Button>

      {/* Recap Modal */}
      <Dialog open={showRecap} onOpenChange={setShowRecap}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-display)]">Month Recap</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="text-income font-bold">{formatCOP(totalIncome)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span className="text-destructive font-bold">{formatCOP(totalExpenses)}</span></div>
            <Separator />
            <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className={`font-bold ${balance >= 0 ? 'text-income' : 'text-destructive'}`}>{formatCOP(balance)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Debt Paid</span><span className="text-info font-bold">{formatCOP(debtPaid)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">New CC Charges</span><span className="text-warning font-bold">{formatCOP(ccCharges)}</span></div>
          </div>
          <Button onClick={() => setShowRecap(false)} className="w-full mt-4">Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
