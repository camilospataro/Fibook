import { DollarSign, TrendingDown, CreditCard, PiggyBank } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import KpiCard from '@/components/cards/KpiCard';
import DebtDonut from '@/components/charts/DebtDonut';
import IncomeExpenseChart from '@/components/charts/IncomeExpenseChart';
import RecentSpending from '@/components/cards/RecentSpending';
import SubscriptionsSummary from '@/components/cards/SubscriptionsSummary';
import SavingsProgress from '@/components/cards/SavingsProgress';
import AiInsights from '@/components/cards/AiInsights';
import { useFinanceStore } from '@/store/useFinanceStore';
import { totalDebtCOP, totalMonthlyIncome, totalMonthlyExpenses, monthsToPayoff, totalMinimumPaymentsCOP } from '@/lib/calculations';

export default function Dashboard() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subs = useFinanceStore(s => s.subscriptions);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);

  const debt = totalDebtCOP(accounts, exchangeRate);
  const income = totalMonthlyIncome(incomeSources);
  const expenses = totalMonthlyExpenses(fixedExpenses, accounts, subs, exchangeRate);
  const balance = income - expenses;
  const minPayments = totalMinimumPaymentsCOP(accounts, exchangeRate);
  const payoffMonths = monthsToPayoff(debt, minPayments);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Dashboard</h1>
        {payoffMonths !== Infinity && payoffMonths > 0 && (
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
            Debt-free in ~{payoffMonths} months
          </Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Debt" value={debt} prefix="$" icon={CreditCard} color="#FF6B6B" separator="." />
        <KpiCard title="Monthly Income" value={income} prefix="$" icon={DollarSign} color="#00D4AA" separator="." />
        <KpiCard title="Monthly Expenses" value={expenses} prefix="$" icon={TrendingDown} color="#FBBF24" separator="." />
        <KpiCard title="Monthly Balance" value={balance} prefix="$" icon={PiggyBank} color={balance >= 0 ? '#00D4AA' : '#FF6B6B'} separator="." />
      </div>

      {/* AI Insights */}
      <AiInsights />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DebtDonut />
        <IncomeExpenseChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentSpending />
        <SubscriptionsSummary />
        <SavingsProgress />
      </div>
    </div>
  );
}
