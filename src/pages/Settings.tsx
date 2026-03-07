import { useState, useEffect } from 'react';
import { Plus, Trash2, LogOut, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFinanceStore } from '@/store/useFinanceStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { ExpenseCategory } from '@/types';

const DEBT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
const expenseCategories: { value: ExpenseCategory; label: string }[] = [
  { value: 'housing', label: 'Housing' }, { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' }, { value: 'entertainment', label: 'Entertainment' },
  { value: 'health', label: 'Health' }, { value: 'other', label: 'Other' },
];

export default function Settings() {
  const store = useFinanceStore();
  const { settings, debtAccounts, incomeSources, fixedExpenses, subscriptions } = store;

  // Exchange Rate — sync local state when store settings load or change
  const [rate, setRate] = useState(String(settings?.exchangeRate ?? 4000));
  useEffect(() => {
    if (settings?.exchangeRate) {
      setRate(String(settings.exchangeRate));
    }
  }, [settings?.exchangeRate]);

  // Add modals
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);

  // New item forms
  const [newDebt, setNewDebt] = useState({ name: '', currency: 'COP' as 'COP' | 'USD', currentBalance: '', minimumMonthlyPayment: '', color: DEBT_COLORS[0] });
  const [newIncome, setNewIncome] = useState({ name: '', amount: '', isRecurring: true });
  const [newExpense, setNewExpense] = useState({ name: '', amount: '', category: 'other' as ExpenseCategory });
  const [newSub, setNewSub] = useState({ name: '', currency: 'COP' as 'COP' | 'USD', amount: '', active: true });

  // Confirm delete
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  const [refreshingRate, setRefreshingRate] = useState(false);

  async function saveRate() {
    await store.updateExchangeRate(Number(rate));
    toast.success('Exchange rate updated');
  }

  async function handleRefreshRate() {
    setRefreshingRate(true);
    await store.refreshExchangeRate();
    const updated = useFinanceStore.getState().settings?.exchangeRate;
    if (updated) setRate(String(updated));
    toast.success('Exchange rate updated from live market data');
    setRefreshingRate(false);
  }

  async function handleAddDebt() {
    await store.addDebtAccount({ name: newDebt.name, currency: newDebt.currency, currentBalance: Number(newDebt.currentBalance), minimumMonthlyPayment: Number(newDebt.minimumMonthlyPayment), color: newDebt.color });
    setNewDebt({ name: '', currency: 'COP', currentBalance: '', minimumMonthlyPayment: '', color: DEBT_COLORS[debtAccounts.length % DEBT_COLORS.length] });
    setShowAddDebt(false);
    toast.success('Debt account added');
  }

  async function handleAddIncome() {
    await store.addIncomeSource({ name: newIncome.name, amount: Number(newIncome.amount), isRecurring: newIncome.isRecurring });
    setNewIncome({ name: '', amount: '', isRecurring: true });
    setShowAddIncome(false);
    toast.success('Income source added');
  }

  async function handleAddExpense() {
    await store.addFixedExpense({ name: newExpense.name, amount: Number(newExpense.amount), category: newExpense.category });
    setNewExpense({ name: '', amount: '', category: 'other' });
    setShowAddExpense(false);
    toast.success('Fixed expense added');
  }

  async function handleAddSub() {
    await store.addSubscription({ name: newSub.name, currency: newSub.currency, amount: Number(newSub.amount), active: newSub.active });
    setNewSub({ name: '', currency: 'COP', amount: '', active: true });
    setShowAddSub(false);
    toast.success('Subscription added');
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === 'debt') await store.deleteDebtAccount(id);
    else if (type === 'income') await store.deleteIncomeSource(id);
    else if (type === 'expense') await store.deleteFixedExpense(id);
    else if (type === 'sub') await store.deleteSubscription(id);
    setDeleteConfirm(null);
    toast.success('Deleted');
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Settings</h1>

      {/* Exchange Rate */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Exchange Rate (USD → COP)</CardTitle>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-income animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Live</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Input type="number" value={rate} onChange={e => setRate(e.target.value)} className="bg-secondary border-border w-40" />
            <Button onClick={saveRate} size="sm">Save</Button>
          </div>
          <Button onClick={handleRefreshRate} size="sm" variant="secondary" disabled={refreshingRate} className="w-full">
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshingRate ? 'animate-spin' : ''}`} />
            {refreshingRate ? 'Fetching...' : 'Fetch Live Rate'}
          </Button>
        </CardContent>
      </Card>

      {/* Debt Accounts */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Debt Accounts</CardTitle>
          <Button size="sm" variant="ghost" className="text-primary h-7" onClick={() => setShowAddDebt(true)}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {debtAccounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                <span className="text-sm">{acc.name}</span>
                <span className="text-xs text-muted-foreground">({acc.currency})</span>
              </div>
              <button onClick={() => setDeleteConfirm({ type: 'debt', id: acc.id, name: acc.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Income Sources */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Income Sources</CardTitle>
          <Button size="sm" variant="ghost" className="text-primary h-7" onClick={() => setShowAddIncome(true)}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {incomeSources.map(src => (
            <div key={src.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm">{src.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">${src.amount.toLocaleString()}</span>
                <button onClick={() => setDeleteConfirm({ type: 'income', id: src.id, name: src.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Fixed Expenses */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Fixed Expenses</CardTitle>
          <Button size="sm" variant="ghost" className="text-primary h-7" onClick={() => setShowAddExpense(true)}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {fixedExpenses.map(exp => (
            <div key={exp.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm">{exp.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">${exp.amount.toLocaleString()}</span>
                <button onClick={() => setDeleteConfirm({ type: 'expense', id: exp.id, name: exp.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Subscriptions */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Subscriptions</CardTitle>
          <Button size="sm" variant="ghost" className="text-primary h-7" onClick={() => setShowAddSub(true)}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {subscriptions.map(sub => (
            <div key={sub.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <Switch
                  checked={sub.active}
                  onCheckedChange={active => store.updateSubscription(sub.id, { active })}
                />
                <span className={`text-sm ${!sub.active ? 'text-muted-foreground line-through' : ''}`}>{sub.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{sub.currency === 'USD' ? `$${sub.amount}` : `$${sub.amount.toLocaleString()}`} {sub.currency}</span>
                <button onClick={() => setDeleteConfirm({ type: 'sub', id: sub.id, name: sub.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Sign Out */}
      <Button variant="destructive" onClick={() => supabase.auth.signOut()} className="w-full">
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>

      {/* Add Debt Dialog */}
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
          </div>
          <DialogFooter><Button onClick={handleAddDebt}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Income Dialog */}
      <Dialog open={showAddIncome} onOpenChange={setShowAddIncome}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Income Source</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newIncome.name} onChange={e => setNewIncome(p => ({ ...p, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Amount (COP)</Label><Input type="number" value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))} className="bg-secondary border-border" /></div>
            <div className="flex items-center gap-2"><Switch checked={newIncome.isRecurring} onCheckedChange={v => setNewIncome(p => ({ ...p, isRecurring: v }))} /><Label>Recurring</Label></div>
          </div>
          <DialogFooter><Button onClick={handleAddIncome}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Fixed Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newExpense.name} onChange={e => setNewExpense(p => ({ ...p, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Amount (COP)</Label><Input type="number" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Category</Label>
              <Select value={newExpense.category} onValueChange={v => setNewExpense(p => ({ ...p, category: v as ExpenseCategory }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{expenseCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddExpense}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subscription Dialog */}
      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Add Subscription</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newSub.name} onChange={e => setNewSub(p => ({ ...p, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><Label>Currency</Label>
              <Select value={newSub.currency} onValueChange={v => setNewSub(p => ({ ...p, currency: v as 'COP' | 'USD' }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label><Input type="number" value={newSub.amount} onChange={e => setNewSub(p => ({ ...p, amount: e.target.value }))} className="bg-secondary border-border" /></div>
          </div>
          <DialogFooter><Button onClick={handleAddSub}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
}
