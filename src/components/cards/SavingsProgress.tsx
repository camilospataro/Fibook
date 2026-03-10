import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP } from '@/lib/formatters';

export default function SavingsProgress() {
  const snapshots = useFinanceStore(s => s.snapshots);
  const savingsTarget = useFinanceStore(s => s.settings?.savingsTarget ?? 0);
  const totalSaved = snapshots.reduce((sum, s) => sum + (s.savings ?? 0), 0);
  const yearlyGoal = savingsTarget * 12;
  const progress = yearlyGoal > 0 ? Math.min((totalSaved / yearlyGoal) * 100, 100) : 0;

  if (savingsTarget <= 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Savings Progress</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm">Set a savings goal in the Monthly page.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Savings Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Saved</span>
            <span className="font-bold text-income">{formatCOP(totalSaved)}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.toFixed(0)}%</span>
            <span>Yearly Goal: {formatCOP(yearlyGoal)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
