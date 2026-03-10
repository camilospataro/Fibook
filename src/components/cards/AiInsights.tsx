import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFinanceStore } from '@/store/useFinanceStore';
import { supabase } from '@/lib/supabase';
import { totalDebtCOP, totalMonthlyIncome, totalMonthlyExpenses, totalSubscriptionsCOP } from '@/lib/calculations';
import { getCurrentMonth } from '@/lib/formatters';

export default function AiInsights() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subs = useFinanceStore(s => s.subscriptions);
  const spending = useFinanceStore(s => s.spending);
  const snapshots = useFinanceStore(s => s.snapshots);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);

  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsights() {
    setLoading(true);
    setError(null);

    const currentMonth = getCurrentMonth();
    const monthSpending = spending.filter(e => e.date.startsWith(currentMonth));
    const totalSpentThisMonth = monthSpending.reduce((s, e) => s + e.amount, 0);

    const financialData = {
      exchangeRate,
      totalDebt: totalDebtCOP(accounts, exchangeRate),
      debtAccounts: accounts.map(a => ({
        name: a.name,
        currency: a.currency,
        balance: a.currentBalance,
        minimumPayment: a.minimumMonthlyPayment,
      })),
      monthlyIncome: totalMonthlyIncome(incomeSources, exchangeRate),
      monthlyExpenses: totalMonthlyExpenses(fixedExpenses, accounts, subs, exchangeRate),
      subscriptionsCost: totalSubscriptionsCOP(subs, exchangeRate),
      activeSubscriptions: subs.filter(s => s.active).length,
      spentThisMonth: totalSpentThisMonth,
      spendingByCategory: monthSpending.reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amount;
        return acc;
      }, {}),
      recentSnapshots: snapshots.slice(0, 3).map(s => ({
        month: s.month,
        income: s.totalIncome,
        expenses: s.totalExpenses,
        balance: s.balance,
        savings: s.savings,
      })),
    };

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-insights', {
        body: { financialData },
      });

      if (fnError) {
        setError(fnError.message || 'Failed to get insights');
      } else {
        setInsights(data.insights);
      }
    } catch {
      setError('Could not connect to AI service');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-card border-border border-primary/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">AI Insights</CardTitle>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-primary"
          onClick={fetchInsights}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : insights ? (
            <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh</>
          ) : (
            'Analyze'
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
        {!insights && !loading && !error && (
          <p className="text-muted-foreground text-sm">
            Click <strong>Analyze</strong> to get AI-powered insights about your finances.
          </p>
        )}
        {loading && (
          <div className="space-y-2">
            <div className="h-3 bg-secondary rounded animate-pulse w-full" />
            <div className="h-3 bg-secondary rounded animate-pulse w-4/5" />
            <div className="h-3 bg-secondary rounded animate-pulse w-3/5" />
          </div>
        )}
        {insights && !loading && (
          <div
            className="text-sm text-foreground/90 space-y-1 [&_ul]:space-y-1.5 [&_li]:text-sm [&_strong]:text-primary"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(insights) }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br/>');
}
