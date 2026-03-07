import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatCOP } from '@/lib/formatters';

export default function SavingsProgress() {
  const snapshots = useFinanceStore(s => s.snapshots);
  const latestSavings = snapshots.length > 0 ? snapshots[0].savings : 0;
  const savingsGoal = 50_000_000;
  const progress = Math.min((latestSavings / savingsGoal) * 100, 100);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Savings Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current</span>
            <span className="font-bold text-income">{formatCOP(latestSavings)}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.toFixed(0)}%</span>
            <span>Goal: {formatCOP(savingsGoal)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
