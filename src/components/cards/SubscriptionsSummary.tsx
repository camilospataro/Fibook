import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatCurrency } from '@/lib/formatters';
import type { Subscription } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SubGroup({ groupName, groupSubs, exchangeRate, annual }: {
  groupName: string;
  groupSubs: Subscription[];
  exchangeRate: number;
  annual?: boolean;
}) {
  const groupTotal = groupSubs.reduce((sum, s) => {
    const cost = s.currency === 'USD' ? s.amount * exchangeRate : s.amount;
    return sum + cost;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</span>
        <span className="text-[11px] text-muted-foreground">{formatCOP(groupTotal)}{annual ? '/yr' : ''}</span>
      </div>
      <div className="space-y-1.5 pl-2 border-l-2 border-border/50">
        {groupSubs.map(sub => (
          <div key={sub.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{sub.name}</span>
              {annual && sub.renewalMonth && (
                <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground/70">
                  {MONTH_NAMES[sub.renewalMonth - 1]} {sub.paymentDay}
                </span>
              )}
            </div>
            <div className="text-right">
              <span>{formatCurrency(sub.amount, sub.currency)}{annual ? '/yr' : ''}</span>
              {sub.currency === 'USD' && (
                <p className="text-[10px] text-muted-foreground">~{formatCOP(sub.amount * exchangeRate)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubscriptionsSummary() {
  const [view, setView] = useState<'monthly' | 'annual'>('monthly');
  const subs = useFinanceStore(s => s.subscriptions);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const activeSubs = subs.filter(s => s.active);

  const monthlySubs = activeSubs.filter(s => s.billingCycle !== 'annual');
  const annualSubs = activeSubs.filter(s => s.billingCycle === 'annual');

  const monthlyTotal = monthlySubs.reduce((sum, s) => {
    const cost = s.currency === 'USD' ? s.amount * exchangeRate : s.amount;
    return sum + cost;
  }, 0);

  const annualTotal = annualSubs.reduce((sum, s) => {
    const cost = s.currency === 'USD' ? s.amount * exchangeRate : s.amount;
    return sum + cost;
  }, 0);

  const groupedMonthly = useMemo(() => {
    const groups = new Map<string, Subscription[]>();
    for (const sub of monthlySubs) {
      const g = sub.group || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(sub);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [monthlySubs]);

  const groupedAnnual = useMemo(() => {
    const groups = new Map<string, Subscription[]>();
    for (const sub of annualSubs) {
      const g = sub.group || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(sub);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [annualSubs]);

  const isMonthly = view === 'monthly';
  const currentGroups = isMonthly ? groupedMonthly : groupedAnnual;
  const currentTotal = isMonthly ? monthlyTotal : annualTotal;
  const currentCount = isMonthly ? monthlySubs.length : annualSubs.length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Subscriptions</CardTitle>
        <Badge variant="secondary" className="text-xs">{activeSubs.length} active</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toggle */}
        <div className="flex rounded-lg bg-secondary/70 p-0.5">
          <button
            onClick={() => setView('monthly')}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              isMonthly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly ({monthlySubs.length})
          </button>
          <button
            onClick={() => setView('annual')}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              !isMonthly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Annual ({annualSubs.length})
          </button>
        </div>

        {/* Total */}
        <p className={`text-lg font-bold ${isMonthly ? 'text-warning' : 'text-accent'}`}>
          {formatCOP(currentTotal)}
          <span className="text-xs text-muted-foreground font-normal">{isMonthly ? '/mo' : '/yr'}</span>
        </p>

        {/* Groups */}
        <div className="space-y-3">
          {currentGroups.map(([groupName, groupSubs]) => (
            <SubGroup key={groupName} groupName={groupName} groupSubs={groupSubs} exchangeRate={exchangeRate} annual={!isMonthly} />
          ))}
        </div>

        {currentCount === 0 && (
          <p className="text-sm text-muted-foreground">No {view} subscriptions</p>
        )}
      </CardContent>
    </Card>
  );
}
