import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useFinanceStore } from '@/store/useFinanceStore';
import { supabase } from '@/lib/supabase';
import { formatCOP, formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ParsedData {
  exchange_rate: number | null;
  debt_accounts: { name: string; currency: 'COP' | 'USD'; current_balance: number; minimum_monthly_payment: number; color: string }[];
  income_sources: { name: string; amount: number; currency?: 'COP' | 'USD'; is_recurring: boolean }[];
  fixed_expenses: { name: string; amount: number; currency?: 'COP' | 'USD'; category: string }[];
  subscriptions: { name: string; currency: 'COP' | 'USD'; amount: number; active: boolean }[];
  spending: { date: string; description: string; amount: number; category: string; payment_method: string }[];
  skipped: { data: string; reason: string }[];
  summary: string;
}

type Section = keyof Pick<ParsedData, 'debt_accounts' | 'income_sources' | 'fixed_expenses' | 'subscriptions' | 'spending'>;

export default function Import() {
  const navigate = useNavigate();
  const store = useFinanceStore();

  const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [error, setError] = useState('');

  // Track which items user wants to include
  const [excluded, setExcluded] = useState<Record<string, Set<number>>>({
    debt_accounts: new Set(),
    income_sources: new Set(),
    fixed_expenses: new Set(),
    subscriptions: new Set(),
    spending: new Set(),
  });

  function toggleItem(section: Section, index: number) {
    setExcluded(prev => {
      const next = { ...prev, [section]: new Set(prev[section]) };
      if (next[section].has(index)) next[section].delete(index);
      else next[section].add(index);
      return next;
    });
  }

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setFileName(file.name);
    setStep('analyzing');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

      const sheets = workbook.SheetNames.map(name => ({
        name,
        rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' }),
      }));

      if (sheets.every(s => s.rows.length === 0)) {
        setError('The Excel file appears to be empty.');
        setStep('upload');
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('parse-excel', {
        body: { sheets },
      });

      if (fnError) {
        setError(fnError.message || 'AI analysis failed');
        setStep('upload');
        return;
      }

      setParsed(data);
      setStep('review');
    } catch (err) {
      setError((err as Error).message);
      setStep('upload');
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    if (!parsed) return;
    setStep('importing');

    try {
      // Exchange rate
      if (parsed.exchange_rate) {
        await store.updateExchangeRate(parsed.exchange_rate);
      }

      // Debt accounts
      for (let i = 0; i < parsed.debt_accounts.length; i++) {
        if (excluded.debt_accounts.has(i)) continue;
        const a = parsed.debt_accounts[i];
        await store.addDebtAccount({
          name: a.name, currency: a.currency, currentBalance: a.current_balance,
          minimumMonthlyPayment: a.minimum_monthly_payment, monthlyPayment: a.minimum_monthly_payment, color: a.color, linkedAccountId: null,
        });
      }

      // Income sources
      for (let i = 0; i < parsed.income_sources.length; i++) {
        if (excluded.income_sources.has(i)) continue;
        const s = parsed.income_sources[i];
        await store.addIncomeSource({ name: s.name, amount: s.amount, currency: s.currency ?? 'COP', isRecurring: s.is_recurring, linkedAccountId: null, depositDay: 1 });
      }

      // Fixed expenses
      for (let i = 0; i < parsed.fixed_expenses.length; i++) {
        if (excluded.fixed_expenses.has(i)) continue;
        const e = parsed.fixed_expenses[i];
        await store.addFixedExpense({
          name: e.name, amount: e.amount, currency: e.currency ?? 'COP',
          category: e.category as 'housing' | 'food' | 'transport' | 'entertainment' | 'health' | 'other',
          linkedAccountId: null, paymentDay: 1, paymentMode: 'manual',
        });
      }

      // Subscriptions
      for (let i = 0; i < parsed.subscriptions.length; i++) {
        if (excluded.subscriptions.has(i)) continue;
        const s = parsed.subscriptions[i];
        await store.addSubscription({ name: s.name, currency: s.currency, amount: s.amount, group: (s as Record<string, unknown>).group as string ?? 'General', active: s.active, linkedAccountId: null, paymentDay: 1, billingCycle: 'monthly', renewalMonth: null });
      }

      // Spending
      for (let i = 0; i < parsed.spending.length; i++) {
        if (excluded.spending.has(i)) continue;
        const e = parsed.spending[i];
        await store.addSpending({
          date: e.date, description: e.description, amount: e.amount,
          category: e.category as 'groceries' | 'transport' | 'food' | 'entertainment' | 'health' | 'shopping' | 'other',
          paymentMethod: e.payment_method as 'cash' | 'debit' | 'credit_mastercard_cop' | 'credit_mastercard_usd' | 'credit_visa',
          linkedAccountId: null, linkedBudgetId: null,
        });
      }

      setStep('done');
      toast.success('Data imported successfully!');
    } catch (err) {
      setError((err as Error).message);
      setStep('review');
      toast.error('Import failed');
    }
  }

  function countIncluded(section: Section): number {
    if (!parsed) return 0;
    return parsed[section].length - excluded[section].size;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Import from Excel</h1>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-8">
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('excel-input')?.click()}
            >
              <Upload className="w-12 h-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop your Excel file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv supported</p>
              </div>
              <input
                id="excel-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 inline mr-1 text-primary" />
                <strong className="text-primary">AI-powered import</strong> — Upload any financial spreadsheet. Our AI will analyze the data, figure out what's debt, income, expenses, subscriptions, and spending, then let you review everything before importing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Analyzing */}
      {step === 'analyzing' && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium">Analyzing {fileName}...</p>
              <p className="text-sm text-muted-foreground mt-1">AI is reading your spreadsheet and mapping the data</p>
            </div>
            <div className="w-full max-w-xs space-y-2 mt-2">
              <div className="h-2 bg-secondary rounded animate-pulse" />
              <div className="h-2 bg-secondary rounded animate-pulse w-4/5" />
              <div className="h-2 bg-secondary rounded animate-pulse w-3/5" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Review */}
      {step === 'review' && parsed && (
        <>
          {/* Summary */}
          <Card className="bg-card border-border border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-sm text-muted-foreground mt-1">{parsed.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Exchange Rate */}
          {parsed.exchange_rate && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Exchange Rate</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-primary">1 USD = {parsed.exchange_rate.toLocaleString()} COP</p>
              </CardContent>
            </Card>
          )}

          {/* Debt Accounts */}
          {parsed.debt_accounts.length > 0 && (
            <ReviewSection
              title="Debt Accounts"
              count={countIncluded('debt_accounts')}
              total={parsed.debt_accounts.length}
            >
              {parsed.debt_accounts.map((a, i) => (
                <ReviewItem
                  key={i}
                  included={!excluded.debt_accounts.has(i)}
                  onToggle={() => toggleItem('debt_accounts', i)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="font-medium">{a.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{a.currency}</Badge>
                  </div>
                  <span className="text-destructive font-medium">{formatCurrency(a.current_balance, a.currency)}</span>
                </ReviewItem>
              ))}
            </ReviewSection>
          )}

          {/* Income Sources */}
          {parsed.income_sources.length > 0 && (
            <ReviewSection
              title="Income Sources"
              count={countIncluded('income_sources')}
              total={parsed.income_sources.length}
            >
              {parsed.income_sources.map((s, i) => (
                <ReviewItem
                  key={i}
                  included={!excluded.income_sources.has(i)}
                  onToggle={() => toggleItem('income_sources', i)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {s.is_recurring && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                    {s.currency && <Badge variant="secondary" className="text-[10px]">{s.currency}</Badge>}
                  </div>
                  <span className="text-income font-medium">{formatCurrency(s.amount, s.currency ?? 'COP')}</span>
                </ReviewItem>
              ))}
            </ReviewSection>
          )}

          {/* Fixed Expenses */}
          {parsed.fixed_expenses.length > 0 && (
            <ReviewSection
              title="Fixed Expenses"
              count={countIncluded('fixed_expenses')}
              total={parsed.fixed_expenses.length}
            >
              {parsed.fixed_expenses.map((e, i) => (
                <ReviewItem
                  key={i}
                  included={!excluded.fixed_expenses.has(i)}
                  onToggle={() => toggleItem('fixed_expenses', i)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{e.category}</Badge>
                    {e.currency && <Badge variant="secondary" className="text-[10px]">{e.currency}</Badge>}
                  </div>
                  <span className="font-medium">{formatCurrency(e.amount, e.currency ?? 'COP')}</span>
                </ReviewItem>
              ))}
            </ReviewSection>
          )}

          {/* Subscriptions */}
          {parsed.subscriptions.length > 0 && (
            <ReviewSection
              title="Subscriptions"
              count={countIncluded('subscriptions')}
              total={parsed.subscriptions.length}
            >
              {parsed.subscriptions.map((s, i) => (
                <ReviewItem
                  key={i}
                  included={!excluded.subscriptions.has(i)}
                  onToggle={() => toggleItem('subscriptions', i)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{s.currency}</Badge>
                  </div>
                  <span className="font-medium">{formatCurrency(s.amount, s.currency)}</span>
                </ReviewItem>
              ))}
            </ReviewSection>
          )}

          {/* Spending */}
          {parsed.spending.length > 0 && (
            <ReviewSection
              title="Spending Entries"
              count={countIncluded('spending')}
              total={parsed.spending.length}
            >
              {parsed.spending.map((e, i) => (
                <ReviewItem
                  key={i}
                  included={!excluded.spending.has(i)}
                  onToggle={() => toggleItem('spending', i)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{e.description}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{e.category}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{e.date}</span>
                  </div>
                  <span className="text-destructive font-medium shrink-0">{formatCOP(e.amount)}</span>
                </ReviewItem>
              ))}
            </ReviewSection>
          )}

          {/* Skipped Items */}
          {parsed.skipped.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <CardTitle className="text-sm">Skipped ({parsed.skipped.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {parsed.skipped.map((s, i) => (
                  <div key={i} className="text-sm py-1.5 border-b border-border last:border-0">
                    <p className="text-muted-foreground">{s.data}</p>
                    <p className="text-xs text-warning mt-0.5">{s.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setStep('upload'); setParsed(null); setError(''); }}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleImport}>
              <Check className="w-4 h-4 mr-2" />
              Import {countIncluded('debt_accounts') + countIncluded('income_sources') + countIncluded('fixed_expenses') + countIncluded('subscriptions') + countIncluded('spending')} Items
            </Button>
          </div>
        </>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-medium">Importing data...</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card className="bg-card border-border border-primary/20">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold font-[family-name:var(--font-display)]">Import Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">Your financial data has been added to FinanceOS.</p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" onClick={() => { setStep('upload'); setParsed(null); }}>
                Import Another
              </Button>
              <Button onClick={() => navigate('/')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviewSection({ title, count, total, children }: { title: string; count: number; total: number; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {count}/{total} selected
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1">
        {children}
      </CardContent>
    </Card>
  );
}

function ReviewItem({ included, onToggle, children }: { included: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-center justify-between py-2 px-2 rounded-md cursor-pointer transition-colors ${
        included ? 'hover:bg-secondary/50' : 'opacity-40 bg-secondary/20'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          included ? 'border-primary bg-primary' : 'border-muted-foreground'
        }`}>
          {included && <Check className="w-3 h-3 text-primary-foreground" />}
        </div>
        <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}
