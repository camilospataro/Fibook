export interface SimRule {
  id: string;
  sourceType: 'income' | 'expense' | 'subscription' | 'debt';
  name: string;
  amount: number;
  currency: 'COP' | 'USD';
  direction: 'in' | 'out';
  accountId: string | null;
  day: number;
  enabled: boolean;
  spread: boolean;
}

export interface SimEvent {
  monthIndex: number;
  monthLabel: string;
  day: number;
  type: string;
  label: string;
  amount: number;
  currency: 'COP' | 'USD';
  accountId: string;
  accountName: string;
  direction: 'in' | 'out';
}

export interface AccountState {
  id: string;
  name: string;
  currency: 'COP' | 'USD';
  color: string;
  startBalance: number;
  monthlyEndBalances: number[];
  endBalance: number;
}

export interface ChartPoint {
  dayIndex: number;
  dayLabel: string;
  [key: string]: number | string;
}

export interface Scenario {
  id: string;
  name: string;
  overrides: RuleOverrides;
  monthCount: number;
}

export type RuleOverrides = Record<string, {
  amount?: number;
  day?: number;
  enabled?: boolean;
  accountId?: string | null;
  spread?: boolean;
}>;

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  chartData: ChartPoint[];
  accountStates: AccountState[];
}

export interface MonthAccuracy {
  month: string;
  projections: {
    accountId: string;
    accountName: string;
    projected: number;
    actual: number | null;
    accuracyPct: number | null;
  }[];
  simulatedAt: string;
}
