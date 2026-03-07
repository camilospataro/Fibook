import { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatDate, getCurrentMonth } from '@/lib/formatters';
import SpendingDonut from '@/components/charts/SpendingDonut';
import AddSpendingSheet from '@/components/modals/AddSpendingSheet';
import type { SpendingCategory } from '@/types';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  groceries: 'Groceries', transport: 'Transport', food: 'Food & Dining',
  entertainment: 'Entertainment', health: 'Health', shopping: 'Shopping', other: 'Other',
};

const allCategories: SpendingCategory[] = ['groceries', 'transport', 'food', 'entertainment', 'health', 'shopping', 'other'];

export default function Spending() {
  const spending = useFinanceStore(s => s.spending);
  const deleteSpending = useFinanceStore(s => s.deleteSpending);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SpendingCategory | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const filtered = useMemo(() => {
    return spending.filter(e => {
      const matchMonth = e.date.startsWith(selectedMonth);
      const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
      return matchMonth && matchCat;
    });
  }, [spending, selectedMonth, selectedCategory]);

  const totalSpent = filtered.reduce((sum, e) => sum + e.amount, 0);

  async function handleDelete(id: string) {
    await deleteSpending(id);
    toast.success('Entry deleted');
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Spending</h1>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Spending
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
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
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{entry.description}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{categoryLabels[entry.category]}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-destructive">-{formatCOP(entry.amount)}</span>
                    <button onClick={() => handleDelete(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
