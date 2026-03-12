import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatDate, getCurrentMonth, formatCurrency } from '@/lib/formatters';
import { Check } from 'lucide-react';

const categoryEmoji: Record<string, string> = {
  groceries: '🛒', transport: '🚗', food: '🍔', entertainment: '🎮',
  health: '💊', shopping: '🛍️', other: '📦',
};

const paymentLabel: Record<string, string> = {
  cash: 'Cash', debit: 'Debit', credit_mastercard_cop: 'MC COP',
  credit_mastercard_usd: 'MC USD', credit_visa: 'Visa',
};

export default function MonthlySpending() {
  const spending = useFinanceStore(s => s.spending);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const currentMonth = getCurrentMonth();

  const monthEntries = spending.filter(e => e.date.startsWith(currentMonth));
  const totalSpent = monthEntries.reduce((sum, e) => sum + e.amount, 0);

  // Total monthly budget (all fixed expenses in COP)
  const totalBudget = fixedExpenses.reduce((sum, exp) => {
    const amt = exp.currency === 'USD' ? exp.amount * exchangeRate : exp.amount;
    return sum + amt;
  }, 0);
  const budgetRemaining = totalBudget - totalSpent;

  // Build per-expense data: how much was spent linked to each
  const expenseRows = fixedExpenses.map(exp => {
    const linkedSpending = monthEntries.filter(e => e.linkedBudgetId === exp.id);
    const spentOnThis = linkedSpending.reduce((sum, e) => sum + e.amount, 0);
    const budgetCOP = exp.currency === 'USD' ? exp.amount * exchangeRate : exp.amount;
    const paid = linkedSpending.length > 0;
    return { ...exp, spentOnThis, budgetCOP, paid };
  });

  // Unlinked spending (not tied to any fixed expense)
  const unlinkedSpending = monthEntries.filter(e => !e.linkedBudgetId);
  const unlinkedTotal = unlinkedSpending.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Spending This Month</CardTitle>
        <p className="text-2xl font-bold text-destructive mt-1">{formatCOP(totalSpent)}</p>
        {totalBudget > 0 && (
          <p className={`text-xs mt-0.5 ${budgetRemaining >= 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
            {budgetRemaining >= 0
              ? `${formatCOP(budgetRemaining)} remaining of ${formatCOP(totalBudget)} budget`
              : `Over budget by ${formatCOP(Math.abs(budgetRemaining))}`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Fixed expenses with paid/pending + budget bar */}
        {expenseRows.length > 0 && (
          <div className="space-y-2.5 mb-4">
            <p className="text-xs text-muted-foreground font-medium">Budget Items</p>
            {expenseRows.map(exp => {
              const pct = exp.budgetCOP > 0 ? Math.min((exp.spentOnThis / exp.budgetCOP) * 100, 100) : 0;
              const over = exp.spentOnThis > exp.budgetCOP && exp.budgetCOP > 0;
              const isFixedBill = exp.category === 'housing';
              // Fixed bills (rent): show Paid/Pending badge
              // Variable budgets: show % used with green-to-red bar
              return (
                <div key={exp.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {isFixedBill ? (
                        <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 ${exp.paid ? 'bg-primary/20' : 'bg-secondary'}`}>
                          {exp.paid && <Check className="w-3 h-3 text-primary" />}
                        </div>
                      ) : null}
                      <span className="text-sm text-foreground">{exp.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatCOP(exp.spentOnThis)} / {formatCurrency(exp.amount, exp.currency)}
                      </span>
                      {isFixedBill ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${exp.paid ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                          {exp.paid ? 'Paid' : 'Pending'}
                        </span>
                      ) : (
                        <span className={`text-xs font-medium ${over ? 'text-destructive' : pct > 75 ? 'text-warning' : 'text-muted-foreground'}`}>
                          {Math.round(pct)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isFixedBill
                          ? (exp.paid ? 'bg-primary' : 'bg-muted-foreground/30')
                          : over ? 'bg-destructive' : pct > 75 ? 'bg-warning' : pct > 50 ? 'bg-yellow-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(pct, isFixedBill && !exp.paid ? 0 : pct > 0 ? Math.max(pct, 3) : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unlinked spending summary */}
        {unlinkedTotal > 0 && (
          <div className="border-t border-border/50 pt-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">Other Spending</p>
              <span className="text-xs text-destructive font-medium">{formatCOP(unlinkedTotal)}</span>
            </div>
          </div>
        )}

        {monthEntries.length === 0 && expenseRows.length === 0 && (
          <p className="text-muted-foreground text-sm">No spending recorded this month.</p>
        )}

        {/* Recent entries list */}
        {monthEntries.length > 0 && (
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
        )}
      </CardContent>
    </Card>
  );
}
