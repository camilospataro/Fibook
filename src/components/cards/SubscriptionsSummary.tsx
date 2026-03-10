import { useMemo } from 'react';
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

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof activeSubs>();
    for (const sub of activeSubs) {
      const g = sub.group || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(sub);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activeSubs]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Subscriptions</CardTitle>
        <Badge variant="secondary" className="text-xs">{activeSubs.length} active</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-bold text-warning mb-3">{formatCOP(total)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
        <div className="space-y-3">
          {grouped.map(([groupName, groupSubs]) => {
            const groupTotal = groupSubs.reduce((sum, s) => sum + (s.currency === 'USD' ? s.amount * exchangeRate : s.amount), 0);
            return (
              <div key={groupName}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</span>
                  <span className="text-[11px] text-muted-foreground">{formatCOP(groupTotal)}</span>
                </div>
                <div className="space-y-1.5 pl-2 border-l-2 border-border/50">
                  {groupSubs.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{sub.name}</span>
                      <div className="text-right">
                        <span>{formatCurrency(sub.amount, sub.currency)}</span>
                        {sub.currency === 'USD' && (
                          <p className="text-[10px] text-muted-foreground">~{formatCOP(sub.amount * exchangeRate)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
