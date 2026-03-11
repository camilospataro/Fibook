import { useMemo } from 'react';
import { Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCOP } from '@/lib/formatters';
import type { IncomeSource, FixedExpense, Subscription, DebtAccount, CheckingAccount } from '@/types';

interface MoneyFlowSankeyProps {
  incomeSources: IncomeSource[];
  incomeAmounts: Record<string, string>;
  sideIncome: number;
  fixedExpenses: FixedExpense[];
  subscriptions: Subscription[];
  debtAccounts: DebtAccount[];
  ccPayments: Record<string, string>;
  checkingAccounts: CheckingAccount[];
  savingsGoal: number;
  variableSpending: number;
  exchangeRate: number;
}

interface SankeyNode {
  name: string;
  fill?: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  fill?: string;
}

// Custom node renderer for dark theme
function CustomNode(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: SankeyNode & { value?: number };
}) {
  const { x, y, width, height, payload } = props;
  if (height < 1) return null;
  const fill = payload.fill || 'hsl(var(--muted-foreground))';
  const labelX = x < 200 ? x + width + 6 : x - 6;
  const anchor = x < 200 ? 'start' : 'end';

  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={3} />
      {height > 8 && (
        <text
          x={labelX}
          y={y + height / 2}
          textAnchor={anchor}
          dominantBaseline="middle"
          fontSize={10}
          fill="hsl(var(--foreground))"
          fontWeight={500}
        >
          {payload.name}
        </text>
      )}
    </Layer>
  );
}

export default function MoneyFlowSankey({
  incomeSources,
  incomeAmounts,
  sideIncome,
  fixedExpenses,
  subscriptions,
  debtAccounts,
  ccPayments,
  checkingAccounts,
  savingsGoal,
  variableSpending,
  exchangeRate,
}: MoneyFlowSankeyProps) {
  const data = useMemo(() => {
    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];
    const nodeIndex = new Map<string, number>();

    function addNode(id: string, name: string, fill?: string): number {
      if (nodeIndex.has(id)) return nodeIndex.get(id)!;
      const idx = nodes.length;
      nodes.push({ name, fill });
      nodeIndex.set(id, idx);
      return idx;
    }

    function addLink(source: number, target: number, value: number, fill?: string) {
      if (value > 0 && source !== target) {
        links.push({ source, target, value: Math.round(value), fill });
      }
    }

    // Hub node — represents your total available money
    const hubIdx = addNode('hub', 'Available', '#4F8EF7');

    // Income sources → Hub
    for (const src of incomeSources) {
      const amt = Number(incomeAmounts[src.id]) || 0;
      if (amt <= 0) continue;
      const copAmt = src.currency === 'USD' ? amt * exchangeRate : amt;
      const idx = addNode(`inc_${src.id}`, src.name, '#00D4AA');
      addLink(idx, hubIdx, copAmt, 'hsla(160, 60%, 40%, 0.3)');
    }

    if (sideIncome > 0) {
      const idx = addNode('side_income', 'Side Income', '#00D4AA');
      addLink(idx, hubIdx, sideIncome, 'hsla(160, 60%, 40%, 0.3)');
    }

    // Hub → Fixed Expenses (grouped by category)
    const expByCategory = new Map<string, number>();
    for (const exp of fixedExpenses) {
      const copAmt = exp.currency === 'USD' ? exp.amount * exchangeRate : exp.amount;
      const cat = exp.category || 'other';
      expByCategory.set(cat, (expByCategory.get(cat) ?? 0) + copAmt);
    }
    for (const [cat, total] of expByCategory) {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const idx = addNode(`exp_${cat}`, label, '#FF6B6B');
      addLink(hubIdx, idx, total, 'hsla(0, 60%, 50%, 0.2)');
    }

    // Hub → Subscriptions (grouped)
    const activeSubs = subscriptions.filter(s => s.active);
    const subTotal = activeSubs.reduce((sum, s) =>
      sum + (s.currency === 'USD' ? s.amount * exchangeRate : s.amount), 0);
    if (subTotal > 0) {
      const idx = addNode('subs', 'Subscriptions', '#DDA0DD');
      addLink(hubIdx, idx, subTotal, 'hsla(300, 30%, 60%, 0.2)');
    }

    // Hub → Debt Payments
    for (const acc of debtAccounts) {
      const paid = Number(ccPayments[acc.id]) || 0;
      if (paid <= 0) continue;
      const copPaid = acc.currency === 'USD' ? paid * exchangeRate : paid;
      const idx = addNode(`debt_${acc.id}`, acc.name, acc.color);
      addLink(hubIdx, idx, copPaid, 'hsla(0, 50%, 50%, 0.15)');
    }

    // Hub → Variable Spending
    if (variableSpending > 0) {
      const idx = addNode('var_spending', 'Spending', '#FBBF24');
      addLink(hubIdx, idx, variableSpending, 'hsla(45, 90%, 55%, 0.2)');
    }

    // Hub → Savings
    if (savingsGoal > 0) {
      const idx = addNode('savings', 'Savings', '#4ECDC4');
      addLink(hubIdx, idx, savingsGoal, 'hsla(175, 50%, 55%, 0.2)');
    }

    // Need at least 2 nodes and 1 link
    if (nodes.length < 2 || links.length === 0) return null;

    return { nodes, links };
  }, [incomeSources, incomeAmounts, sideIncome, fixedExpenses, subscriptions, debtAccounts, ccPayments, savingsGoal, variableSpending, exchangeRate]);

  if (!data) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Money Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-8">Add income and expenses to see your money flow</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Money Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <Sankey
            width={480}
            height={320}
            data={data}
            node={<CustomNode x={0} y={0} width={0} height={0} payload={{ name: '' }} />}
            nodeWidth={10}
            nodePadding={14}
            margin={{ top: 10, right: 100, bottom: 10, left: 100 }}
            link={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.4 }}
          >
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(value: number) => [formatCOP(value), 'Amount']}
            />
          </Sankey>
        </div>
      </CardContent>
    </Card>
  );
}
