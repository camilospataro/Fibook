import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface DayData {
  day: number;
  balance: number;
  events: SimEvent[];
  isWeekend: boolean;
  change: number;
  monthIndex: number;
}

export default function CashFlowCalendar({
  chartData,
  events,
  checkingAccounts,
  startMonth,
  monthCount,
}: CashFlowCalendarProps) {
  const [selectedAccountId, setSelectedAccountId] = useState(checkingAccounts[0]?.id ?? '');
  const [selectedDay, setSelectedDay] = useState<{ monthIndex: number; day: number } | null>(null);

  const selectedAccount = checkingAccounts.find(a => a.id === selectedAccountId);

  const months = useMemo(() => {
    const result: {
      label: string;
      monthIndex: number;
      days: DayData[];
      startDow: number;
    }[] = [];

    let chartIndex = 1;

    for (let mi = 0; mi < monthCount; mi++) {
      const [y, m] = startMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + mi, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const startDow = (d.getDay() + 6) % 7;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const monthDays: DayData[] = [];

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

        monthDays.push({ day, balance, events: dayEvents, isWeekend, change, monthIndex: mi });
        chartIndex++;
      }

      result.push({ label, monthIndex: mi, days: monthDays, startDow });
    }

    return result;
  }, [chartData, events, checkingAccounts, selectedAccountId, startMonth, monthCount]);

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
    if (balance < 0) return 'hsl(0 80% 40%)';
    if (maxBalance === minBalance) return 'hsl(160 60% 30%)';
    const ratio = Math.max(0, Math.min(1, (balance - minBalance) / (maxBalance - minBalance)));
    if (ratio < 0.4) {
      const t = ratio / 0.4;
      return `hsl(${t * 45} 70% ${25 + t * 10}%)`;
    }
    const t = (ratio - 0.4) / 0.6;
    return `hsl(${45 + t * 115} 60% ${30 + t * 8}%)`;
  }

  // Get selected day data
  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null;
    for (const month of months) {
      if (month.monthIndex !== selectedDay.monthIndex) continue;
      const d = month.days.find(d => d.day === selectedDay.day);
      if (d) return { ...d, monthLabel: month.label };
    }
    return null;
  }, [selectedDay, months]);

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
      <CardContent className="space-y-5">
        {months.map((month) => (
          <div key={month.monthIndex}>
            <p className="text-[11px] font-medium mb-1.5">{month.label}</p>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map(w => (
                <div key={w} className="text-[8px] text-muted-foreground text-center">{w}</div>
              ))}
            </div>

            {/* Calendar grid — taller cells to fit event labels */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: month.startDow }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-14" />
              ))}

              {month.days.map(day => {
                const isSelected = selectedDay?.monthIndex === month.monthIndex && selectedDay?.day === day.day;

                return (
                  <div
                    key={day.day}
                    onClick={() => setSelectedDay(
                      isSelected ? null : { monthIndex: month.monthIndex, day: day.day }
                    )}
                    className={`min-h-14 rounded-md p-0.5 cursor-pointer transition-all overflow-hidden ${
                      isSelected ? 'ring-2 ring-primary scale-[1.02] z-10' : 'hover:ring-1 hover:ring-border'
                    } ${day.isWeekend ? 'opacity-85' : ''}`}
                    style={{ backgroundColor: balanceToColor(day.balance) }}
                  >
                    {/* Day number + balance */}
                    <div className="flex items-baseline justify-between px-0.5">
                      <span className="text-[9px] font-semibold text-white/90">{day.day}</span>
                      {day.change !== 0 && (
                        <span className={`text-[7px] font-medium ${day.change > 0 ? 'text-green-200' : 'text-red-200'}`}>
                          {day.change > 0 ? '+' : ''}{abbreviateAmount(day.change)}
                        </span>
                      )}
                    </div>

                    {/* Event name tags */}
                    <div className="mt-px space-y-px">
                      {day.events.slice(0, 3).map((evt, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-px rounded-sm px-0.5 ${
                            evt.direction === 'in'
                              ? 'bg-green-900/60'
                              : 'bg-red-900/50'
                          }`}
                        >
                          <span className="text-[6.5px] leading-tight text-white/80 truncate">
                            {evt.direction === 'in' ? '↓' : '↑'} {evt.label.replace(' (spread)', '')}
                          </span>
                        </div>
                      ))}
                      {day.events.length > 3 && (
                        <span className="text-[6px] text-white/50 px-0.5">
                          +{day.events.length - 3} more
                        </span>
                      )}
                    </div>
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

        {/* Selected day detail panel */}
        {selectedDayData && selectedAccount && (
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{selectedDayData.monthLabel} — Day {selectedDayData.day}</span>
              <span className={`text-xs font-bold ${selectedDayData.balance < 0 ? 'text-destructive' : ''}`}>
                {formatCurrency(selectedDayData.balance, selectedAccount.currency)}
              </span>
            </div>
            {selectedDayData.change !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Change from previous day</span>
                <span className={`text-[11px] font-medium ${selectedDayData.change > 0 ? 'text-income' : 'text-destructive'}`}>
                  {selectedDayData.change > 0 ? '+' : ''}{formatCurrency(selectedDayData.change, selectedAccount.currency)}
                </span>
              </div>
            )}
            {selectedDayData.events.length > 0 ? (
              <div className="space-y-1 pt-1 border-t border-border/50">
                {selectedDayData.events.map((evt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {evt.direction === 'in' ? (
                      <ArrowDownCircle className="w-3.5 h-3.5 text-income shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    )}
                    <span className="text-[11px] flex-1">{evt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{evt.accountName}</span>
                    <span className={`text-[11px] font-medium ${evt.direction === 'in' ? 'text-income' : 'text-destructive'}`}>
                      {evt.direction === 'in' ? '+' : '-'}{formatCurrency(evt.amount, evt.currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
                No transactions on this day
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function abbreviateAmount(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return `${Math.round(amount)}`;
}
