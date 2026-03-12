import { Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCurrency } from '@/lib/formatters';
import { totalCheckingCOP } from '@/lib/calculations';

export default function CheckingAccountsCard() {
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);
  const savingsDestId = useFinanceStore(s => s.settings?.savingsDestAccountId ?? null);

  // Filter out savings destination — that goes in the SavingsAccountCard
  const accounts = checkingAccounts.filter(a => a.id !== savingsDestId);
  const total = totalCheckingCOP(accounts, exchangeRate);

  if (accounts.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" />
            Checking Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No checking accounts set up.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" />
          Checking Accounts
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map(a => (
          <div key={a.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="text-sm font-medium">{a.name}</span>
            </div>
            <span className="text-sm font-semibold font-[family-name:var(--font-display)]">
              {formatCurrency(a.currentBalance, a.currency)}
            </span>
          </div>
        ))}
        {accounts.length > 1 && (
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total (COP)</span>
            <span className="text-sm font-bold text-primary font-[family-name:var(--font-display)]">
              {formatCurrency(total, 'COP')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
