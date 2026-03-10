import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatDate, getCurrentMonth } from '@/lib/formatters';

const categoryEmoji: Record<string, string> = {
  groceries: '🛒', transport: '🚗', food: '🍔', entertainment: '🎮',
  health: '💊', shopping: '🛍️', other: '📦',
};

const categoryLabel: Record<string, string> = {
  groceries: 'Groceries', transport: 'Transport', food: 'Food & Dining',
  entertainment: 'Entertainment', health: 'Health', shopping: 'Shopping', other: 'Other',
};

const paymentLabel: Record<string, string> = {
  cash: 'Cash', debit: 'Debit', credit_mastercard_cop: 'MC COP',
  credit_mastercard_usd: 'MC USD', credit_visa: 'Visa',
};

// Map spending categories to fixed expense categories for budget lookup
const spendingToExpenseCategory: Record<string, string> = {
  groceries: 'food',
  food: 'food',
  transport: 'transport',
  entertainment: 'entertainment',
  health: 'health',
  shopping: 'other',
  other: 'other',
};

export default function MonthlySpending() {
  const spending = useFinanceStore(s => s.spending);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const currentMonth = getCurrentMonth();

  // Filter to current month entries
  const monthEntries = spending.filter(e => e.date.startsWith(currentMonth));
  const totalSpent = monthEntries.reduce((sum, e) => sum + e.amount, 0);

  // Build budget by expense category (in COP), excluding housing
  const budgetByExpCat: Record<string, number> = {};
  for (const exp of fixedExpenses) {
    if (exp.category === 'housing') continue;
    const amount = exp.currency === 'USD' ? exp.amount * exchangeRate : exp.amount;
    budgetByExpCat[exp.category] = (budgetByExpCat[exp.category] ?? 0) + amount;
  }

  // Group spending by category
  const byCategory = monthEntries.reduce<Record<string, { total: number; count: number }>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = { total: 0, count: 0 };
    acc[e.category].total += e.amount;
    acc[e.category].count += 1;
    return acc;
  }, {});

  // Aggregate spending by expense category so multiple spending cats that map
  // to the same budget (e.g. groceries + food → food) are combined
  const spentByExpCat: Record<string, number> = {};
  for (const e of monthEntries) {
    const expCat = spendingToExpenseCategory[e.category] ?? 'other';
    spentByExpCat[expCat] = (spentByExpCat[expCat] ?? 0) + e.amount;
  }

  // Build a unified list: every budget category (even if no spending yet)
  const allExpCats = new Set([...Object.keys(budgetByExpCat), ...Object.keys(spentByExpCat)]);
  const budgetRows = Array.from(allExpCats)
    .map(expCat => ({
      expCat,
      budget: budgetByExpCat[expCat] ?? 0,
      spent: spentByExpCat[expCat] ?? 0,
    }))
    .sort((a, b) => {
      const order = ['food', 'transport', 'entertainment', 'health', 'other'];
      return (order.indexOf(a.expCat) === -1 ? 99 : order.indexOf(a.expCat))
        - (order.indexOf(b.expCat) === -1 ? 99 : order.indexOf(b.expCat));
    });

  const expCatEmoji: Record<string, string> = {
    housing: '🏠', food: '🍔', transport: '🚗', entertainment: '🎮',
    health: '💊', other: '📦',
  };
  const expCatLabel: Record<string, string> = {
    housing: 'Housing', food: 'Food & Groceries', transport: 'Transport',
    entertainment: 'Entertainment', health: 'Health', other: 'Other',
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Spending This Month</CardTitle>
        <p className="text-2xl font-bold text-destructive mt-1">{formatCOP(totalSpent)}</p>
      </CardHeader>
      <CardContent>
        {/* Budget gauges — always show if there are budgets */}
        {budgetRows.length > 0 && (
          <div className="space-y-3 mb-4">
            {budgetRows.map(({ expCat, budget, spent }) => {
              const remaining = Math.max(0, budget - spent);
              const remainingPct = budget > 0 ? (remaining / budget) * 100 : 0;
              const overBudget = budget > 0 && spent > budget;
              const overAmount = spent - budget;
              return (
                <div key={expCat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span>{expCatEmoji[expCat] ?? '📦'}</span>
                      <span className="text-foreground/80">{expCatLabel[expCat] ?? expCat}</span>
                    </div>
                    <div className="text-right">
                      {budget > 0 ? (
                        overBudget ? (
                          <span className="text-xs text-destructive font-medium">
                            Over by {formatCOP(overAmount)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {formatCOP(remaining)} left
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {formatCOP(spent)} spent
                        </span>
                      )}
                    </div>
                  </div>
                  {budget > 0 ? (
                    <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${
                          overBudget ? 'bg-destructive' : remainingPct < 25 ? 'bg-warning' : 'bg-primary'
                        }`}
                        style={{ width: `${overBudget ? 100 : remainingPct}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: '100%' }} />
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                    <span>{formatCOP(spent)} spent</span>
                    {budget > 0 && <span>{formatCOP(budget)} budget</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {monthEntries.length === 0 && budgetRows.length === 0 && (
          <p className="text-muted-foreground text-sm">No spending recorded this month.</p>
        )}

        {monthEntries.length > 0 && (
          <div>

            {/* Recent entries list */}
            <div className="border-t border-border pt-3 space-y-2.5">
              <p className="text-xs text-muted-foreground font-medium">Recent entries</p>
              {monthEntries.slice(0, 8).map(entry => (
                <div key={entry.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base">{categoryEmoji[entry.category] ?? '📦'}</span>
                    <div>
                      <p className="text-sm font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.date)} · {paymentLabel[entry.paymentMethod] ?? entry.paymentMethod}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-destructive shrink-0 ml-2">-{formatCOP(entry.amount)}</span>
                </div>
              ))}
              {monthEntries.length > 8 && (
                <p className="text-xs text-muted-foreground">
                  +{monthEntries.length - 8} more entries
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
