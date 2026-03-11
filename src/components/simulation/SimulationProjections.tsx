import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { CheckingAccount } from '@/types';
import type { AccountState, MonthAccuracy } from '@/types/simulation';
import { formatCOP, formatCurrency, getCurrentMonth, formatMonthLabel } from '@/lib/formatters';

interface SimulationProjectionsProps {
  accountStates: AccountState[];
  totalIn: number;
  totalOut: number;
  checkingAccounts: CheckingAccount[];
  userId: string | null;
  startMonth: string;
}

const ACCURACY_KEY_PREFIX = 'sim-accuracy-';

export default function SimulationProjections({
  accountStates,
  totalIn,
  totalOut,
  checkingAccounts,
  userId,
  startMonth,
}: SimulationProjectionsProps) {
  const [showAccuracy, setShowAccuracy] = useState(false);

  // Save projections for current month to localStorage
  useEffect(() => {
    if (!userId || accountStates.length === 0) return;
    const data: MonthAccuracy = {
      month: startMonth,
      projections: accountStates.map(a => ({
        accountId: a.id,
        accountName: a.name,
        projected: Math.round(a.monthlyEndBalances[0] * 100) / 100,
        actual: null,
        accuracyPct: null,
      })),
      simulatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${ACCURACY_KEY_PREFIX}${userId}-${startMonth}`, JSON.stringify(data));
  }, [userId, accountStates, startMonth]);

  // Load past accuracy records
  const pastAccuracy = useMemo(() => {
    if (!userId) return [];
    const currentMonth = getCurrentMonth();
    const records: (MonthAccuracy & { computed: boolean })[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${ACCURACY_KEY_PREFIX}${userId}-`)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const data: MonthAccuracy = JSON.parse(raw);
        // Only show accuracy for months that have passed
        if (data.month >= currentMonth) continue;

        const computed = data.projections.map(p => {
          const acc = checkingAccounts.find(a => a.id === p.accountId);
          if (!acc) return p;
          // Use current balance as the "actual" for past months
          // (this is approximate — true accuracy needs snapshot data)
          const actual = acc.currentBalance;
          const diff = Math.abs(p.projected - actual);
          const accuracyPct = actual !== 0 ? Math.max(0, Math.round((1 - diff / Math.abs(actual)) * 100)) : (p.projected === 0 ? 100 : 0);
          return { ...p, actual, accuracyPct };
        });

        records.push({ ...data, projections: computed, computed: true });
      } catch { /* skip corrupt entries */ }
    }

    records.sort((a, b) => b.month.localeCompare(a.month));
    return records;
  }, [userId, checkingAccounts]);

  return (
    <Card className="bg-card border-primary/20 border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Projected Balances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {accountStates.map(acc => {
          const diff = acc.endBalance - acc.startBalance;
          return (
            <div key={acc.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span className="text-sm">{acc.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">{formatCurrency(acc.endBalance, acc.currency)}</span>
                  <span className={`text-[11px] ml-2 ${diff >= 0 ? 'text-income' : 'text-destructive'}`}>
                    {diff >= 0 ? '+' : ''}{formatCurrency(diff, acc.currency)}
                  </span>
                </div>
              </div>
              {/* Month-by-month breakdown if multi-month */}
              {acc.monthlyEndBalances.length > 1 && (
                <div className="pl-5 flex gap-2 mt-0.5 overflow-x-auto">
                  {acc.monthlyEndBalances.map((bal, mi) => (
                    <span key={mi} className="text-[9px] text-muted-foreground whitespace-nowrap">
                      M{mi + 1}: {formatCurrency(bal, acc.currency)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <Separator />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total In: <span className="text-income font-medium">{formatCOP(totalIn)}</span></span>
          <span>Total Out: <span className="text-destructive font-medium">{formatCOP(totalOut)}</span></span>
        </div>

        {/* Past accuracy */}
        {pastAccuracy.length > 0 && (
          <>
            <Separator />
            <button
              onClick={() => setShowAccuracy(!showAccuracy)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showAccuracy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Past Accuracy ({pastAccuracy.length} {pastAccuracy.length === 1 ? 'month' : 'months'})
            </button>
            {showAccuracy && (
              <div className="space-y-2">
                {pastAccuracy.map(record => (
                  <div key={record.month} className="bg-secondary/50 rounded-lg p-2">
                    <p className="text-[11px] font-medium mb-1">{formatMonthLabel(record.month)}</p>
                    <div className="space-y-0.5">
                      {record.projections.map(p => (
                        <div key={p.accountId} className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">{p.accountName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              Proj: {formatCurrency(p.projected, checkingAccounts.find(a => a.id === p.accountId)?.currency ?? 'COP')}
                            </span>
                            {p.actual !== null && (
                              <span className="text-muted-foreground">
                                Act: {formatCurrency(p.actual, checkingAccounts.find(a => a.id === p.accountId)?.currency ?? 'COP')}
                              </span>
                            )}
                            {p.accuracyPct !== null && (
                              <Badge
                                variant="secondary"
                                className={`text-[9px] ${
                                  p.accuracyPct >= 90 ? 'text-income' :
                                  p.accuracyPct >= 70 ? 'text-warning' :
                                  'text-destructive'
                                }`}
                              >
                                {p.accuracyPct}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
