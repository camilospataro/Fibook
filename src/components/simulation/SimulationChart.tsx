import { useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Customized } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CheckingAccount } from '@/types';
import type { ChartPoint, ScenarioResult, SimEvent } from '@/types/simulation';
import { formatCurrency } from '@/lib/formatters';

interface SimulationChartProps {
  chartData: ChartPoint[];
  checkingAccounts: CheckingAccount[];
  monthBoundaries: number[];
  monthCount: number;
  events: SimEvent[];
  scenarioResults?: ScenarioResult[];
  activeDay?: number;
  onDayClick?: (dayIndex: number) => void;
}

// Group events by their chart index to position tags
function buildEventTags(events: SimEvent[], chartData: ChartPoint[]) {
  const tags: { dayIndex: number; dayLabel: string; items: { label: string; direction: 'in' | 'out' }[] }[] = [];
  const byIndex = new Map<number, { label: string; direction: 'in' | 'out' }[]>();

  let monthIdx = 0;
  const dayLabelToIndex = new Map<string, { index: number; monthIdx: number }>();

  for (let i = 1; i < chartData.length; i++) {
    const label = chartData[i].dayLabel;
    const dayNum = parseInt(label.split(' ').pop() ?? label, 10);
    const prevLabel = chartData[i - 1]?.dayLabel ?? '';
    const prevDayNum = parseInt(prevLabel.split(' ').pop() ?? prevLabel, 10);
    if (i > 1 && dayNum === 1 && prevDayNum > 1) monthIdx++;
    dayLabelToIndex.set(`${monthIdx}-${dayNum}`, { index: i, monthIdx });
  }

  for (const evt of events) {
    const key = `${evt.monthIndex}-${evt.day}`;
    const entry = dayLabelToIndex.get(key);
    if (!entry) continue;
    if (!byIndex.has(entry.index)) byIndex.set(entry.index, []);
    byIndex.get(entry.index)!.push({ label: evt.label, direction: evt.direction });
  }

  for (const [idx, items] of byIndex) {
    // Dedupe and limit to 3 tags per day for readability
    const unique = items.reduce((acc, item) => {
      if (!acc.some(a => a.label === item.label)) acc.push(item);
      return acc;
    }, [] as typeof items);
    tags.push({ dayIndex: idx, dayLabel: chartData[idx].dayLabel, items: unique.slice(0, 3) });
  }

  return tags;
}

// Custom renderer for event annotations on the chart
function EventAnnotations(props: {
  tags: ReturnType<typeof buildEventTags>;
  xAxisMap?: Record<string, { scale: (v: string) => number; bandwidth?: () => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  offset?: { top: number; bottom: number; left: number; right: number };
}) {
  const { tags, xAxisMap, yAxisMap } = props;
  if (!xAxisMap || !yAxisMap) return null;

  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const bandwidth = xAxis.bandwidth ? xAxis.bandwidth() : 0;

  return (
    <g className="event-annotations">
      {tags.map((tag, ti) => {
        const x = xAxis.scale(tag.dayLabel) + bandwidth / 2;
        if (x === undefined || isNaN(x)) return null;

        // Stagger vertically to avoid overlap
        const baseY = 12;

        return (
          <g key={ti}>
            {tag.items.map((item, ii) => {
              const y = baseY + ii * 14;
              const isIn = item.direction === 'in';
              const truncated = item.label.length > 12 ? item.label.slice(0, 11) + '…' : item.label;

              return (
                <g key={ii}>
                  <rect
                    x={x - 2}
                    y={y - 5}
                    width={truncated.length * 5.2 + 14}
                    height={12}
                    rx={3}
                    fill={isIn ? 'hsla(160, 60%, 40%, 0.85)' : 'hsla(0, 60%, 45%, 0.75)'}
                  />
                  <text
                    x={x + 5}
                    y={y + 3}
                    fontSize={8}
                    fontWeight={500}
                    fill="white"
                  >
                    {isIn ? '↓ ' : '↑ '}{truncated}
                  </text>
                </g>
              );
            })}
            {/* Connector line from tag to axis */}
            <line
              x1={x}
              y1={baseY + tag.items.length * 14 - 6}
              x2={x}
              y2={baseY + tag.items.length * 14 + 4}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={0.5}
              strokeDasharray="2 2"
              opacity={0.4}
            />
          </g>
        );
      })}
    </g>
  );
}

export default function SimulationChart({
  chartData,
  checkingAccounts,
  monthBoundaries,
  monthCount,
  events,
  scenarioResults,
  activeDay,
  onDayClick,
}: SimulationChartProps) {
  if (chartData.length === 0 || checkingAccounts.length === 0) return null;

  const totalPoints = chartData.length;
  const tickInterval = totalPoints > 120 ? 14 : totalPoints > 60 ? 7 : totalPoints > 30 ? 3 : 1;

  const tags = useMemo(() => buildEventTags(events, chartData), [events, chartData]);

  const handleClick = useCallback((data: { activeTooltipIndex?: number }) => {
    if (data?.activeTooltipIndex !== undefined && onDayClick) {
      onDayClick(data.activeTooltipIndex);
    }
  }, [onDayClick]);

  const activeDayLabel = activeDay !== undefined && activeDay > 0 && activeDay < chartData.length
    ? chartData[activeDay].dayLabel
    : undefined;

  // Compute top margin based on max stacked tags
  const maxTagStack = tags.reduce((m, t) => Math.max(m, t.items.length), 0);
  const topMargin = Math.max(5, maxTagStack * 14 + 10);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Monthly Cash Flow
          {monthCount > 1 && <span className="text-muted-foreground font-normal ml-1">({monthCount} months)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: topMargin, right: 5, bottom: 5, left: 5 }}
              onClick={handleClick}
              className={onDayClick ? 'cursor-crosshair' : ''}
            >
              <defs>
                {checkingAccounts.map(acc => (
                  <linearGradient key={`grad-${acc.id}`} id={`grad-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={acc.color} stopOpacity={0.3} />
                    <stop offset="60%" stopColor={acc.color} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={acc.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => {
                  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return v;
                }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 11,
                  maxWidth: 260,
                }}
                labelFormatter={v => `Day ${v}`}
                formatter={(value: number, name: string) => {
                  if (name.includes('_') && name.length > 30) return null;
                  const acc = checkingAccounts.find(a => a.id === name);
                  if (!acc) return [value, name];
                  return [formatCurrency(value, acc.currency), acc.name];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" opacity={0.5} />

              {activeDayLabel && (
                <ReferenceLine
                  x={activeDayLabel}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  opacity={0.8}
                />
              )}

              {monthCount > 1 && monthBoundaries.slice(1).map((boundary, i) => (
                <ReferenceLine
                  key={`mb-${i}`}
                  x={chartData[boundary]?.dayLabel}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  opacity={0.4}
                />
              ))}

              {checkingAccounts.map(acc => (
                <Area
                  key={acc.id}
                  type="stepAfter"
                  dataKey={acc.id}
                  name={acc.id}
                  stroke={acc.color}
                  fill={`url(#grad-${acc.id})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                />
              ))}

              {scenarioResults?.map((sr, si) =>
                checkingAccounts.map(acc => (
                  <Area
                    key={`${sr.scenarioId}_${acc.id}`}
                    type="stepAfter"
                    dataKey={`${sr.scenarioId}_${acc.id}`}
                    name={`${sr.scenarioId}_${acc.id}`}
                    stroke={acc.color}
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray={`${4 + si * 2} ${3 + si}`}
                    strokeOpacity={0.5}
                    dot={false}
                    activeDot={false}
                  />
                ))
              )}

              {/* Event annotation tags */}
              <Customized component={(props: Record<string, unknown>) => (
                <EventAnnotations
                  tags={tags}
                  xAxisMap={props.xAxisMap as Record<string, { scale: (v: string) => number; bandwidth?: () => number }>}
                  yAxisMap={props.yAxisMap as Record<string, { scale: (v: number) => number }>}
                  offset={props.offset as { top: number; bottom: number; left: number; right: number }}
                />
              )} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {checkingAccounts.map(acc => (
            <div key={acc.id} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
              <span className="text-[10px] text-muted-foreground">{acc.name}</span>
            </div>
          ))}
          {scenarioResults?.map(sr => (
            <div key={sr.scenarioId} className="flex items-center gap-1.5">
              <div className="w-3 h-0 border-t border-dashed border-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{sr.scenarioName}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
