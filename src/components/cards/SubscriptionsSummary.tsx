import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatCurrency } from '@/lib/formatters';
import { totalSubscriptionsCOP } from '@/lib/calculations';

export default function SubscriptionsSummary() {
  const subs = useFinanceStore(s => s.subscriptions);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const activeSubs = subs.filter(s => s.active);
  const total = totalSubscriptionsCOP(subs, exchangeRate);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Subscriptions</CardTitle>
        <Badge variant="secondary" className="text-xs">{activeSubs.length} active</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-bold text-warning mb-3">{formatCOP(total)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
        <div className="space-y-2">
          {activeSubs.slice(0, 5).map(sub => (
            <div key={sub.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{sub.name}</span>
              <span>{formatCurrency(sub.amount, sub.currency)}</span>
            </div>
          ))}
          {activeSubs.length > 5 && (
            <p className="text-xs text-muted-foreground">+{activeSubs.length - 5} more</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
