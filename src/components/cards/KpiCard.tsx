import CountUp from 'react-countup';
import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  color: string;
  decimals?: number;
  separator?: string;
}

export default function KpiCard({ title, value, prefix = '', suffix = '', icon: Icon, color, decimals = 0, separator = '.' }: KpiCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <p className="text-2xl font-bold font-[family-name:var(--font-display)]" style={{ color }}>
          {prefix}
          <CountUp end={value} duration={1.2} separator={separator} decimals={decimals} />
          {suffix}
        </p>
      </CardContent>
    </Card>
  );
}
