import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatDate, getCurrentMonth } from '@/lib/formatters';
import SpendingDonut from '@/components/charts/SpendingDonut';
import AddSpendingSheet from '@/components/modals/AddSpendingSheet';
import type { SpendingCategory, PaymentMethod } from '@/types';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  groceries: 'Groceries', transport: 'Transport', food: 'Food & Dining',
  entertainment: 'Entertainment', health: 'Health', shopping: 'Shopping', other: 'Other',
};

const basePaymentLabel: Record<string, string> = {
  cash: 'Cash', debit: 'Debit', credit_mastercard_cop: 'MC COP',
  credit_mastercard_usd: 'MC USD', credit_visa: 'Visa',
};

const allCategories: SpendingCategory[] = ['groceries', 'transport', 'food', 'entertainment', 'health', 'shopping', 'other'];

export default function Spending() {
  const spending = useFinanceStore(s => s.spending);
  const updateSpending = useFinanceStore(s => s.updateSpending);
  const deleteSpending = useFinanceStore(s => s.deleteSpending);
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);

  const paymentLabel = useMemo(() => {
    const labels: Record<string, string> = { ...basePaymentLabel };
    for (const acc of checkingAccounts) {
      labels[`checking_${acc.id}`] = acc.name;
    }
    return labels;
  }, [checkingAccounts]);

  const allPaymentMethods: { value: PaymentMethod; label: string }[] = useMemo(() => [
    { value: 'cash', label: 'Cash' }, { value: 'debit', label: 'Debit' },
    { value: 'credit_mastercard_cop', label: 'MC COP' }, { value: 'credit_mastercard_usd', label: 'MC USD' },
    { value: 'credit_visa', label: 'Visa' },
    ...checkingAccounts.map(acc => ({ value: `checking_${acc.id}` as PaymentMethod, label: acc.name })),
  ], [checkingAccounts]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SpendingCategory | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editTagInput, setEditTagInput] = useState('');

  // Collect all unique tags from current month's spending
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const e of spending) {
      if (e.date.startsWith(selectedMonth)) {
        for (const t of (e.tags ?? [])) tags.add(t);
      }
    }
    return Array.from(tags).sort();
  }, [spending, selectedMonth]);

  const filtered = useMemo(() => {
    return spending.filter(e => {
      const matchMonth = e.date.startsWith(selectedMonth);
      const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
      const matchTag = !selectedTag || (e.tags ?? []).includes(selectedTag);
      return matchMonth && matchCat && matchTag;
    });
  }, [spending, selectedMonth, selectedCategory, selectedTag]);

  const totalSpent = filtered.reduce((sum, e) => sum + e.amount, 0);

  async function handleDelete(id: string) {
    await deleteSpending(id);
    toast.success('Entry deleted');
  }

  function handleAddEditTag(entryId: string, currentTags: string[]) {
    const t = editTagInput.trim().toLowerCase();
    if (t && !currentTags.includes(t)) {
      updateSpending(entryId, { tags: [...currentTags, t] });
    }
    setEditTagInput('');
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Spending</h1>
        <Button size="sm" onClick={() => setSheetOpen(true)} className="hidden md:inline-flex">
          <Plus className="w-4 h-4 mr-1" /> Add Spending
        </Button>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Filters */}
      <div className="flex gap-2 items-center overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-none">
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
        />
        <Badge
          variant={selectedCategory === 'all' ? 'default' : 'secondary'}
          className="cursor-pointer"
          onClick={() => setSelectedCategory('all')}
        >
          All
        </Badge>
        {allCategories.map(cat => (
          <Badge
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(cat)}
          >
            {categoryLabels[cat]}
          </Badge>
        ))}
      </div>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Tags:</span>
          <Badge
            variant={!selectedTag ? 'default' : 'outline'}
            className="cursor-pointer text-[10px]"
            onClick={() => setSelectedTag(null)}
          >
            All
          </Badge>
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Spent</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive font-[family-name:var(--font-display)]">{formatCOP(totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-1">{filtered.length} transactions</p>
          </CardContent>
        </Card>
        <SpendingDonut entries={filtered} />
      </div>

      {/* Spending List */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Transactions</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No spending entries for this period.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(entry => (
                <div key={entry.id} className="border-b border-border last:border-0">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.description}</p>
                      <div className="flex gap-2 mt-0.5 items-center flex-wrap">
                        <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{categoryLabels[entry.category]}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{paymentLabel[entry.paymentMethod]}</Badge>
                        {(entry.tags ?? []).map(tag => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary/80">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-medium text-destructive mr-1">-{formatCOP(entry.amount)}</span>
                      <button onClick={() => setEditingId(prev => prev === entry.id ? null : entry.id)} className={`p-1.5 text-muted-foreground hover:text-primary transition-colors ${editingId === entry.id ? 'text-primary' : ''}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {editingId === entry.id && (
                    <div className="pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><label className="text-[10px] text-muted-foreground">Description</label><Input defaultValue={entry.description} onBlur={e => { if (e.target.value !== entry.description) updateSpending(entry.id, { description: e.target.value }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                      <div><label className="text-[10px] text-muted-foreground">Amount</label><Input type="number" defaultValue={entry.amount} onBlur={e => { const v = Number(e.target.value); if (v !== entry.amount) updateSpending(entry.id, { amount: v }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                      <div><label className="text-[10px] text-muted-foreground">Date</label><Input type="date" defaultValue={entry.date} onBlur={e => { if (e.target.value !== entry.date) updateSpending(entry.id, { date: e.target.value }); }} className="h-7 text-xs bg-secondary border-border" /></div>
                      <div><label className="text-[10px] text-muted-foreground">Category</label>
                        <Select value={entry.category} onValueChange={v => updateSpending(entry.id, { category: v as SpendingCategory })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent>{allCategories.map(c => <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>)}</SelectContent></Select></div>
                      <div className="sm:col-span-2"><label className="text-[10px] text-muted-foreground">Payment Method</label>
                        <Select value={entry.paymentMethod} onValueChange={v => updateSpending(entry.id, { paymentMethod: v as PaymentMethod })}><SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger><SelectContent>{allPaymentMethods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-muted-foreground">Tags</label>
                        <div className="flex gap-1 flex-wrap mb-1">
                          {(entry.tags ?? []).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] gap-0.5">
                              {tag}
                              <button onClick={() => updateSpending(entry.id, { tags: (entry.tags ?? []).filter(t => t !== tag) })} className="hover:text-destructive">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <Input
                          value={editTagInput}
                          onChange={e => setEditTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEditTag(entry.id, entry.tags ?? []); } }}
                          placeholder="Add tag + Enter"
                          className="h-7 text-xs bg-secondary border-border"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddSpendingSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
