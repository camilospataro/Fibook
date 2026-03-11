import { ArrowUpCircle, ArrowDownCircle, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatMonthLabel } from '@/lib/formatters';
import type { SimEvent } from '@/types/simulation';

interface SimulationTimelineProps {
  events: SimEvent[];
  monthCount: number;
}

export default function SimulationTimeline({ events, monthCount }: SimulationTimelineProps) {
  // Group events by month then by day
  const months = new Map<number, SimEvent[]>();
  for (const evt of events) {
    if (!months.has(evt.monthIndex)) months.set(evt.monthIndex, []);
    months.get(evt.monthIndex)!.push(evt);
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          Event Timeline
          {monthCount > 1 && <span className="text-muted-foreground font-normal text-xs">({events.length} events)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No events to simulate. Link and enable rules above.</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {Array.from(months.entries()).map(([mi, monthEvents]) => (
              <div key={mi}>
                {monthCount > 1 && (
                  <div className="flex items-center gap-2 mt-3 mb-1.5 first:mt-0">
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {formatMonthLabel(monthEvents[0].monthLabel)}
                    </Badge>
                    <div className="flex-1 h-px bg-primary/20" />
                  </div>
                )}
                {monthEvents.map((evt, i) => {
                  const showDaySep = i === 0 || monthEvents[i - 1].day !== evt.day;
                  return (
                    <div key={`${mi}-${evt.type}-${evt.label}-${i}`}>
                      {showDaySep && (
                        <div className="flex items-center gap-2 mt-2 mb-1 first:mt-0">
                          <Badge variant="secondary" className="text-[10px] font-mono">Day {evt.day}</Badge>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 py-1 pl-2">
                        {evt.direction === 'in' ? (
                          <ArrowDownCircle className="w-3.5 h-3.5 text-income shrink-0" />
                        ) : (
                          <ArrowUpCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                        )}
                        <span className="text-xs flex-1 truncate">{evt.label}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{evt.accountName}</Badge>
                        <span className={`text-xs font-medium shrink-0 ${evt.direction === 'in' ? 'text-income' : 'text-destructive'}`}>
                          {evt.direction === 'in' ? '+' : '-'}{formatCurrency(evt.amount, evt.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
