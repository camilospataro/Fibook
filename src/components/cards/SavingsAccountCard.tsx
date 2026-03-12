import { PiggyBank } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCurrency, formatCOP } from '@/lib/formatters';

export default function SavingsAccountCard() {
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const settings = useFinanceStore(s => s.settings);
  const savingsDestId = settings?.savingsDestAccountId ?? null;
  const savingsTarget = settings?.savingsTarget ?? 0;

  const savingsAccount = savingsDestId
    ? checkingAccounts.find(a => a.id === savingsDestId)
    : null;

  if (!savingsAccount) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-primary" />
            Savings Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Set a savings destination in Monthly to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const balance = savingsAccount.currentBalance;
  const exchangeRate = settings?.exchangeRate ?? 4000;
  const balanceCOP = savingsAccount.currency === 'USD' ? balance * exchangeRate : balance;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-primary" />
          Savings Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: savingsAccount.color }} />
            <span className="text-sm font-medium">{savingsAccount.name}</span>
          </div>
          <span className="text-lg font-bold text-primary font-[family-name:var(--font-display)]">
            {formatCurrency(balance, savingsAccount.currency)}
          </span>
        </div>
        {savingsTarget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Monthly transfer</span>
              <span>{formatCOP(savingsTarget)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (balanceCOP / (savingsTarget * 12)) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">
              {formatCOP(balanceCOP)} / {formatCOP(savingsTarget * 12)} yearly goal
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
