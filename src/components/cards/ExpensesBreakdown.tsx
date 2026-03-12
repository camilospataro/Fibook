import { Receipt, CreditCard, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP } from '@/lib/formatters';
import { totalFixedExpenses, totalMinimumPaymentsCOP, totalSubscriptionsCOP } from '@/lib/calculations';

export default function ExpensesBreakdown() {
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const accounts = useFinanceStore(s => s.debtAccounts);
  const subs = useFinanceStore(s => s.subscriptions);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);

  const activeSubs = subs.filter(s => s.active);

  const fixedTotal = totalFixedExpenses(fixedExpenses, exchangeRate);
  const debtTotal = totalMinimumPaymentsCOP(accounts, exchangeRate);
  const subsTotal = totalSubscriptionsCOP(subs, exchangeRate, new Date().getMonth() + 1);
  const grandTotal = fixedTotal + debtTotal + subsTotal;

  const sections = [
    {
      label: 'Fixed Expenses',
      icon: Receipt,
      total: fixedTotal,
      items: fixedExpenses.map(e => ({
        name: e.name,
        amount: e.currency === 'USD' ? e.amount * exchangeRate : e.amount,
        detail: e.currency,
      })),
    },
    {
      label: 'Debt Minimum Payments',
      icon: CreditCard,
      total: debtTotal,
      items: accounts.map(a => ({
        name: a.name,
        amount: a.currency === 'USD' ? a.minimumMonthlyPayment * exchangeRate : a.minimumMonthlyPayment,
        detail: a.currency,
      })),
    },
    {
      label: 'Subscriptions',
      icon: Repeat,
      total: subsTotal,
      items: activeSubs.map(s => ({
        name: s.name,
        amount: s.currency === 'USD' ? s.amount * exchangeRate : s.amount,
        detail: s.currency,
      })),
    },
  ];

  if (grandTotal === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Monthly Expenses Breakdown</CardTitle>
        <span className="text-xs text-muted-foreground">{formatCOP(grandTotal)}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map(section => {
          if (section.items.length === 0) return null;
          return (
            <div key={section.label}>
              <div className="flex items-center gap-2 mb-2">
                <section.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{section.label}</span>
                <span className="ml-auto text-xs font-medium">{formatCOP(section.total)}</span>
              </div>
              <div className="space-y-1.5 pl-5">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/80 truncate">{item.name}</span>
                    <span className="text-foreground font-medium shrink-0 ml-2">{formatCOP(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
