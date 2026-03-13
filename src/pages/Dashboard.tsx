import { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, CreditCard, PiggyBank, Landmark, GripVertical } from 'lucide-react';
import KpiCard from '@/components/cards/KpiCard';
import DebtPayoffChart from '@/components/charts/DebtPayoffChart';
import SavingsProjectionChart from '@/components/charts/SavingsProjectionChart';
import MonthlySpending from '@/components/cards/MonthlySpending';
import SubscriptionsSummary from '@/components/cards/SubscriptionsSummary';
import SavingsProgress from '@/components/cards/SavingsProgress';
import AiInsights from '@/components/cards/AiInsights';
import ExpensesBreakdown from '@/components/cards/ExpensesBreakdown';
import TrendsCard from '@/components/cards/TrendsCard';
import NetWorthCard from '@/components/cards/NetWorthCard';
import { useFinanceStore } from '@/store/useFinanceStore';
import { totalDebtCOP, totalCheckingCOP, totalMonthlyIncome, totalMonthlyExpenses } from '@/lib/calculations';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_ORDER = ['kpi', 'spending', 'projections', 'networth', 'ai', 'bottom'];

function DashSortableSection({ id, dragMode, children }: { id: string; dragMode: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !dragMode });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      {dragMode && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-md bg-secondary/80 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shadow-sm"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const accounts = useFinanceStore(s => s.debtAccounts);
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subs = useFinanceStore(s => s.subscriptions);
  const settings = useFinanceStore(s => s.settings);
  const exchangeRate = settings?.exchangeRate ?? 4000;
  const savingsDestId = settings?.savingsDestAccountId ?? null;

  const debt = totalDebtCOP(accounts, exchangeRate);
  const checkingOnly = checkingAccounts.filter(a => a.id !== savingsDestId);
  const checking = totalCheckingCOP(checkingOnly, exchangeRate);
  const savingsAccount = savingsDestId ? checkingAccounts.find(a => a.id === savingsDestId) : null;
  const savingsBalance = savingsAccount
    ? (savingsAccount.currency === 'USD' ? savingsAccount.currentBalance * exchangeRate : savingsAccount.currentBalance)
    : 0;
  const income = totalMonthlyIncome(incomeSources, exchangeRate);
  const expenses = totalMonthlyExpenses(fixedExpenses, accounts, subs, exchangeRate);

  const [dragMode, setDragMode] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    try { const s = localStorage.getItem('dashCardOrder'); return s ? JSON.parse(s) : DEFAULT_ORDER; } catch { return DEFAULT_ORDER; }
  });
  useEffect(() => { localStorage.setItem('dashCardOrder', JSON.stringify(cardOrder)); }, [cardOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      setCardOrder(prev => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  const sectionMap: Record<string, React.ReactNode> = {
    kpi: (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <KpiCard title="Checking" value={checking} prefix="$" suffix=" COP" icon={Landmark} color="#00D4AA" separator="." />
        <KpiCard title="Savings" value={savingsBalance} prefix="$" suffix=" COP" icon={PiggyBank} color="#00D4AA" separator="." />
        <KpiCard title="Income" value={income} prefix="$" suffix=" COP" icon={DollarSign} color="#00D4AA" separator="." />
        <KpiCard title="Expenses" value={expenses} prefix="$" suffix=" COP" icon={TrendingDown} color="#FBBF24" separator="." />
        <KpiCard title="Total Debt" value={debt} prefix="$" suffix=" COP" icon={CreditCard} color="#FF6B6B" separator="." />
      </div>
    ),
    spending: <MonthlySpending />,
    projections: (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DebtPayoffChart />
        <SavingsProjectionChart />
      </div>
    ),
    networth: (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NetWorthCard />
        <TrendsCard />
      </div>
    ),
    ai: <AiInsights />,
    bottom: (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ExpensesBreakdown />
        <SubscriptionsSummary />
        <SavingsProgress />
      </div>
    ),
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Dashboard</h1>
        <button
          onClick={() => setDragMode(p => !p)}
          className={`p-2 rounded-lg border text-xs font-medium transition-colors ${dragMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}
          title="Reorder cards"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {cardOrder.map(key => (
              <DashSortableSection key={key} id={key} dragMode={dragMode}>
                {sectionMap[key]}
              </DashSortableSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
