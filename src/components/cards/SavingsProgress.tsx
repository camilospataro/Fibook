import { Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatCurrency } from '@/lib/formatters';
import { totalCheckingCOP } from '@/lib/calculations';

export default function SavingsProgress() {
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const total = totalCheckingCOP(checkingAccounts, exchangeRate);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Checking Accounts</CardTitle>
          </div>
          <span className="text-sm font-bold text-primary">{formatCOP(total)}</span>
        </div>
      </CardHeader>
      <CardContent>
        {checkingAccounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No checking accounts yet. Add them in the Monthly page.</p>
        ) : (
          <div className="space-y-2.5">
            {checkingAccounts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                  <span className="text-sm truncate">{acc.name}</span>
                </div>
                <span className="text-sm font-medium shrink-0">{formatCurrency(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
