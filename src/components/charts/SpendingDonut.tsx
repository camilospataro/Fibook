import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCOP } from '@/lib/formatters';
import type { SpendingEntry } from '@/types';

const categoryColors: Record<string, string> = {
  groceries: '#00D4AA', transport: '#4F8EF7', food: '#FBBF24',
  entertainment: '#A78BFA', health: '#F472B6', shopping: '#FB923C', other: '#94A3B8',
};

const categoryLabels: Record<string, string> = {
  groceries: 'Groceries', transport: 'Transport', food: 'Food & Dining',
  entertainment: 'Entertainment', health: 'Health', shopping: 'Shopping', other: 'Other',
};

export default function SpendingDonut({ entries }: { entries: SpendingEntry[] }) {
  const grouped = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  const data = Object.entries(grouped).map(([category, value]) => ({
    name: categoryLabels[category] ?? category,
    value,
    color: categoryColors[category] ?? '#94A3B8',
  }));

  if (data.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">By Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-28 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={30} outerRadius={50} paddingAngle={2} strokeWidth={0}>
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8' }}
                  itemStyle={{ color: '#E8ECF4' }}
                  formatter={(value: number | undefined) => formatCOP(value ?? 0)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-medium">{formatCOP(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
