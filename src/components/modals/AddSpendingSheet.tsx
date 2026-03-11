import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore } from '@/store/useFinanceStore';
import { getToday, formatCurrency } from '@/lib/formatters';
import type { SpendingCategory } from '@/types';
import { toast } from 'sonner';

const categories: { value: SpendingCategory; label: string }[] = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'transport', label: 'Transport' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'health', label: 'Health' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddSpendingSheet({ open, onOpenChange }: Props) {
  const addSpending = useFinanceStore(s => s.addSpending);
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subscriptions = useFinanceStore(s => s.subscriptions);

  const budgetItems = useMemo(() => [
    ...fixedExpenses.map(e => ({ id: e.id, name: e.name, type: 'expense' as const, amount: e.amount, currency: e.currency })),
    ...subscriptions.filter(s => s.active).map(s => ({ id: s.id, name: s.name, type: 'subscription' as const, amount: s.amount, currency: s.currency })),
  ], [fixedExpenses, subscriptions]);

  const [date, setDate] = useState(getToday());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<SpendingCategory>('other');
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [linkedBudgetId, setLinkedBudgetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !amount) return;
    setSaving(true);
    await addSpending({
      date,
      description,
      amount: Number(amount),
      category,
      paymentMethod: linkedAccountId ? `checking_${linkedAccountId}` : 'cash',
      linkedAccountId,
      linkedBudgetId,
    });
    toast.success('Spending added');
    setDescription('');
    setAmount('');
    setCategory('other');
    setLinkedAccountId(null);
    setLinkedBudgetId(null);
    setDate(getToday());
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border px-6">
        <SheetHeader>
          <SheetTitle>Add Spending</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What did you spend on?" className="bg-secondary border-border" required />
          </div>
          <div className="space-y-2">
            <Label>Amount (COP)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0" className="bg-secondary border-border" required />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as SpendingCategory)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pay From</Label>
            <Select value={linkedAccountId ?? 'none'} onValueChange={v => setLinkedAccountId(v === 'none' ? null : v)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Cash / Other</SelectItem>
                {checkingAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.currentBalance, a.currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Link to Budget</Label>
            <Select value={linkedBudgetId ?? 'none'} onValueChange={v => setLinkedBudgetId(v === 'none' ? null : v)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {budgetItems.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({formatCurrency(b.amount, b.currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : 'Add Spending'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
