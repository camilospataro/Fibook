import { DollarSign, TrendingDown, CreditCard, PiggyBank, Landmark } from 'lucide-react';
import KpiCard from '@/components/cards/KpiCard';
import DebtPayoffChart from '@/components/charts/DebtPayoffChart';
import SavingsProjectionChart from '@/components/charts/SavingsProjectionChart';
import MonthlySpending from '@/components/cards/MonthlySpending';
import SubscriptionsSummary from '@/components/cards/SubscriptionsSummary';
import SavingsProgress from '@/components/cards/SavingsProgress';
import AiInsights from '@/components/cards/AiInsights';
import ExpensesBreakdown from '@/components/cards/ExpensesBreakdown';
import { useFinanceStore } from '@/store/useFinanceStore';
import { totalDebtCOP, totalSavingsCOP, totalMonthlyIncome, totalMonthlyExpenses } from '@/lib/calculations';

export default function Dashboard() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const savingsAccounts = useFinanceStore(s => s.savingsAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subs = useFinanceStore(s => s.subscriptions);
  const exchangeRate = useFinanceStore(s => s.settings?.exchangeRate ?? 4000);

  const debt = totalDebtCOP(accounts, exchangeRate);
  const savings = totalSavingsCOP(savingsAccounts, exchangeRate);
  const income = totalMonthlyIncome(incomeSources, exchangeRate);
  const expenses = totalMonthlyExpenses(fixedExpenses, accounts, subs, exchangeRate);
  const balance = income - expenses;
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard title="Monthly Income" value={income} prefix="$" suffix=" COP" icon={DollarSign} color="#00D4AA" separator="." />
        <KpiCard title="Monthly Expenses" value={expenses} prefix="$" suffix=" COP" icon={TrendingDown} color="#FBBF24" separator="." />
        <KpiCard title="Total Debt" value={debt} prefix="$" suffix=" COP" icon={CreditCard} color="#FF6B6B" separator="." />
        <KpiCard title="Total Savings" value={savings} prefix="$" suffix=" COP" icon={Landmark} color="#00D4AA" separator="." />
        <KpiCard title="Monthly Balance" value={balance} prefix="$" suffix=" COP" icon={PiggyBank} color={balance >= 0 ? '#00D4AA' : '#FF6B6B'} separator="." />
      </div>

      {/* Monthly Spending */}
      <MonthlySpending />

      {/* Projection Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DebtPayoffChart />
        <SavingsProjectionChart />
      </div>

      {/* AI Insights */}
      <AiInsights />

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ExpensesBreakdown />
        <SubscriptionsSummary />
        <SavingsProgress />
      </div>

    </div>
  );
}
