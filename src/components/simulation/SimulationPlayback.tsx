import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import type { CheckingAccount } from '@/types';
import type { SimEvent, ChartPoint } from '@/types/simulation';
import { formatCurrency } from '@/lib/formatters';

interface SimulationPlaybackProps {
  chartData: ChartPoint[];
  events: SimEvent[];
  checkingAccounts: CheckingAccount[];
  activeDay: number;
  onDayChange: (dayIndex: number) => void;
}

export default function SimulationPlayback({
  chartData,
  events,
  checkingAccounts,
  activeDay,
  onDayChange,
}: SimulationPlaybackProps) {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDay = chartData.length - 1;

  // Auto-advance when playing
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        onDayChange(-1); // signal to increment
      }, 150);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, onDayChange]);

  // Stop at end
  useEffect(() => {
    if (activeDay >= maxDay && playing) {
      setPlaying(false);
    }
  }, [activeDay, maxDay, playing]);

  const togglePlay = useCallback(() => {
    if (activeDay >= maxDay) {
      onDayChange(1); // reset to day 1 before playing
      setPlaying(true);
    } else {
      setPlaying(p => !p);
    }
  }, [activeDay, maxDay, onDayChange]);

  // Get current point data
  const currentPoint = chartData[activeDay];
  const prevPoint = activeDay > 0 ? chartData[activeDay - 1] : null;

  // Get events for this day by matching dayLabel in chartData
  const dayLabel = currentPoint?.dayLabel ?? '';
  const dayEvents = events.filter(e => {
    const idx = findEventDayIndex(e, chartData);
    return idx === activeDay;
  });

  return (
    <div className="space-y-3">
      {/* Scrubber controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDayChange(1)}
          disabled={activeDay <= 1}
        >
          <SkipBack className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant={playing ? 'secondary' : 'default'}
          size="icon"
          className="h-8 w-8"
          onClick={togglePlay}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDayChange(maxDay)}
          disabled={activeDay >= maxDay}
        >
          <SkipForward className="w-3.5 h-3.5" />
        </Button>

        <div className="flex-1 px-2">
          <Slider
            value={[activeDay]}
            min={0}
            max={maxDay}
            step={1}
            onValueChange={v => { setPlaying(false); onDayChange(v[0]); }}
            className="cursor-pointer"
          />
        </div>

        <Badge variant="outline" className="text-[10px] font-mono shrink-0 min-w-12 justify-center">
          {activeDay === 0 ? 'Start' : dayLabel}
        </Badge>
      </div>

      {/* Day detail card */}
      {activeDay > 0 && currentPoint && (
        <Card className="bg-secondary/30 border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Day {dayLabel}</span>
              <span className="text-[10px] text-muted-foreground">
                {dayEvents.length} transaction{dayEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Account balances */}
            <div className="grid gap-1.5 mb-2">
              {checkingAccounts.map(acc => {
                const balance = Number(currentPoint[acc.id] ?? 0);
                const prevBalance = prevPoint ? Number(prevPoint[acc.id] ?? 0) : acc.currentBalance;
                const change = balance - prevBalance;
                const isNegative = balance < 0;

                return (
                  <div key={acc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                      <span className="text-[11px]">{acc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${isNegative ? 'text-destructive' : ''}`}>
                        {formatCurrency(balance, acc.currency)}
                      </span>
                      {change !== 0 && (
                        <span className={`text-[9px] ${change > 0 ? 'text-income' : 'text-destructive'}`}>
                          {change > 0 ? '+' : ''}{formatCurrency(change, acc.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day's events */}
            {dayEvents.length > 0 && (
              <div className="border-t border-border/50 pt-1.5 space-y-0.5">
                {dayEvents.map((evt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {evt.direction === 'in' ? (
                      <ArrowDownCircle className="w-3 h-3 text-income shrink-0" />
                    ) : (
                      <ArrowUpCircle className="w-3 h-3 text-destructive shrink-0" />
                    )}
                    <span className="text-[10px] flex-1 truncate">{evt.label}</span>
                    <span className={`text-[10px] font-medium ${evt.direction === 'in' ? 'text-income' : 'text-destructive'}`}>
                      {evt.direction === 'in' ? '+' : '-'}{formatCurrency(evt.amount, evt.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Match event to chartData index by walking through days per month
function findEventDayIndex(event: SimEvent, chartData: ChartPoint[]): number {
  // chartData layout: [Start, M0D1, M0D2, ..., M0D31, M1D1, ...]
  // We track month boundaries by watching for day resets
  let monthIdx = 0;
  for (let i = 1; i < chartData.length; i++) {
    const label = chartData[i].dayLabel;
    const dayNum = parseInt(label.split(' ').pop() ?? label, 10);
    const prevLabel = chartData[i - 1]?.dayLabel ?? '';
    const prevDayNum = parseInt(prevLabel.split(' ').pop() ?? prevLabel, 10);

    // Detect month boundary (day goes from high to 1)
    if (i > 1 && dayNum === 1 && prevDayNum > 1) monthIdx++;

    if (monthIdx === event.monthIndex && dayNum === event.day) return i;
  }
  return -1;
}
