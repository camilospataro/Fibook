import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP, formatDate } from '@/lib/formatters';

const categoryEmoji: Record<string, string> = {
  groceries: '🛒', transport: '🚗', food: '🍔', entertainment: '🎮',
  health: '💊', shopping: '🛍️', other: '📦',
};

const paymentLabel: Record<string, string> = {
  cash: 'Cash', debit: 'Debit', credit_mastercard_cop: 'MC COP',
  credit_mastercard_usd: 'MC USD', credit_visa: 'Visa',
};

export default function RecentSpending() {
  const spending = useFinanceStore(s => s.spending);
  const navigate = useNavigate();
  const recent = spending.slice(0, 5);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Recent Spending</CardTitle>
        <Button size="sm" variant="ghost" className="text-primary h-7 px-2" onClick={() => navigate('/spending')}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">No spending recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {recent.map(entry => (
              <div key={entry.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{categoryEmoji[entry.category] ?? '📦'}</span>
                  <div>
                    <p className="text-sm font-medium">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.date)} · {paymentLabel[entry.paymentMethod] ?? entry.paymentMethod}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-destructive">-{formatCOP(entry.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
