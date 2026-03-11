import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Pencil, Receipt, CreditCard, Repeat, DollarSign, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, PiggyBank, Sparkles, Landmark } from 'lucide-react';
import AiUpdateSheet from '@/components/modals/AiUpdateSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatCurrency, getCurrentMonth, formatMonthLabel } from '@/lib/formatters';
import { totalFixedExpenses, totalSubscriptionsCOP, totalMinimumPaymentsCOP } from '@/lib/calculations';
import { toast } from 'sonner';
import MoneyFlowSankey from '@/components/charts/MoneyFlowSankey';
import MoneyWaterfall from '@/components/charts/MoneyWaterfall';
import type { ExpenseCategory } from '@/types';

const DEBT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
const CHECKING_COLORS = ['#00D4AA', '#4ECDC4', '#45B7D1', '#96CEB4', '#4F8EF7', '#FBBF24', '#DDA0DD', '#F7DC6F'];
const expenseCategories: { value: ExpenseCategory; label: string }[] = [
  { value: 'housing', label: 'Housing' }, { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' }, { value: 'entertainment', label: 'Entertainment' },
  { value: 'health', label: 'Health' }, { value: 'other', label: 'Other' },
];

export default function Monthly() {
  const store = useFinanceStore();
  const { debtAccounts: accounts, checkingAccounts, incomeSources, fixedExpenses, subscriptions: subs, spending } = store;
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const savingsTarget = useFinanceStore(s => s.settings?.savingsTarget ?? 0);
  const saveSnapshot = useFinanceStore(s => s.saveSnapshot);
  const updateDebtAccount = useFinanceStore(s => s.updateDebtAccount);
  const updateIncomeSource = useFinanceStore(s => s.updateIncomeSource);
  const updateSavingsTarget = useFinanceStore(s => s.updateSavingsTarget);

  const [aiUpdateOpen, setAiUpdateOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const currentMonth = selectedMonth;

  function shiftMonth(delta: number) {
    setSelectedMonth(prev => {
      const [y, m] = prev.split('-').map(Number);
      const d = new Date(y, m - 1 + delta);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }

  // Tab view
  const [activeTab, setActiveTab] = useState<'balances' | 'movements'>('balances');
  const [flowView, setFlowView] = useState<'sankey' | 'waterfall'>('sankey');

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    expenses: true, subscriptions: true, debt: true, checking: true, income: true, debtPayments: true,
  });
  const toggle = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  // Debt balances
  const [debtBalances, setDebtBalances] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map(a => [a.id, String(a.currentBalance)]))
  );

  // Income
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(incomeSources.map(s => [s.id, String(s.amount)]))
  );
  const snapshots = useFinanceStore(s => s.snapshots);
  const currentSnapshot = useMemo(() => snapshots.find(s => s.month === currentMonth), [snapshots, currentMonth]);
  const [sideIncome, setSideIncome] = useState(() => String(currentSnapshot?.sideIncome ?? 0));

  // Reset side income when month changes
  useEffect(() => {
    const snap = snapshots.find(s => s.month === currentMonth);
    setSideIncome(String(snap?.sideIncome ?? 0));
  }, [currentMonth, snapshots]);

  // CC charges & payment
  const monthlySpending = useMemo(
    () => spending.filter(e => e.date.startsWith(currentMonth)),
    [spending, currentMonth]
  );
  const ccCharges = useMemo(() =>
    monthlySpending.filter(e => e.paymentMethod.startsWith('credit_')).reduce((sum, e) => sum + e.amount, 0),
    [monthlySpending]
  );
  const [ccPayments, setCcPayments] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map(a => [a.id, String(a.monthlyPayment || 0)]))
  );

  // Auto-save on blur
  function saveDebtBalance(accId: string) {
    const acc = accounts.find(a => a.id === accId);
    const newVal = Number(debtBalances[accId]) || 0;
    if (acc && newVal !== acc.currentBalance) {
      updateDebtAccount(accId, { currentBalance: newVal });
    }
  }
  function saveIncomeAmount(srcId: string) {
    const src = incomeSources.find(s => s.id === srcId);
    const newVal = Number(incomeAmounts[srcId]) || 0;
    if (src && newVal !== src.amount) {
      updateIncomeSource(srcId, { amount: newVal });
    }
  }
  function saveCcPayment(accId: string) {
    const acc = accounts.find(a => a.id === accId);
    const newVal = Number(ccPayments[accId]) || 0;
    if (acc && newVal !== acc.monthlyPayment) {
      updateDebtAccount(accId, { monthlyPayment: newVal });
    }
  }

  // Savings
  const [savingsAmount, setSavingsAmount] = useState(String(savingsTarget));
  function saveSavingsTarget() {
    const val = Number(savingsAmount) || 0;
    if (val !== savingsTarget) updateSavingsTarget(val);
  }

  // Add dialogs
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddChecking, setShowAddChecking] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  // New item forms
  const [newExpense, setNewExpense] = useState({ name: '', amount: '', currency: 'COP' as 'COP' | 'USD', category: 'other' as ExpenseCategory, linkedAccountId: null as string | null });
  const [newSub, setNewSub] = useState({ name: '', currency: 'COP' as 'COP' | 'USD', amount: '', group: 'General', active: true, linkedAccountId: null as string | null });
  const [newDebt, setNewDebt] = useState({ name: '', currency: 'COP' as 'COP' | 'USD', currentBalance: '', minimumMonthlyPayment: '', color: DEBT_COLORS[0], linkedAccountId: null as string | null });
  const [newCheckingAcct, setNewCheckingAcct] = useState({ name: '', currency: 'COP' as 'COP' | 'USD', currentBalance: '', color: CHECKING_COLORS[0] });
  const [newIncome, setNewIncome] = useState({ name: '', amount: '', currency: 'COP' as 'COP' | 'USD', isRecurring: true, linkedAccountId: null as string | null, depositDay: 1 });

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const toggleEdit = (id: string) => setEditingId(prev => prev === id ? null : id);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  // Recap
  const [showRecap, setShowRecap] = useState(false);

  // Subscription groups
  const subGroups = useMemo(() => {
    const groups = new Map<string, typeof subs>();
    for (const sub of subs) {
      const g = sub.group || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(sub);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [subs]);
  const existingGroups = useMemo(() => [...new Set(subs.map(s => s.group || 'General'))].sort(), [subs]);

  // Calculations
  const totalIncome = incomeSources.reduce((sum, src) => {
    const amt = Number(incomeAmounts[src.id]) || 0;
    return sum + (src.currency === 'USD' ? amt * exchangeRate : amt);
  }, 0) + (Number(sideIncome) || 0);
  const fixed = totalFixedExpenses(fixedExpenses, exchangeRate);
  const subsCost = totalSubscriptionsCOP(subs, exchangeRate);
  const debtMin = totalMinimumPaymentsCOP(accounts, exchangeRate);
  const totalDebt = accounts.reduce((sum, acc) => {
    const bal = Number(debtBalances[acc.id]) || 0;
    return sum + (acc.currency === 'USD' ? bal * exchangeRate : bal);
  }, 0);
  const totalSpending = monthlySpending.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = fixed + subsCost + totalSpending;
  const savingsVal = Number(savingsAmount) || 0;
  const balance = totalIncome - totalExpenses - savingsVal;
  const debtPaid = accounts.reduce((sum, acc) => {
    const paid = Number(ccPayments[acc.id]) || 0;
    return sum + (acc.currency === 'USD' ? paid * exchangeRate : paid);
  }, 0);
  const totalChecking = checkingAccounts.reduce((sum, acc) =>
    sum + (acc.currency === 'USD' ? acc.currentBalance * exchangeRate : acc.currentBalance), 0);

  // Handlers
  async function handleAddExpense() {
    await store.addFixedExpense({ name: newExpense.name, amount: Number(newExpense.amount), currency: newExpense.currency, category: newExpense.category, linkedAccountId: newExpense.linkedAccountId });
    setNewExpense({ name: '', amount: '', currency: 'COP', category: 'other', linkedAccountId: null });
    setShowAddExpense(false);
    toast.success('Fixed expense added');
  }
  async function handleAddSub() {
    await store.addSubscription({ name: newSub.name, currency: newSub.currency, amount: Number(newSub.amount), group: newSub.group || 'General', active: newSub.active, linkedAccountId: newSub.linkedAccountId });
    setNewSub({ name: '', currency: 'COP', amount: '', group: 'General', active: true, linkedAccountId: null });
    setShowAddSub(false);
    toast.success('Subscription added');
  }
  async function handleAddDebt() {
    await store.addDebtAccount({ name: newDebt.name, currency: newDebt.currency, currentBalance: Number(newDebt.currentBalance), minimumMonthlyPayment: Number(newDebt.minimumMonthlyPayment), color: newDebt.color, linkedAccountId: newDebt.linkedAccountId });
    setNewDebt({ name: '', currency: 'COP', currentBalance: '', minimumMonthlyPayment: '', color: DEBT_COLORS[accounts.length % DEBT_COLORS.length], linkedAccountId: null });
    setShowAddDebt(false);
    toast.success('Debt account added');
  }
  async function handleAddCheckingAcct() {
    await store.addCheckingAccount({ name: newCheckingAcct.name, currency: newCheckingAcct.currency, currentBalance: Number(newCheckingAcct.currentBalance), color: newCheckingAcct.color });
    setNewCheckingAcct({ name: '', currency: 'COP', currentBalance: '', color: CHECKING_COLORS[checkingAccounts.length % CHECKING_COLORS.length] });
    setShowAddChecking(false);
    toast.success('Checking account added');
  }
  async function handleAddIncome() {
    await store.addIncomeSource({ name: newIncome.name, amount: Number(newIncome.amount), currency: newIncome.currency, isRecurring: newIncome.isRecurring, linkedAccountId: newIncome.linkedAccountId, depositDay: newIncome.depositDay });
    setNewIncome({ name: '', amount: '', currency: 'COP', isRecurring: true, linkedAccountId: null, depositDay: 1 });
    setShowAddIncome(false);
    toast.success('Income source added');
  }
  async function handleDelete() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === 'debt') await store.deleteDebtAccount(id);
    else if (type === 'checking') await store.deleteCheckingAccount(id);
    else if (type === 'income') await store.deleteIncomeSource(id);
    else if (type === 'expense') await store.deleteFixedExpense(id);
    else if (type === 'sub') await store.deleteSubscription(id);
    setDeleteConfirm(null);
    toast.success('Deleted');
  }

  // Auto-save snapshot (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const autoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSnapshot({
        month: currentMonth,
        debtBalances: accounts.map(a => ({ accountId: a.id, balance: Number(debtBalances[a.id]) || 0 })),
        incomeEntries: incomeSources.map(s => ({ sourceId: s.id, amount: Number(incomeAmounts[s.id]) || 0 })),
        sideIncome: Number(sideIncome) || 0,
        totalIncome, totalExpenses, totalDebtPaid: debtPaid, newCharges: ccCharges,
        balance, cashOnHand: Math.max(0, balance), savings: Number(savingsAmount) || 0,
      });
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalIncome, totalExpenses, debtPaid, ccCharges, balance, savingsAmount, sideIncome, debtBalances, incomeAmounts, currentMonth]);

  // Trigger auto-save when calculated values change
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    autoSave();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [autoSave]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto pb-28 md:pb-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Monthly Update</h1>
          <Button
            size="sm"
            onClick={() => setAiUpdateOpen(true)}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI Update</span>
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button onClick={() => shiftMonth(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className={`text-sm min-w-[140px] text-center font-medium ${currentMonth === getCurrentMonth() ? 'text-primary' : 'text-muted-foreground'}`}>
            {formatMonthLabel(currentMonth)}{currentMonth === getCurrentMonth() && ' (now)'}
          </span>
          <button onClick={() => shiftMonth(1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex rounded-lg bg-secondary/50 p-1 gap-1">
        <button
          onClick={() => setActiveTab('balances')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'balances'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Landmark className="w-4 h-4" />
          Balances
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'movements'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Repeat className="w-4 h-4" />
          Movements
        </button>
      </div>

      {/* ==================== BALANCES TAB ==================== */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          {/* Checking Accounts */}
          <SectionCard
            icon={Landmark}
            title="Checking Accounts"
            subtitle={formatCOP(totalChecking)}
            subtitleColor="text-primary"
            open={openSections.checking}
            onToggle={() => toggle('checking')}
            onAdd={() => setShowAddChecking(true)}
          >
            {checkingAccounts.length === 0 && <EmptyState text="No checking accounts yet" />}
            {checkingAccounts.map(acc => (
              <div key={acc.id} className="border-b border-border/50 last:border-0">
                <div className="flex items-center justify-between py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                    <span className="text-sm truncate">{acc.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{acc.currency}</Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <MoneyInput
                      value={String(acc.currentBalance)}
                      onChange={v => store.updateCheckingAccount(acc.id, { currentBalance: Number(v) || 0 })}
                      onBlur={() => {}}
                    />
                    <button onClick={() => toggleEdit(acc.id)} className={`p-1.5 text-muted-foreground hover:text-primary transition-colors ${editingId === acc.id ? 'text-primary' : ''}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'checking', id: acc.id, name: acc.name })} className="p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {editingId === acc.id && (
                  <div className="pb-3 pt-1 pl-5 grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-muted-foreground">Name</label><Input defaultValue={acc.name} onBlur={e => { if (e.target.value !== acc.name) store.updateCheckingAccount(acc.id, { name: e.target.value }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                    <div><label className="text-[10px] text-muted-foreground">Currency</label>
                      <Select value={acc.currency} onValueChange={v => store.updateCheckingAccount(acc.id, { currency: v as 'COP' | 'USD' })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                    <div><label className="text-[10px] text-muted-foreground">Color</label>
                      <div className="flex gap-1 flex-wrap pt-1">{CHECKING_COLORS.map(c => (<button key={c} onClick={() => store.updateCheckingAccount(acc.id, { color: c })} className={`w-5 h-5 rounded-full border-2 ${acc.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div></div>
                  </div>
                )}
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Monthly savings goal</span>
              <MoneyInput
                value={savingsAmount}
                onChange={setSavingsAmount}
                onBlur={saveSavingsTarget}
              />
            </div>
          </SectionCard>

          {/* Debt Balances */}
          <SectionCard
            icon={CreditCard}
            title="Debt Balances"
            subtitle={formatCOP(totalDebt)}
            open={openSections.debt}
            onToggle={() => toggle('debt')}
            onAdd={() => setShowAddDebt(true)}
          >
            {accounts.length === 0 && <EmptyState text="No debt accounts" />}
            {accounts.map(acc => (
              <div key={acc.id} className="border-b border-border/50 last:border-0">
                <div className="flex items-center justify-between py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                    <span className="text-sm truncate">{acc.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{acc.currency}</Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <MoneyInput
                      value={debtBalances[acc.id] ?? String(acc.currentBalance)}
                      onChange={v => setDebtBalances(p => ({ ...p, [acc.id]: v }))}
                      onBlur={() => saveDebtBalance(acc.id)}
                    />
                    <button onClick={() => toggleEdit(acc.id)} className={`p-1.5 text-muted-foreground hover:text-primary transition-colors ${editingId === acc.id ? 'text-primary' : ''}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'debt', id: acc.id, name: acc.name })} className="p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {editingId === acc.id && (
                  <div className="pb-3 pt-1 pl-5 grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-muted-foreground">Name</label><Input defaultValue={acc.name} onBlur={e => { if (e.target.value !== acc.name) store.updateDebtAccount(acc.id, { name: e.target.value }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                    <div><label className="text-[10px] text-muted-foreground">Currency</label>
                      <Select value={acc.currency} onValueChange={v => store.updateDebtAccount(acc.id, { currency: v as 'COP' | 'USD' })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                    <div><label className="text-[10px] text-muted-foreground">Color</label>
                      <div className="flex gap-1 flex-wrap pt-1">{DEBT_COLORS.map(c => (<button key={c} onClick={() => store.updateDebtAccount(acc.id, { color: c })} className={`w-5 h-5 rounded-full border-2 ${acc.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div></div>
                  </div>
                )}
              </div>
            ))}
          </SectionCard>

          {/* Net Worth Summary */}
          <Card className="bg-card border-primary/20 border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Balance Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SummaryRow label="Total Checking" value={formatCOP(totalChecking)} color="text-primary" />
              <SummaryRow label="Total Debt" value={formatCOP(totalDebt)} color="text-destructive" />
              <SummaryRow label="Savings Goal" value={formatCOP(Number(savingsAmount) || 0)} color="text-primary" />
              <Separator />
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>Net Position</span>
                <span className={totalChecking - totalDebt >= 0 ? 'text-income' : 'text-destructive'}>
                  {formatCOP(totalChecking - totalDebt)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== MOVEMENTS TAB ==================== */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Flow Chart Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFlowView('sankey')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                flowView === 'sankey' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Flow
            </button>
            <button
              onClick={() => setFlowView('waterfall')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                flowView === 'waterfall' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Waterfall
            </button>
          </div>

          {/* Flow Charts */}
          {flowView === 'sankey' ? (
            <MoneyFlowSankey
              incomeSources={incomeSources}
              incomeAmounts={incomeAmounts}
              sideIncome={Number(sideIncome) || 0}
              fixedExpenses={fixedExpenses}
              subscriptions={subs}
              debtAccounts={accounts}
              ccPayments={ccPayments}
              checkingAccounts={checkingAccounts}
              savingsGoal={Number(savingsAmount) || 0}
              variableSpending={totalSpending}
              exchangeRate={exchangeRate}
            />
          ) : (
            <MoneyWaterfall
              incomeSources={incomeSources}
              incomeAmounts={incomeAmounts}
              sideIncome={Number(sideIncome) || 0}
              fixedExpenses={fixedExpenses}
              subscriptions={subs}
              debtAccounts={accounts}
              ccPayments={ccPayments}
              savingsGoal={Number(savingsAmount) || 0}
              variableSpending={totalSpending}
              exchangeRate={exchangeRate}
            />
          )}

          {/* Income */}
          <SectionCard
            icon={DollarSign}
            title="Income"
            subtitle={formatCOP(totalIncome)}
            subtitleColor="text-income"
            open={openSections.income}
            onToggle={() => toggle('income')}
            onAdd={() => setShowAddIncome(true)}
          >
            {incomeSources.length === 0 && <EmptyState text="No income sources" />}
            {incomeSources.map(src => (
              <div key={src.id} className="border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm truncate">{src.name}</span>
                    {src.isRecurring && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                    <Badge variant="outline" className="text-[10px]">{src.currency}</Badge>
                  </div>
                  <MoneyInput
                    value={incomeAmounts[src.id] ?? ''}
                    onChange={v => setIncomeAmounts(p => ({ ...p, [src.id]: v }))}
                    onBlur={() => saveIncomeAmount(src.id)}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleEdit(src.id)} className={`p-1.5 text-muted-foreground hover:text-primary transition-colors ${editingId === src.id ? 'text-primary' : ''}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'income', id: src.id, name: src.name })} className="p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {editingId === src.id && (
                  <div className="pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-muted-foreground">Name</label><Input defaultValue={src.name} onBlur={e => { if (e.target.value !== src.name) store.updateIncomeSource(src.id, { name: e.target.value }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                    <div><label className="text-[10px] text-muted-foreground">Currency</label>
                      <Select value={src.currency} onValueChange={v => store.updateIncomeSource(src.id, { currency: v as 'COP' | 'USD' })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                    <div className="sm:col-span-2 flex items-center gap-2"><Switch checked={src.isRecurring} onCheckedChange={v => store.updateIncomeSource(src.id, { isRecurring: v })} /><label className="text-xs text-muted-foreground">Recurring</label></div>
                    <div><label className="text-[10px] text-muted-foreground">Deposit To</label>
                      <Select value={src.linkedAccountId ?? 'none'} onValueChange={v => store.updateIncomeSource(src.id, { linkedAccountId: v === 'none' ? null : v })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-[10px] text-muted-foreground">Deposit Day</label><Input type="number" min="1" max="31" defaultValue={src.depositDay} onBlur={e => { const v = Math.min(31, Math.max(1, Number(e.target.value) || 1)); if (v !== src.depositDay) store.updateIncomeSource(src.id, { depositDay: v }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                  </div>
                )}
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex-1">Side Income</span>
              <Input
                type="number"
                value={sideIncome}
                onChange={e => setSideIncome(e.target.value)}
                className="w-32 bg-secondary border-border text-right text-sm h-8"
              />
              <div className="w-3.5" />
            </div>
          </SectionCard>

          {/* Fixed Expenses */}
          <SectionCard
            icon={Receipt}
            title="Fixed Expenses"
            subtitle={formatCOP(fixed)}
            open={openSections.expenses}
            onToggle={() => toggle('expenses')}
            onAdd={() => setShowAddExpense(true)}
          >
            {fixedExpenses.length === 0 && <EmptyState text="No fixed expenses yet" />}
            {fixedExpenses.map(exp => (
              <ItemRow key={exp.id} onDelete={() => setDeleteConfirm({ type: 'expense', id: exp.id, name: exp.name })}
                onEdit={() => toggleEdit(exp.id)} expanded={editingId === exp.id}
                editContent={
                  <div className="pb-3 pt-1 pl-2 grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-muted-foreground">Name</label><Input defaultValue={exp.name} onBlur={e => { if (e.target.value !== exp.name) store.updateFixedExpense(exp.id, { name: e.target.value }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                    <div><label className="text-[10px] text-muted-foreground">Amount</label><Input type="number" defaultValue={exp.amount} onBlur={e => { const v = Number(e.target.value); if (v !== exp.amount) store.updateFixedExpense(exp.id, { amount: v }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                    <div><label className="text-[10px] text-muted-foreground">Currency</label>
                      <Select value={exp.currency} onValueChange={v => store.updateFixedExpense(exp.id, { currency: v as 'COP' | 'USD' })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                    <div><label className="text-[10px] text-muted-foreground">Category</label>
                      <Select value={exp.category} onValueChange={v => store.updateFixedExpense(exp.id, { category: v as ExpenseCategory })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent>{expenseCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="col-span-2"><label className="text-[10px] text-muted-foreground">Pay From</label>
                      <Select value={exp.linkedAccountId ?? 'none'} onValueChange={v => store.updateFixedExpense(exp.id, { linkedAccountId: v === 'none' ? null : v })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{exp.name}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{exp.category}</Badge>
                  <Badge variant="outline" className="text-[10px] shrink-0">{exp.currency}</Badge>
                </div>
                <span className="text-sm font-medium shrink-0">{formatCurrency(exp.amount, exp.currency)}</span>
              </ItemRow>
            ))}
          </SectionCard>

          {/* Subscriptions */}
          <SectionCard
            icon={Repeat}
            title="Subscriptions"
            subtitle={formatCOP(subsCost)}
            open={openSections.subscriptions}
            onToggle={() => toggle('subscriptions')}
            onAdd={() => setShowAddSub(true)}
          >
            {subs.length === 0 && <EmptyState text="No subscriptions yet" />}
            {subGroups.map(([groupName, groupSubs]) => (
              <div key={groupName}>
                <div className="flex items-center gap-2 mt-2 mb-1 first:mt-0">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</span>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-[11px] text-muted-foreground">
                    {formatCOP(groupSubs.filter(s => s.active).reduce((sum, s) => sum + (s.currency === 'USD' ? s.amount * exchangeRate : s.amount), 0))}
                  </span>
                </div>
                {groupSubs.map(sub => (
                  <ItemRow key={sub.id} onDelete={() => setDeleteConfirm({ type: 'sub', id: sub.id, name: sub.name })}
                    onEdit={() => toggleEdit(sub.id)} expanded={editingId === sub.id}
                    editContent={
                      <div className="pb-3 pt-1 pl-2 grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-muted-foreground">Name</label><Input defaultValue={sub.name} onBlur={e => { if (e.target.value !== sub.name) store.updateSubscription(sub.id, { name: e.target.value }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                        <div><label className="text-[10px] text-muted-foreground">Amount</label><Input type="number" defaultValue={sub.amount} onBlur={e => { const v = Number(e.target.value); if (v !== sub.amount) store.updateSubscription(sub.id, { amount: v }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                        <div><label className="text-[10px] text-muted-foreground">Currency</label>
                          <Select value={sub.currency} onValueChange={v => store.updateSubscription(sub.id, { currency: v as 'COP' | 'USD' })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                        <div><label className="text-[10px] text-muted-foreground">Group</label>
                          <div className="flex gap-1.5">
                            <Select value={existingGroups.includes(sub.group) ? sub.group : '__custom'} onValueChange={v => { if (v !== '__custom') store.updateSubscription(sub.id, { group: v }); else store.updateSubscription(sub.id, { group: '' }); }}>
                              <SelectTrigger className="h-7 text-xs bg-secondary border-border flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{existingGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}<SelectItem value="__custom">+ New group</SelectItem></SelectContent>
                            </Select>
                            {!existingGroups.includes(sub.group) && (
                              <Input defaultValue={sub.group} onBlur={e => { const v = e.target.value.trim() || 'General'; if (v !== sub.group) store.updateSubscription(sub.id, { group: v }); }} placeholder="Group name" className="h-7 text-xs bg-secondary border-border flex-1" />
                            )}
                          </div></div>
                        <div className="col-span-2"><label className="text-[10px] text-muted-foreground">Pay From</label>
                          <Select value={sub.linkedAccountId ?? 'none'} onValueChange={v => store.updateSubscription(sub.id, { linkedAccountId: v === 'none' ? null : v })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Switch
                        checked={sub.active}
                        onCheckedChange={active => store.updateSubscription(sub.id, { active })}
                        className="scale-75"
                      />
                      <span className={`text-sm truncate ${!sub.active ? 'text-muted-foreground line-through' : ''}`}>{sub.name}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{sub.currency}</Badge>
                    </div>
                    <span className={`text-sm font-medium shrink-0 ${!sub.active ? 'text-muted-foreground' : ''}`}>
                      {formatCurrency(sub.amount, sub.currency)}
                    </span>
                  </ItemRow>
                ))}
              </div>
            ))}
          </SectionCard>

          {/* Debt Payments */}
          <SectionCard
            icon={CreditCard}
            title="Debt Payments"
            subtitle={formatCOP(debtPaid)}
            subtitleColor="text-destructive"
            open={openSections.debtPayments}
            onToggle={() => toggle('debtPayments')}
            onAdd={() => setShowAddDebt(true)}
          >
            {accounts.length === 0 && <EmptyState text="No debt accounts" />}
            {accounts.length > 0 && (
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Min required: {formatCOP(debtMin)}/mo</span>
                <span className="text-[10px] text-muted-foreground">Paid: {formatCOP(debtPaid)}</span>
              </div>
            )}
            {accounts.map(acc => (
              <div key={acc.id} className="border-b border-border/50 last:border-0">
                <div className="flex items-center justify-between py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                    <div className="min-w-0">
                      <span className="text-sm truncate block">{acc.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        Min: {formatCurrency(acc.minimumMonthlyPayment, acc.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <MoneyInput
                      value={ccPayments[acc.id] ?? '0'}
                      onChange={v => setCcPayments(p => ({ ...p, [acc.id]: v }))}
                      onBlur={() => saveCcPayment(acc.id)}
                    />
                    <button onClick={() => toggleEdit(acc.id)} className={`p-1.5 text-muted-foreground hover:text-primary transition-colors ${editingId === acc.id ? 'text-primary' : ''}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {editingId === acc.id && (
                  <div className="pb-3 pt-1 pl-5 grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-muted-foreground">Min. Payment</label><Input type="number" defaultValue={acc.minimumMonthlyPayment} onBlur={e => { const v = Number(e.target.value); if (v !== acc.minimumMonthlyPayment) store.updateDebtAccount(acc.id, { minimumMonthlyPayment: v }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                    <div><label className="text-[10px] text-muted-foreground">Pay From</label>
                      <Select value={acc.linkedAccountId ?? 'none'} onValueChange={v => store.updateDebtAccount(acc.id, { linkedAccountId: v === 'none' ? null : v })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                )}
              </div>
            ))}
          </SectionCard>

          {/* CC Charges */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-warning" />
                  New CC Charges
                </CardTitle>
                <span className="text-warning font-bold text-sm">{formatCOP(ccCharges)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Auto-calculated from credit card spending this month.</p>
            </CardContent>
          </Card>

          {/* Month Summary */}
          <Card className="bg-card border-primary/20 border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Month Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SummaryRow label="Total Income" value={formatCOP(totalIncome)} color="text-income" />
              <SummaryRow label="Fixed Expenses" value={formatCOP(fixed)} />
              <SummaryRow label="Subscriptions" value={formatCOP(subsCost)} />
              <SummaryRow label="Variable Spending" value={formatCOP(totalSpending)} />
              <SummaryRow label="Debt Min. Payments" value={formatCOP(debtMin)} />
              <SummaryRow label="Savings Goal" value={formatCOP(Number(savingsAmount) || 0)} color="text-primary" />
              <SummaryRow label="Total Checking" value={formatCOP(totalChecking)} color="text-primary" />
              <Separator />
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>Balance</span>
                <span className={balance >= 0 ? 'text-income' : 'text-destructive'}>{formatCOP(balance)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Button onClick={() => setShowRecap(true)} variant="secondary" className="w-full" size="lg">
        View Month Recap
      </Button>

      {/* === DIALOGS === */}

      {/* Add Expense */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Fixed Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newExpense.name} onChange={e => setNewExpense(p => ({ ...p, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Currency</Label>
              <Select value={newExpense.currency} onValueChange={v => setNewExpense(p => ({ ...p, currency: v as 'COP' | 'USD' }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Amount ({newExpense.currency})</Label><Input type="number" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Category</Label>
              <Select value={newExpense.category} onValueChange={v => setNewExpense(p => ({ ...p, category: v as ExpenseCategory }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{expenseCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Pay From</Label>
              <Select value={newExpense.linkedAccountId ?? 'none'} onValueChange={v => setNewExpense(p => ({ ...p, linkedAccountId: v === 'none' ? null : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddExpense} disabled={!newExpense.name || !newExpense.amount}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subscription */}
      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Subscription</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newSub.name} onChange={e => setNewSub(p => ({ ...p, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Group</Label>
              <div className="flex gap-2">
                <Select value={existingGroups.includes(newSub.group) ? newSub.group : '__custom'} onValueChange={v => { if (v !== '__custom') setNewSub(p => ({ ...p, group: v })); }}>
                  <SelectTrigger className="bg-secondary border-border flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {existingGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    <SelectItem value="__custom">+ New group</SelectItem>
                  </SelectContent>
                </Select>
                {!existingGroups.includes(newSub.group) && (
                  <Input value={newSub.group} onChange={e => setNewSub(p => ({ ...p, group: e.target.value }))} placeholder="Group name" className="bg-secondary border-border flex-1" />
                )}
              </div>
            </div>
            <div><Label>Currency</Label>
              <Select value={newSub.currency} onValueChange={v => setNewSub(p => ({ ...p, currency: v as 'COP' | 'USD' }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Amount ({newSub.currency})</Label><Input type="number" value={newSub.amount} onChange={e => setNewSub(p => ({ ...p, amount: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Pay From</Label>
              <Select value={newSub.linkedAccountId ?? 'none'} onValueChange={v => setNewSub(p => ({ ...p, linkedAccountId: v === 'none' ? null : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddSub} disabled={!newSub.name || !newSub.amount}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Debt */}
      <Dialog open={showAddDebt} onOpenChange={setShowAddDebt}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Debt Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Currency</Label>
              <Select value={newDebt.currency} onValueChange={v => setNewDebt(p => ({ ...p, currency: v as 'COP' | 'USD' }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Current Balance</Label><Input type="number" value={newDebt.currentBalance} onChange={e => setNewDebt(p => ({ ...p, currentBalance: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Minimum Monthly Payment</Label><Input type="number" value={newDebt.minimumMonthlyPayment} onChange={e => setNewDebt(p => ({ ...p, minimumMonthlyPayment: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Pay From</Label>
              <Select value={newDebt.linkedAccountId ?? 'none'} onValueChange={v => setNewDebt(p => ({ ...p, linkedAccountId: v === 'none' ? null : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddDebt} disabled={!newDebt.name || !newDebt.currentBalance}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Checking Account */}
      <Dialog open={showAddChecking} onOpenChange={setShowAddChecking}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Checking Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newCheckingAcct.name} onChange={e => setNewCheckingAcct(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Bancolombia Checking" className="bg-secondary border-border" /></div>
            <div><Label>Currency</Label>
              <Select value={newCheckingAcct.currency} onValueChange={v => setNewCheckingAcct(p => ({ ...p, currency: v as 'COP' | 'USD' }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Current Balance</Label><Input type="number" value={newCheckingAcct.currentBalance} onChange={e => setNewCheckingAcct(p => ({ ...p, currentBalance: e.target.value }))} className="bg-secondary border-border" /></div>
          </div>
          <DialogFooter><Button onClick={handleAddCheckingAcct} disabled={!newCheckingAcct.name || !newCheckingAcct.currentBalance}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Income */}
      <Dialog open={showAddIncome} onOpenChange={setShowAddIncome}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Income Source</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newIncome.name} onChange={e => setNewIncome(p => ({ ...p, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Currency</Label>
              <Select value={newIncome.currency} onValueChange={v => setNewIncome(p => ({ ...p, currency: v as 'COP' | 'USD' }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Amount ({newIncome.currency})</Label><Input type="number" value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))} className="bg-secondary border-border" /></div>
            <div className="flex items-center gap-2"><Switch checked={newIncome.isRecurring} onCheckedChange={v => setNewIncome(p => ({ ...p, isRecurring: v }))} /><Label>Recurring</Label></div>
            <div><Label>Deposit To</Label>
              <Select value={newIncome.linkedAccountId ?? 'none'} onValueChange={v => setNewIncome(p => ({ ...p, linkedAccountId: v === 'none' ? null : v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{checkingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Deposit Day</Label><Input type="number" min="1" max="31" value={newIncome.depositDay} onChange={e => setNewIncome(p => ({ ...p, depositDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) }))} className="bg-secondary border-border" /></div>
          </div>
          <DialogFooter><Button onClick={handleAddIncome} disabled={!newIncome.name || !newIncome.amount}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recap Modal */}
      <Dialog open={showRecap} onOpenChange={setShowRecap}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-display)]">Month Recap</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <SummaryRow label="Income" value={formatCOP(totalIncome)} color="text-income" bold />
            <SummaryRow label="Expenses" value={formatCOP(totalExpenses)} color="text-destructive" bold />
            <Separator />
            <SummaryRow label="Balance" value={formatCOP(balance)} color={balance >= 0 ? 'text-income' : 'text-destructive'} bold />
            <SummaryRow label="Debt Paid" value={formatCOP(debtPaid)} color="text-info" bold />
            <SummaryRow label="New CC Charges" value={formatCOP(ccCharges)} color="text-warning" bold />
          </div>
          <Button onClick={() => setShowRecap(false)} className="w-full mt-4">Done</Button>
        </DialogContent>
      </Dialog>

      <AiUpdateSheet open={aiUpdateOpen} onOpenChange={setAiUpdateOpen} />
    </div>
  );
}

// --- Sub-components ---

function SectionCard({ icon: Icon, title, subtitle, subtitleColor, open, onToggle, onAdd, children }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  subtitleColor?: string;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">{title}</CardTitle>
            <Chevron className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${subtitleColor ?? ''}`}>{subtitle}</span>
            <Button size="sm" variant="ghost" className="text-primary h-7 px-2" onClick={onAdd}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function ItemRow({ onDelete, onEdit, expanded, editContent, children }: {
  onDelete: () => void;
  onEdit?: () => void;
  expanded?: boolean;
  editContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between py-2 gap-2">
        <div className="flex items-center justify-between gap-2 flex-1 min-w-0">{children}</div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button onClick={onEdit} className={`p-1.5 text-muted-foreground hover:text-primary transition-colors ${expanded ? 'text-primary' : ''}`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && editContent}
    </div>
  );
}

function MoneyInput({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur: () => void }) {
  const [focused, setFocused] = useState(false);
  const raw = value.replace(/[^0-9.]/g, '');
  const display = focused ? raw : (raw ? `$${Number(raw).toLocaleString()}` : '');
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); onBlur(); }}
      className="w-36 bg-secondary border-border text-right text-sm h-8"
    />
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-2 text-center">{text}</p>;
}

function SummaryRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={`text-muted-foreground ${bold ? 'font-medium' : ''}`}>{label}</span>
      <span className={`${color ?? ''} ${bold ? 'font-bold' : 'font-medium'}`}>{value}</span>
    </div>
  );
}
