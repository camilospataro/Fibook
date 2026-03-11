import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { CheckingAccount } from '@/types';
import type { ChartPoint, SimEvent } from '@/types/simulation';
import { formatCurrency } from '@/lib/formatters';

interface CashFlowCalendarProps {
  chartData: ChartPoint[];
  events: SimEvent[];
  checkingAccounts: CheckingAccount[];
  startMonth: string;
  monthCount: number;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CashFlowCalendar({
  chartData,
  events,
  checkingAccounts,
  startMonth,
  monthCount,
}: CashFlowCalendarProps) {
  // If multiple accounts, let user pick which to visualize
  const [selectedAccountId, setSelectedAccountId] = useState(checkingAccounts[0]?.id ?? '');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const selectedAccount = checkingAccounts.find(a => a.id === selectedAccountId);

  // Build per-month calendar grids
  const months = useMemo(() => {
    const result: {
      label: string;
      monthStr: string;
      days: {
        day: number;
        balance: number;
        events: SimEvent[];
        isWeekend: boolean;
        change: number;
      }[];
      startDow: number; // 0=Mon
    }[] = [];

    let chartIndex = 1; // skip "Start"

    for (let mi = 0; mi < monthCount; mi++) {
      const [y, m] = startMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + mi, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const startDow = (d.getDay() + 6) % 7; // Convert Sun=0 to Mon=0
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const monthDays: typeof result[0]['days'] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(d.getFullYear(), d.getMonth(), day);
        const dow = dateObj.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const point = chartData[chartIndex];
        const prevPoint = chartIndex > 0 ? chartData[chartIndex - 1] : null;
        const balance = point ? Number(point[selectedAccountId] ?? 0) : 0;
        const prevBalance = prevPoint ? Number(prevPoint[selectedAccountId] ?? 0) : balance;
        const change = balance - prevBalance;

        const dayEvents = events.filter(e => e.monthIndex === mi && e.day === day);

        monthDays.push({ day, balance, events: dayEvents, isWeekend, change });
        chartIndex++;
      }

      result.push({ label, monthStr, days: monthDays, startDow });
    }

    return result;
  }, [chartData, events, checkingAccounts, selectedAccountId, startMonth, monthCount]);

  // Determine color range for the selected account
  const { minBalance, maxBalance } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const month of months) {
      for (const day of month.days) {
        if (day.balance < min) min = day.balance;
        if (day.balance > max) max = day.balance;
      }
    }
    return { minBalance: min, maxBalance: max };
  }, [months]);

  function balanceToColor(balance: number): string {
    if (balance < 0) return 'hsl(0 80% 40%)'; // red for negative
    if (maxBalance === minBalance) return 'hsl(160 60% 30%)';
    const ratio = Math.max(0, Math.min(1, (balance - minBalance) / (maxBalance - minBalance)));
    // Interpolate: red (0%) → yellow (40%) → green (100%)
    if (ratio < 0.4) {
      const t = ratio / 0.4;
      const h = t * 45; // 0 → 45 (red to yellow-ish)
      return `hsl(${h} 70% ${25 + t * 10}%)`;
    }
    const t = (ratio - 0.4) / 0.6;
    const h = 45 + t * 115; // 45 → 160 (yellow to green)
    return `hsl(${h} 60% ${30 + t * 8}%)`;
  }

  // Find hovered day data
  const hoveredDayData = useMemo(() => {
    if (hoveredDay === null) return null;
    for (const month of months) {
      const d = month.days.find(d => d.day === hoveredDay);
      if (d) return { ...d, monthLabel: month.label };
    }
    return null;
  }, [hoveredDay, months]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Cash Flow Calendar</CardTitle>
          {checkingAccounts.length > 1 && (
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-6 text-[10px] w-32 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {checkingAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {months.map((month, mi) => (
          <div key={mi}>
            <p className="text-[11px] font-medium mb-1.5">{month.label}</p>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
              {WEEKDAY_LABELS.map(w => (
                <div key={w} className="text-[8px] text-muted-foreground text-center">{w}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {/* Empty cells for start offset */}
              {Array.from({ length: month.startDow }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {month.days.map(day => {
                const hasEvents = day.events.length > 0;
                const hasIncome = day.events.some(e => e.direction === 'in');
                const hasExpense = day.events.some(e => e.direction === 'out');
                const isHovered = hoveredDay === day.day && mi === months.indexOf(month);

                return (
                  <div
                    key={day.day}
                    className={`aspect-square rounded-sm flex flex-col items-center justify-center relative cursor-pointer transition-all ${
                      isHovered ? 'ring-1 ring-primary scale-110 z-10' : ''
                    } ${day.isWeekend ? 'opacity-80' : ''}`}
                    style={{ backgroundColor: balanceToColor(day.balance) }}
                    onMouseEnter={() => setHoveredDay(day.day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    <span className="text-[9px] font-medium text-white/90 leading-none">{day.day}</span>
                    {hasEvents && (
                      <div className="flex gap-px mt-px">
                        {hasIncome && <div className="w-1 h-1 rounded-full bg-white/80" />}
                        {hasExpense && <div className="w-1 h-1 rounded-full bg-white/40" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: balanceToColor(minBalance) }} />
            <span className="text-[9px] text-muted-foreground">
              Low ({selectedAccount ? formatCurrency(minBalance, selectedAccount.currency) : ''})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: balanceToColor(maxBalance) }} />
            <span className="text-[9px] text-muted-foreground">
              High ({selectedAccount ? formatCurrency(maxBalance, selectedAccount.currency) : ''})
            </span>
          </div>
        </div>

        {/* Hover detail */}
        {hoveredDayData && selectedAccount && (
          <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium">Day {hoveredDayData.day}</span>
              <span className={`text-[11px] font-bold ${hoveredDayData.balance < 0 ? 'text-destructive' : ''}`}>
                {formatCurrency(hoveredDayData.balance, selectedAccount.currency)}
              </span>
            </div>
            {hoveredDayData.change !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground">Change</span>
                <span className={`text-[10px] font-medium ${hoveredDayData.change > 0 ? 'text-income' : 'text-destructive'}`}>
                  {hoveredDayData.change > 0 ? '+' : ''}{formatCurrency(hoveredDayData.change, selectedAccount.currency)}
                </span>
              </div>
            )}
            {hoveredDayData.events.length > 0 && (
              <div className="space-y-0.5 pt-0.5 border-t border-border/50">
                {hoveredDayData.events.map((evt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {evt.direction === 'in' ? (
                      <ArrowDownCircle className="w-2.5 h-2.5 text-income shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-2.5 h-2.5 text-destructive shrink-0" />
                    )}
                    <span className="text-[9px] flex-1 truncate">{evt.label}</span>
                    <span className={`text-[9px] font-medium ${evt.direction === 'in' ? 'text-income' : 'text-destructive'}`}>
                      {evt.direction === 'in' ? '+' : '-'}{formatCurrency(evt.amount, evt.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
