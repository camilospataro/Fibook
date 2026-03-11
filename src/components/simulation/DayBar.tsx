import { useRef, useCallback, useState } from 'react';
import type { SimRule } from '@/types/simulation';
import { formatCurrency } from '@/lib/formatters';

interface DayBarProps {
  daysInMonth: number;
  rules: SimRule[];
  onDayChange: (ruleId: string, newDay: number) => void;
}

const TICK_DAYS = [1, 5, 10, 15, 20, 25, 30];

export default function DayBar({ daysInMonth, rules, onDayChange }: DayBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [hoveredRule, setHoveredRule] = useState<string | null>(null);

  const dayToPercent = useCallback((day: number) => {
    return ((day - 1) / (daysInMonth - 1)) * 100;
  }, [daysInMonth]);

  const xToDay = useCallback((clientX: number) => {
    if (!barRef.current) return 1;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(1, Math.min(daysInMonth, Math.round(pct * (daysInMonth - 1) + 1)));
  }, [daysInMonth]);

  const handlePointerDown = useCallback((e: React.PointerEvent, ruleId: string) => {
    if (rules.find(r => r.id === ruleId)?.spread) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(ruleId);
    setDragDay(xToDay(e.clientX));
  }, [rules, xToDay]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setDragDay(xToDay(e.clientX));
  }, [dragging, xToDay]);

  const handlePointerUp = useCallback(() => {
    if (dragging && dragDay !== null) {
      onDayChange(dragging, dragDay);
    }
    setDragging(null);
    setDragDay(null);
  }, [dragging, dragDay, onDayChange]);

  const draggableRules = rules.filter(r => !r.spread && r.enabled);
  const spreadRules = rules.filter(r => r.spread && r.enabled);

  return (
    <div className="mt-1.5 mb-2">
      <div
        ref={barRef}
        className="relative h-10 select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Track */}
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-border rounded-full" />

        {/* Tick marks */}
        {TICK_DAYS.filter(d => d <= daysInMonth).map(d => (
          <div
            key={d}
            className="absolute top-4 flex flex-col items-center"
            style={{ left: `${dayToPercent(d)}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-px h-2 bg-border" />
            <span className="text-[8px] text-muted-foreground mt-0.5">{d}</span>
          </div>
        ))}

        {/* Spread rules — dashed line */}
        {spreadRules.map(rule => (
          <div
            key={rule.id}
            className="absolute top-[18px] left-0 right-0 h-[2px] border-t border-dashed"
            style={{ borderColor: rule.direction === 'in' ? 'hsl(var(--income))' : 'hsl(var(--destructive))', opacity: 0.4 }}
            title={`${rule.name} — spread across month`}
          />
        ))}

        {/* Draggable markers */}
        {draggableRules.map(rule => {
          const effectiveDay = dragging === rule.id && dragDay !== null ? dragDay : rule.day;
          const isIn = rule.direction === 'in';
          const color = isIn ? 'bg-income' : 'bg-destructive';
          const isActive = dragging === rule.id;

          return (
            <div
              key={rule.id}
              className={`absolute top-2.5 flex flex-col items-center cursor-grab ${isActive ? 'z-20 cursor-grabbing' : 'z-10'}`}
              style={{ left: `${dayToPercent(effectiveDay)}%`, transform: 'translateX(-50%)' }}
              onPointerDown={e => handlePointerDown(e, rule.id)}
              onMouseEnter={() => setHoveredRule(rule.id)}
              onMouseLeave={() => setHoveredRule(null)}
            >
              <div className={`w-3.5 h-3.5 rounded-full ${color} border-2 border-background flex items-center justify-center shadow-sm transition-transform ${isActive ? 'scale-125' : 'hover:scale-110'}`}>
                <span className="text-[7px] font-bold text-background">{isIn ? '+' : '-'}</span>
              </div>

              {/* Tooltip */}
              {(hoveredRule === rule.id || isActive) && (
                <div className="absolute -top-8 whitespace-nowrap bg-popover border border-border rounded px-1.5 py-0.5 shadow-md pointer-events-none">
                  <span className="text-[9px]">
                    {rule.name} — Day {effectiveDay} — {formatCurrency(rule.amount, rule.currency)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
