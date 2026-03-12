import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFinanceStore } from '@/store/useFinanceStore';
import { getCurrentMonth, getToday, formatCOP } from '@/lib/formatters';
import { Send, Loader2, Check, AlertCircle, Paperclip, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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

interface AttachedFile {
  name: string;
  type: string;
  content: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read a file as text. Excel files are converted to CSV. Images read as base64. */
async function readFileContent(file: File): Promise<string> {
  // Excel files: convert to CSV client-side
  const isExcel = /\.(xlsx?|xlsm)$/i.test(file.name)
    || file.type.includes('spreadsheet') || file.type.includes('ms-excel');

  if (isExcel) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    // Convert all sheets to CSV
    return wb.SheetNames.map(name => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      return `--- Sheet: ${name} ---\n${csv}`;
    }).join('\n\n');
  }

  // Text-based files: read as text
  const isText = [
    'text/', 'application/json', 'application/csv',
  ].some(t => file.type.startsWith(t))
    || /\.(csv|tsv|txt|json|xml|md)$/i.test(file.name);

  if (isText || !file.type) {
    return file.text();
  }

  // Binary files (images, PDFs): read as base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AiUpdateSheet({ open, onOpenChange }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debtAccounts = useFinanceStore(s => s.debtAccounts);
  const checkingAccounts = useFinanceStore(s => s.checkingAccounts);
  const incomeSources = useFinanceStore(s => s.incomeSources);
  const fixedExpenses = useFinanceStore(s => s.fixedExpenses);
  const subscriptions = useFinanceStore(s => s.subscriptions);
  const snapshots = useFinanceStore(s => s.snapshots);
  const settings = useFinanceStore(s => s.settings);

  const updateDebtAccount = useFinanceStore(s => s.updateDebtAccount);
  const updateCheckingAccount = useFinanceStore(s => s.updateCheckingAccount);
  const updateIncomeSource = useFinanceStore(s => s.updateIncomeSource);
  const updateFixedExpense = useFinanceStore(s => s.updateFixedExpense);
  const updateSubscription = useFinanceStore(s => s.updateSubscription);
  const updateSavingsTarget = useFinanceStore(s => s.updateSavingsTarget);
  const addSubscription = useFinanceStore(s => s.addSubscription);
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
      setAttachedFiles([]);
    }
  }, [open]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      // Limit file size to 500KB for text, 2MB for images
      const maxSize = file.type.startsWith('image/') ? 2 * 1024 * 1024 : 500 * 1024;
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max ${file.type.startsWith('image/') ? '2MB' : '500KB'})`);
        continue;
      }

      try {
        const content = await readFileContent(file);
        setAttachedFiles(prev => [...prev, { name: file.name, type: file.type, content }]);
      } catch {
        toast.error(`Failed to read ${file.name}`);
      }
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function removeFile(index: number) {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if ((!message.trim() && attachedFiles.length === 0) || loading) return;
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
      checkingAccounts: checkingAccounts.map(a => ({
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

    // Build file attachments payload
    const fileAttachments = attachedFiles.map(f => ({
      name: f.name,
      type: f.type,
      content: f.content,
    }));

    try {
      // JWT verification is disabled on this function; use anon key
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ message: message.trim(), currentData, files: fileAttachments }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('AI Update error:', res.status, text);
        setError(`AI service error (${res.status}): ${text.slice(0, 200)}`);
      } else {
        const data = await res.json();
        if (data?.error) {
          setError(data.error);
        } else if (data?.actions?.length > 0) {
          setResponse(data as AiResponse);
        } else {
          setError("Couldn't understand what to update. Try being more specific.");
        }
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
          case 'updateCheckingAccount':
            if (action.id && action.updates) {
              await updateCheckingAccount(action.id, action.updates as Partial<import('@/types').CheckingAccount>);
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
          case 'addSubscription':
            if (action.data) {
              await addSubscription(action.data as Omit<import('@/types').Subscription, 'id' | 'userId'>);
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
      case 'updateCheckingAccount': {
        const sa = checkingAccounts.find(a => a.id === action.id);
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
        if (action.updates?.linkedAccountId !== undefined) {
          const linked = [...debtAccounts, ...checkingAccounts].find(a => a.id === action.updates?.linkedAccountId);
          parts.push(`charge to → ${linked?.name ?? (action.updates.linkedAccountId ? 'account' : 'none')}`);
        }
        return `${name}: ${parts.join(', ')}`;
      }
      case 'updateSavingsTarget':
        return `Savings target → ${formatCOP(action.amount ?? 0)}/month`;
      case 'addSubscription': {
        const d = action.data ?? {};
        const cycle = d.billingCycle === 'annual' ? '/yr' : '/mo';
        return `Add subscription: ${d.name} — ${formatCOP(d.amount as number ?? 0)}${cycle}`;
      }
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
              Tell me what changed or attach a file (bank statement, CSV, screenshot) and I'll update your data.
            </p>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={attachedFiles.length > 0
                ? "e.g. Update my balances from this bank statement"
                : "e.g. I now have 2 million in savings, paid 500k off the Visa debt"
              }
              className="bg-secondary border-border min-h-[100px] resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            {/* Attached files */}
            {attachedFiles.length > 0 && (
              <div className="space-y-1.5">
                {attachedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/70 text-sm"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-foreground">{file.name}</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
                disabled={loading}
              >
                <Paperclip className="w-4 h-4" />
                Attach File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.tsv,.txt,.json,.xml,.md,.pdf,.xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={handleSend}
                disabled={(!message.trim() && attachedFiles.length === 0) || loading}
                className="flex-1"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Send</>
                )}
              </Button>
            </div>
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
