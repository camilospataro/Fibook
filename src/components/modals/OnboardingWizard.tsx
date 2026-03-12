import { useState } from 'react';
import { ChevronRight, ChevronLeft, Plus, Trash2, Landmark, CreditCard, DollarSign, Receipt, Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore } from '@/store/useFinanceStore';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = ['#00D4AA', '#4F8EF7', '#FBBF24', '#FF6B6B', '#A78BFA', '#F472B6', '#34D399', '#FB923C'];

interface CheckingDraft {
  name: string;
  currency: 'COP' | 'USD';
  currentBalance: string;
  color: string;
}

interface DebtDraft {
  name: string;
  currency: 'COP' | 'USD';
  currentBalance: string;
  monthlyPayment: string;
  color: string;
}

interface IncomeDraft {
  name: string;
  amount: string;
  currency: 'COP' | 'USD';
  depositDay: string;
}

interface ExpenseDraft {
  name: string;
  amount: string;
  currency: 'COP' | 'USD';
  category: 'housing' | 'food' | 'transport' | 'entertainment' | 'health' | 'other';
}

const STEPS = [
  { key: 'welcome', label: 'Welcome', icon: Check },
  { key: 'checking', label: 'Checking', icon: Landmark },
  { key: 'debt', label: 'Debt', icon: CreditCard },
  { key: 'income', label: 'Income', icon: DollarSign },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'done', label: 'Done', icon: Check },
];

export default function OnboardingWizard({ open, onOpenChange }: Props) {
  const store = useFinanceStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Drafts
  const [checkingAccounts, setCheckingAccounts] = useState<CheckingDraft[]>([
    { name: '', currency: 'COP', currentBalance: '', color: COLORS[0] },
  ]);
  const [debtAccounts, setDebtAccounts] = useState<DebtDraft[]>([
    { name: '', currency: 'COP', currentBalance: '', monthlyPayment: '', color: COLORS[2] },
  ]);
  const [incomeSources, setIncomeSources] = useState<IncomeDraft[]>([
    { name: '', amount: '', currency: 'COP', depositDay: '1' },
  ]);
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([
    { name: '', amount: '', currency: 'COP', category: 'housing' },
  ]);

  function addChecking() {
    setCheckingAccounts([...checkingAccounts, { name: '', currency: 'COP', currentBalance: '', color: COLORS[checkingAccounts.length % COLORS.length] }]);
  }
  function removeChecking(i: number) {
    setCheckingAccounts(checkingAccounts.filter((_, idx) => idx !== i));
  }
  function updateChecking(i: number, field: keyof CheckingDraft, value: string) {
    const updated = [...checkingAccounts];
    updated[i] = { ...updated[i], [field]: value };
    setCheckingAccounts(updated);
  }

  function addDebt() {
    setDebtAccounts([...debtAccounts, { name: '', currency: 'COP', currentBalance: '', monthlyPayment: '', color: COLORS[(debtAccounts.length + 2) % COLORS.length] }]);
  }
  function removeDebt(i: number) {
    setDebtAccounts(debtAccounts.filter((_, idx) => idx !== i));
  }
  function updateDebt(i: number, field: keyof DebtDraft, value: string) {
    const updated = [...debtAccounts];
    updated[i] = { ...updated[i], [field]: value };
    setDebtAccounts(updated);
  }

  function addIncome() {
    setIncomeSources([...incomeSources, { name: '', amount: '', currency: 'COP', depositDay: '1' }]);
  }
  function removeIncome(i: number) {
    setIncomeSources(incomeSources.filter((_, idx) => idx !== i));
  }
  function updateIncome(i: number, field: keyof IncomeDraft, value: string) {
    const updated = [...incomeSources];
    updated[i] = { ...updated[i], [field]: value };
    setIncomeSources(updated);
  }

  function addExpense() {
    setExpenses([...expenses, { name: '', amount: '', currency: 'COP', category: 'other' }]);
  }
  function removeExpense(i: number) {
    setExpenses(expenses.filter((_, idx) => idx !== i));
  }
  function updateExpense(i: number, field: keyof ExpenseDraft, value: string) {
    const updated = [...expenses];
    updated[i] = { ...updated[i], [field]: value };
    setExpenses(updated);
  }

  async function handleFinish() {
    setSaving(true);
    try {
      // Add checking accounts
      for (const a of checkingAccounts) {
        if (!a.name.trim()) continue;
        await store.addCheckingAccount({
          name: a.name.trim(),
          currency: a.currency,
          currentBalance: Number(a.currentBalance) || 0,
          color: a.color,
        });
      }
      // Add debt accounts
      for (const d of debtAccounts) {
        if (!d.name.trim()) continue;
        await store.addDebtAccount({
          name: d.name.trim(),
          currency: d.currency,
          currentBalance: Number(d.currentBalance) || 0,
          minimumMonthlyPayment: Number(d.monthlyPayment) || 0,
          monthlyPayment: Number(d.monthlyPayment) || 0,
          color: d.color,
          linkedAccountId: null,
        });
      }
      // Add income sources
      for (const inc of incomeSources) {
        if (!inc.name.trim()) continue;
        await store.addIncomeSource({
          name: inc.name.trim(),
          amount: Number(inc.amount) || 0,
          currency: inc.currency,
          isRecurring: true,
          linkedAccountId: null,
          depositDay: Number(inc.depositDay) || 1,
        });
      }
      // Add fixed expenses
      for (const exp of expenses) {
        if (!exp.name.trim()) continue;
        await store.addFixedExpense({
          name: exp.name.trim(),
          amount: Number(exp.amount) || 0,
          currency: exp.currency,
          category: exp.category,
          linkedAccountId: null,
          paymentDay: 1,
          paymentMode: 'manual',
        });
      }
      toast.success('Setup complete! Your accounts are ready.');
      setStep(5); // done step
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup failed');
    }
    setSaving(false);
  }

  function handleClose() {
    onOpenChange(false);
    // Reset after close
    setTimeout(() => {
      setStep(0);
      setCheckingAccounts([{ name: '', currency: 'COP', currentBalance: '', color: COLORS[0] }]);
      setDebtAccounts([{ name: '', currency: 'COP', currentBalance: '', monthlyPayment: '', color: COLORS[2] }]);
      setIncomeSources([{ name: '', amount: '', currency: 'COP', depositDay: '1' }]);
      setExpenses([{ name: '', amount: '', currency: 'COP', category: 'housing' }]);
    }, 300);
  }

  const canGoNext = () => {
    if (step === 0) return true; // welcome
    if (step === 1) return checkingAccounts.some(a => a.name.trim()); // at least one checking
    if (step === 2) return true; // debt is optional
    if (step === 3) return true; // income is optional
    if (step === 4) return true; // expenses optional
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Progress bar */}
        <div className="flex items-center gap-1 px-6 pt-6">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-2">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4 text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
                Welcome to FinanceOS
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Let's set up your financial picture in a few quick steps. You'll add your bank accounts,
                debts, income, and main expenses. You can always edit these later.
              </p>
            </div>
          )}

          {/* Step 1: Checking Accounts */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Landmark className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">Checking Accounts</h2>
                  <p className="text-xs text-muted-foreground">Your bank accounts where money comes in and out</p>
                </div>
              </div>
              <div className="space-y-3">
                {checkingAccounts.map((a, i) => (
                  <div key={i} className="p-3 bg-secondary/50 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Account {i + 1}</span>
                      {checkingAccounts.length > 1 && (
                        <button type="button" onClick={() => removeChecking(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Input
                          placeholder="Account name"
                          value={a.name}
                          onChange={e => updateChecking(i, 'name', e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Balance</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={a.currentBalance}
                          onChange={e => updateChecking(i, 'currentBalance', e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Currency</Label>
                        <Select value={a.currency} onValueChange={v => updateChecking(i, 'currency', v)}>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COP">COP</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addChecking} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Another Account
              </Button>
            </div>
          )}

          {/* Step 2: Debt Accounts */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <CreditCard className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">Debt Accounts</h2>
                  <p className="text-xs text-muted-foreground">Credit cards and loans you're paying off</p>
                </div>
              </div>
              <div className="space-y-3">
                {debtAccounts.map((d, i) => (
                  <div key={i} className="p-3 bg-secondary/50 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Debt {i + 1}</span>
                      {debtAccounts.length > 1 && (
                        <button type="button" onClick={() => removeDebt(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Card or loan name"
                      value={d.name}
                      onChange={e => updateDebt(i, 'name', e.target.value)}
                      className="bg-background border-border"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Balance</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={d.currentBalance}
                          onChange={e => updateDebt(i, 'currentBalance', e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Monthly Payment</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={d.monthlyPayment}
                          onChange={e => updateDebt(i, 'monthlyPayment', e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Currency</Label>
                        <Select value={d.currency} onValueChange={v => updateDebt(i, 'currency', v)}>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COP">COP</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addDebt} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Another Debt
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                No debts? Just leave it blank and continue.
              </p>
            </div>
          )}

          {/* Step 3: Income */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-income/10">
                  <DollarSign className="w-4 h-4 text-income" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">Income Sources</h2>
                  <p className="text-xs text-muted-foreground">Your salary, freelance, or other recurring income</p>
                </div>
              </div>
              <div className="space-y-3">
                {incomeSources.map((inc, i) => (
                  <div key={i} className="p-3 bg-secondary/50 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Income {i + 1}</span>
                      {incomeSources.length > 1 && (
                        <button type="button" onClick={() => removeIncome(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="e.g. Salary, Freelance"
                      value={inc.name}
                      onChange={e => updateIncome(i, 'name', e.target.value)}
                      className="bg-background border-border"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Amount</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={inc.amount}
                          onChange={e => updateIncome(i, 'amount', e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Deposit Day</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={inc.depositDay}
                          onChange={e => updateIncome(i, 'depositDay', e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Currency</Label>
                        <Select value={inc.currency} onValueChange={v => updateIncome(i, 'currency', v)}>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COP">COP</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addIncome} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Another Source
              </Button>
            </div>
          )}

          {/* Step 4: Fixed Expenses */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-warning/10">
                  <Receipt className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">Fixed Expenses</h2>
                  <p className="text-xs text-muted-foreground">Rent, utilities, insurance — things you pay every month</p>
                </div>
              </div>
              <div className="space-y-3">
                {expenses.map((exp, i) => (
                  <div key={i} className="p-3 bg-secondary/50 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Expense {i + 1}</span>
                      {expenses.length > 1 && (
                        <button type="button" onClick={() => removeExpense(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="e.g. Rent, Electricity"
                      value={exp.name}
                      onChange={e => updateExpense(i, 'name', e.target.value)}
                      className="bg-background border-border"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Amount</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={exp.amount}
                          onChange={e => updateExpense(i, 'amount', e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Category</Label>
                        <Select value={exp.category} onValueChange={v => updateExpense(i, 'category', v)}>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="housing">Housing</SelectItem>
                            <SelectItem value="food">Food</SelectItem>
                            <SelectItem value="transport">Transport</SelectItem>
                            <SelectItem value="entertainment">Entertainment</SelectItem>
                            <SelectItem value="health">Health</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Currency</Label>
                        <Select value={exp.currency} onValueChange={v => updateExpense(i, 'currency', v)}>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COP">COP</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addExpense} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Another Expense
              </Button>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 5 && (
            <div className="space-y-4 text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
                You're all set!
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Your accounts are configured. Head to the Dashboard to see your financial overview,
                or go to Monthly to fine-tune details like subscriptions, savings goals, and account linking.
              </p>
              <Button onClick={handleClose} className="w-full mt-4">
                Go to Dashboard
              </Button>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 5 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              ) : (
                <div />
              )}
              {step < 4 ? (
                <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canGoNext()}>
                  {step === 0 ? "Let's Go" : 'Next'} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleFinish} disabled={saving}>
                  {saving ? 'Setting up...' : 'Finish Setup'} <Check className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
