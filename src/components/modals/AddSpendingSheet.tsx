import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  const debtAccounts = useFinanceStore(s => s.debtAccounts);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const budgetItems = useMemo(() =>
    fixedExpenses.map(e => ({ id: e.id, name: e.name, amount: e.amount, currency: e.currency })),
  [fixedExpenses]);

  const [date, setDate] = useState(getToday());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<SpendingCategory>('other');
  const [payFromId, setPayFromId] = useState<string>('none');
  const [linkedBudgetId, setLinkedBudgetId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags([...tags, t]); }
    setTagInput('');
  }

  // Compute available balance for selected checking account
  const selectedCheckingAccount = payFromId.startsWith('checking_')
    ? checkingAccounts.find(a => a.id === payFromId.replace('checking_', ''))
    : null;
  const availableBalance = selectedCheckingAccount?.currentBalance ?? null;
  const exceedsBalance = availableBalance !== null && Number(amount) > availableBalance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !amount) return;
    if (exceedsBalance) {
      toast.error('Amount exceeds available balance');
      return;
    }
    setSaving(true);
    const isChecking = payFromId.startsWith('checking_');
    const isDebt = payFromId.startsWith('debt_');
    const accountId = isChecking ? payFromId.replace('checking_', '') : isDebt ? payFromId.replace('debt_', '') : null;
    try {
      await addSpending({
        date,
        description,
        amount: Number(amount),
        category,
        paymentMethod: payFromId === 'none' ? 'cash' : payFromId as `checking_${string}` | `debt_${string}`,
        linkedAccountId: isChecking ? accountId : null,
        linkedBudgetId,
        tags,
      });
      toast.success('Spending added');
      setDescription('');
      setAmount('');
      setCategory('other');
      setPayFromId('none');
      setLinkedBudgetId(null);
      setTags([]);
      setTagInput('');
      setDate(getToday());
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add spending');
    }
    setSaving(false);
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
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0" className={`bg-secondary border-border ${exceedsBalance ? 'border-destructive' : ''}`} required />
            {availableBalance !== null && (
              <p className={`text-[11px] ${exceedsBalance ? 'text-destructive' : 'text-muted-foreground'}`}>
                Available: {formatCurrency(availableBalance, selectedCheckingAccount!.currency)}
              </p>
            )}
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
            <Select value={payFromId} onValueChange={setPayFromId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Cash / Other</SelectItem>
                {checkingAccounts.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Checking</div>
                    {checkingAccounts.map(a => (
                      <SelectItem key={a.id} value={`checking_${a.id}`}>
                        {a.name} ({formatCurrency(a.currentBalance, a.currency)})
                      </SelectItem>
                    ))}
                  </>
                )}
                {debtAccounts.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Credit Cards</div>
                    {debtAccounts.map(a => (
                      <SelectItem key={a.id} value={`debt_${a.id}`}>
                        {a.name} ({formatCurrency(a.currentBalance, a.currency)})
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Link to Budget</Label>
            <Select value={linkedBudgetId ?? ''} onValueChange={v => setLinkedBudgetId(v || null)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select budget item" /></SelectTrigger>
              <SelectContent>
                {budgetItems.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({formatCurrency(b.amount, b.currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-1.5 flex-wrap">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Type a tag and press Enter"
              className="bg-secondary border-border"
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving || exceedsBalance}>
            {saving ? 'Saving...' : 'Add Spending'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
