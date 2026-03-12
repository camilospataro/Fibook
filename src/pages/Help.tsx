import { ArrowLeft, Wallet, LayoutDashboard, CalendarCheck, TrendingUp, Settings, Undo2, CreditCard, PiggyBank, DollarSign, Brain, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const sections = [
  {
    icon: Wallet,
    title: 'Spending',
    color: '#00D4AA',
    items: [
      'Log daily spending with date, description, amount, and category (Groceries, Transport, Food & Dining, Entertainment, Health, Shopping, Other).',
      'Choose a payment method: Cash, a Checking Account, or a Credit Card.',
      'When paying from a checking account, the balance is automatically deducted. The app prevents you from spending more than the available balance.',
      'Avance (Cash Advance): When paying from a credit card, you can optionally deposit the amount into a checking account — this charges the card and credits the account.',
      'Link spending to a budget item (fixed expense) to track how much of that budget you\'ve used.',
      'Add custom tags to spending entries for flexible filtering and reporting.',
      'Filter by month, category, or tag to analyze your spending patterns.',
      'View a donut chart breakdown of spending by category.',
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    color: '#4F8EF7',
    items: [
      'KPI cards at the top show: Checking balance, Savings balance, Monthly Income, Monthly Expenses, and Total Debt — all converted to COP.',
      'Monthly Spending tracker shows budget remaining or overspent amount.',
      'Debt Payoff Chart projects how long until all debts are paid off.',
      'Savings Projection Chart shows projected savings through end of year.',
      'Net Worth card tracks Assets minus Liabilities with a historical trend.',
      'Trends card visualizes Income, Expenses, Debt Paid, and Savings over the last 12 months.',
      'AI Insights provides personalized financial recommendations powered by AI.',
      'Expenses Breakdown shows the split between Fixed Expenses, Debt Payments, and Subscriptions.',
    ],
  },
  {
    icon: CalendarCheck,
    title: 'Monthly',
    color: '#FBBF24',
    items: [
      'Two tabs: Balances (manage your finances) and Movements (visualize money flow).',
      'Navigate between months to view past snapshots or plan future months.',
      'Income Sources: Add recurring or one-time income with deposit day and linked checking account.',
      'Fixed Expenses: Add monthly expenses with category, payment day, and payment mode (auto/manual). Link to a credit card for automatic charge tracking.',
      'Subscriptions: Track monthly and annual subscriptions with renewal dates. Link to credit cards for charge tracking.',
      'Debt Accounts: View balances and make manual payments. Payments deduct from the linked checking account and reduce the debt balance.',
      'Checking Accounts: View all account balances. One account can be designated as your savings destination.',
      'Savings: Set a monthly savings target, choose source and destination accounts, and configure the transfer day.',
      'Movements tab: Sankey diagram shows how money flows from income through checking to expenses, debt, and savings. Waterfall chart breaks down your monthly financial picture.',
      'Save Snapshot: Capture the current month\'s financial state for historical tracking.',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Projections',
    color: '#00D4AA',
    items: [
      'Debt payoff timeline shows month-by-month balance reduction for each debt account.',
      'Uses the debt snowball method: once a debt is paid off, its payment rolls into the next debt.',
      'Savings projection shows how your savings grow over time based on your monthly target.',
      'Adjust scenarios to see how different payment strategies affect your timeline.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Debt Payments',
    color: '#FF6B6B',
    items: [
      'For the current month, debt payments are manual — you decide when and how much to pay.',
      'Click "Pay" next to a debt account in Monthly, enter the amount, and confirm.',
      'The payment deducts from the linked checking account and reduces the debt balance. The app prevents overdraft.',
      'For future months in projections, the app estimates payments using your configured monthly payment amount.',
    ],
  },
  {
    icon: PiggyBank,
    title: 'Savings',
    color: '#00D4AA',
    items: [
      'Set a monthly savings target in the Monthly page.',
      'Assign a source checking account (where money comes from) and a destination account (where savings go).',
      'Execute savings transfers manually — the app moves the amount between accounts.',
      'The savings destination account is separated from your checking totals on the Dashboard.',
      'Track progress toward your yearly savings goal (monthly target × 12).',
    ],
  },
  {
    icon: DollarSign,
    title: 'Multi-Currency',
    color: '#4F8EF7',
    items: [
      'All accounts and entries support COP or USD.',
      'The exchange rate (USD to COP) is fetched automatically on login.',
      'You can manually update the exchange rate in Settings.',
      'All dashboard totals and projections are converted to COP using the current rate.',
    ],
  },
  {
    icon: Undo2,
    title: 'Undo & Redo',
    color: '#FBBF24',
    items: [
      'Every change you make (add, edit, delete) can be undone.',
      'Undo/Redo buttons appear in the top-right corner when actions are available.',
      'Up to 30 actions are kept in history.',
      'Undo/Redo syncs all changes back to the database automatically.',
    ],
  },
  {
    icon: Brain,
    title: 'AI Features',
    color: '#4F8EF7',
    items: [
      'AI Insights: Get personalized financial analysis and recommendations on your Dashboard.',
      'AI Update: In the Monthly page, describe changes in natural language (e.g., "I got a raise to $5M") and the AI will update your accounts.',
      'AI Import: Upload an Excel file and AI will parse and categorize your financial data for import.',
    ],
  },
  {
    icon: Upload,
    title: 'Import',
    color: '#00D4AA',
    items: [
      'Upload an Excel file (.xlsx) with your financial data.',
      'AI analyzes the file and extracts debt accounts, income sources, expenses, subscriptions, and spending.',
      'Review and select which items to import before confirming.',
      'Great for migrating from spreadsheets to FinanceOS.',
    ],
  },
  {
    icon: Settings,
    title: 'Settings',
    color: '#FBBF24',
    items: [
      'Update the USD/COP exchange rate manually or fetch the live rate.',
      'Sign out of your account.',
    ],
  },
];

export default function Help() {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Help</h1>
          <p className="text-sm text-muted-foreground">Everything you need to know about FinanceOS</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            FinanceOS is your personal finance command center. Track spending, manage debt payments,
            project savings growth, and get AI-powered insights — all in one place. Everything syncs
            in real-time and supports both COP and USD currencies.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map(section => (
          <Card key={section.title} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2.5">
                <div className="p-1.5 rounded-md" style={{ backgroundColor: `${section.color}15` }}>
                  <section.icon className="w-4 h-4" style={{ color: section.color }} />
                </div>
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground pb-8">
        Built with care. Questions or feedback? Reach out anytime.
      </p>
    </div>
  );
}
