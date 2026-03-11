import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CheckingAccount } from '@/types';
import type { ChartPoint, ScenarioResult } from '@/types/simulation';
import { formatCurrency } from '@/lib/formatters';

interface SimulationChartProps {
  chartData: ChartPoint[];
  checkingAccounts: CheckingAccount[];
  monthBoundaries: number[];
  monthCount: number;
  scenarioResults?: ScenarioResult[];
}

export default function SimulationChart({
  chartData,
  checkingAccounts,
  monthBoundaries,
  monthCount,
  scenarioResults,
}: SimulationChartProps) {
  if (chartData.length === 0 || checkingAccounts.length === 0) return null;

  // Determine tick interval — show fewer ticks for multi-month
  const totalPoints = chartData.length;
  const tickInterval = totalPoints > 120 ? 14 : totalPoints > 60 ? 7 : totalPoints > 30 ? 3 : 1;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Monthly Cash Flow
          {monthCount > 1 && <span className="text-muted-foreground font-normal ml-1">({monthCount} months)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
                  fontSize: 12,
                }}
                labelFormatter={v => `${v}`}
                formatter={(value: number, name: string) => {
                  const acc = checkingAccounts.find(a => a.id === name);
                  if (!acc) return [value, name];
                  return [formatCurrency(value, acc.currency), acc.name];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" opacity={0.5} />

              {/* Month boundary lines */}
              {monthCount > 1 && monthBoundaries.slice(1).map((boundary, i) => (
                <ReferenceLine
                  key={`mb-${i}`}
                  x={chartData[boundary]?.dayLabel}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  opacity={0.4}
                />
              ))}

              {/* Main account lines */}
              {checkingAccounts.map(acc => (
                <Area
                  key={acc.id}
                  type="stepAfter"
                  dataKey={acc.id}
                  name={acc.id}
                  stroke={acc.color}
                  fill={acc.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              ))}

              {/* Scenario comparison overlays */}
              {scenarioResults?.map((sr, si) =>
                checkingAccounts.map(acc => {
                  // Build a unique dataKey for this scenario+account
                  const scenarioKey = `${sr.scenarioId}_${acc.id}`;
                  return (
                    <Area
                      key={scenarioKey}
                      type="stepAfter"
                      dataKey={scenarioKey}
                      name={scenarioKey}
                      stroke={acc.color}
                      fill="none"
                      strokeWidth={1.5}
                      strokeDasharray={`${4 + si * 2} ${3 + si}`}
                      strokeOpacity={0.6}
                      dot={false}
                      activeDot={false}
                    />
                  );
                })
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
