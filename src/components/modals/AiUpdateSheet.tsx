import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFinanceStore } from '@/store/useFinanceStore';
import { supabase } from '@/lib/supabase';
import { getCurrentMonth, getToday, formatCOP } from '@/lib/formatters';
import { Send, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Action {
  type: string;
  id?: string;
  updates?: Record<string, unknown>;
  amount?: number;
  month?: string;
  data?: Record<string, unknown>;
}

interface AiResponse {
  actions: Action[];
  summary: string;
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AiUpdateSheet({ open, onOpenChange }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const debtAccounts = useFinanceStore(s => s.debtAccounts);
  const savingsAccounts = useFinanceStore(s => s.savingsAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subscriptions = useFinanceStore(s => s.subscriptions);
  const snapshots = useFinanceStore(s => s.snapshots);
  const settings = useFinanceStore(s => s.settings);

  const updateDebtAccount = useFinanceStore(s => s.updateDebtAccount);
  const updateSavingsAccount = useFinanceStore(s => s.updateSavingsAccount);
  const updateIncomeSource = useFinanceStore(s => s.updateIncomeSource);
  const updateFixedExpense = useFinanceStore(s => s.updateFixedExpense);
  const updateSubscription = useFinanceStore(s => s.updateSubscription);
  const updateSavingsTarget = useFinanceStore(s => s.updateSavingsTarget);
  const addSpending = useFinanceStore(s => s.addSpending);
  const saveSnapshot = useFinanceStore(s => s.saveSnapshot);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
    if (!open) {
      setMessage('');
      setResponse(null);
      setError(null);
    }
  }, [open]);

  async function handleSend() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    const currentMonth = getCurrentMonth();
    const currentSnapshot = snapshots.find(s => s.month === currentMonth);

    const currentData = {
      today: getToday(),
      currentMonth,
      exchangeRate: settings?.exchangeRate ?? 4000,
      debtAccounts: debtAccounts.map(a => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        currentBalance: a.currentBalance,
        monthlyPayment: a.monthlyPayment,
      })),
      savingsAccounts: savingsAccounts.map(a => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        currentBalance: a.currentBalance,
      })),
      incomeSources: incomeSources.map(i => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        currency: i.currency,
      })),
      fixedExpenses: fixedExpenses.map(e => ({
        id: e.id,
        name: e.name,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
      })),
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        name: s.name,
        amount: s.amount,
        currency: s.currency,
        active: s.active,
      })),
      currentSnapshot: currentSnapshot
        ? {
            savings: currentSnapshot.savings,
            cashOnHand: currentSnapshot.cashOnHand,
            sideIncome: currentSnapshot.sideIncome,
          }
        : null,
      savingsTarget: settings?.savingsTarget ?? 0,
    };

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-update', {
        body: { message: message.trim(), currentData },
      });

      if (fnError) {
        // Try to extract body from FunctionsHttpError
        let msg = fnError.message || 'Failed to process request';
        try {
          const context = (fnError as unknown as { context?: { json?: () => Promise<unknown> } }).context;
          if (context?.json) {
            const body = await context.json() as Record<string, string>;
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        setError(msg);
      } else if (data?.error) {
        setError(data.error);
      } else if (data?.actions?.length > 0) {
        setResponse(data as AiResponse);
      } else {
        setError("Couldn't understand what to update. Try being more specific.");
      }
    } catch (err) {
      setError(`Could not connect to AI service: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function applyActions() {
    if (!response?.actions) return;
    setApplying(true);

    const currentMonth = getCurrentMonth();

    try {
      for (const action of response.actions) {
        switch (action.type) {
          case 'updateDebtAccount':
            if (action.id && action.updates) {
              await updateDebtAccount(action.id, action.updates as Partial<import('@/types').DebtAccount>);
            }
            break;
          case 'updateSavingsAccount':
            if (action.id && action.updates) {
              await updateSavingsAccount(action.id, action.updates as Partial<import('@/types').SavingsAccount>);
            }
            break;
          case 'updateIncomeSource':
            if (action.id && action.updates) {
              await updateIncomeSource(action.id, action.updates as Partial<import('@/types').IncomeSource>);
            }
            break;
          case 'updateFixedExpense':
            if (action.id && action.updates) {
              await updateFixedExpense(action.id, action.updates as Partial<import('@/types').FixedExpense>);
            }
            break;
          case 'updateSubscription':
            if (action.id && action.updates) {
              await updateSubscription(action.id, action.updates as Partial<import('@/types').Subscription>);
            }
            break;
          case 'updateSavingsTarget':
            if (typeof action.amount === 'number') {
              await updateSavingsTarget(action.amount);
            }
            break;
          case 'addSpending':
            if (action.data) {
              await addSpending(action.data as Omit<import('@/types').SpendingEntry, 'id' | 'userId'>);
            }
            break;
          case 'updateSnapshot': {
            const month = action.month ?? currentMonth;
            const existing = snapshots.find(s => s.month === month);
            if (existing && action.updates) {
              const updated = { ...existing };
              delete (updated as Record<string, unknown>).id;
              delete (updated as Record<string, unknown>).userId;
              Object.assign(updated, action.updates);
              await saveSnapshot(updated as Omit<import('@/types').MonthlySnapshot, 'id' | 'userId'>);
            }
            break;
          }
        }
      }

      toast.success('Updates applied successfully');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to apply some updates');
      console.error(err);
    } finally {
      setApplying(false);
    }
  }

  function describeAction(action: Action): string {
    switch (action.type) {
      case 'updateSavingsAccount': {
        const sa = savingsAccounts.find(a => a.id === action.id);
        const saName = sa?.name ?? 'Unknown account';
        const bal = action.updates?.currentBalance;
        return typeof bal === 'number' ? `${saName}: balance → ${formatCOP(bal)}` : `Update ${saName}`;
      }
      case 'updateDebtAccount': {
        const acct = debtAccounts.find(a => a.id === action.id);
        const name = acct?.name ?? 'Unknown account';
        const updates = action.updates ?? {};
        const parts: string[] = [];
        if (typeof updates.currentBalance === 'number') parts.push(`balance → ${formatCOP(updates.currentBalance as number)}`);
        if (typeof updates.monthlyPayment === 'number') parts.push(`payment → ${formatCOP(updates.monthlyPayment as number)}`);
        return `${name}: ${parts.join(', ')}`;
      }
      case 'updateIncomeSource': {
        const src = incomeSources.find(i => i.id === action.id);
        const name = src?.name ?? 'Unknown source';
        const amt = action.updates?.amount;
        return typeof amt === 'number' ? `${name}: amount → ${formatCOP(amt)}` : `Update ${name}`;
      }
      case 'updateFixedExpense': {
        const exp = fixedExpenses.find(e => e.id === action.id);
        const name = exp?.name ?? 'Unknown expense';
        const amt = action.updates?.amount;
        return typeof amt === 'number' ? `${name}: amount → ${formatCOP(amt)}` : `Update ${name}`;
      }
      case 'updateSubscription': {
        const sub = subscriptions.find(s => s.id === action.id);
        const name = sub?.name ?? 'Unknown subscription';
        const parts: string[] = [];
        if (typeof action.updates?.amount === 'number') parts.push(`amount → ${formatCOP(action.updates.amount as number)}`);
        if (typeof action.updates?.active === 'boolean') parts.push(action.updates.active ? 'activate' : 'deactivate');
        return `${name}: ${parts.join(', ')}`;
      }
      case 'updateSavingsTarget':
        return `Savings target → ${formatCOP(action.amount ?? 0)}/month`;
      case 'addSpending': {
        const d = action.data ?? {};
        return `Add spending: ${d.description} — ${formatCOP(d.amount as number ?? 0)}`;
      }
      case 'updateSnapshot': {
        const parts: string[] = [];
        const u = action.updates ?? {};
        if (typeof u.savings === 'number') parts.push(`savings → ${formatCOP(u.savings as number)}`);
        if (typeof u.cashOnHand === 'number') parts.push(`cash on hand → ${formatCOP(u.cashOnHand as number)}`);
        if (typeof u.sideIncome === 'number') parts.push(`side income → ${formatCOP(u.sideIncome as number)}`);
        return `Snapshot (${action.month ?? getCurrentMonth()}): ${parts.join(', ')}`;
      }
      default:
        return `${action.type}`;
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border px-6 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-lg">AI Update</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-4 mt-4 min-h-0">
          {/* Input area */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Tell me what changed and I'll update your data.
            </p>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. I now have 2 million in savings, paid 500k off the Visa debt, and spent 45k on groceries today"
              className="bg-secondary border-border min-h-[100px] resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send</>
              )}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Response preview */}
          {response && (
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              <p className="text-sm text-muted-foreground">{response.summary}</p>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Changes to apply</p>
                {response.actions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50 text-sm"
                  >
                    <Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <span>{describeAction(action)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={applyActions}
                  disabled={applying}
                  className="flex-1"
                >
                  {applying ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying...</>
                  ) : (
                    'Apply All'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setResponse(null); setMessage(''); }}
                  className="flex-1"
                  disabled={applying}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
