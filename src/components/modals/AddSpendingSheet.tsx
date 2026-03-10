import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore } from '@/store/useFinanceStore';
import { getToday } from '@/lib/formatters';
import type { SpendingCategory, PaymentMethod } from '@/types';
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

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'debit', label: 'Debit' },
  { value: 'credit_mastercard_cop', label: 'Mastercard COP' },
  { value: 'credit_mastercard_usd', label: 'Mastercard USD' },
  { value: 'credit_visa', label: 'Visa' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddSpendingSheet({ open, onOpenChange }: Props) {
  const addSpending = useFinanceStore(s => s.addSpending);
  const [date, setDate] = useState(getToday());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<SpendingCategory>('other');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
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
      paymentMethod,
    });
    toast.success('Spending added');
    setDescription('');
    setAmount('');
    setCategory('other');
    setPaymentMethod('cash');
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
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
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
