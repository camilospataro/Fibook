import { useState, useEffect } from 'react';
import { LogOut, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchUSDtoCOP } from '@/lib/exchangeRate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useFinanceStore } from '@/store/useFinanceStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import ThemeSettings from '@/components/layout/ThemeSwitcher';

export default function Settings() {
  const navigate = useNavigate();
  const store = useFinanceStore();
  const { settings } = store;

  // Exchange Rate
  const [rate, setRate] = useState(String(settings?.exchangeRate ?? 4000));
  useEffect(() => {
    if (settings?.exchangeRate) {
      setRate(String(settings.exchangeRate));
    }
  }, [settings?.exchangeRate]);

  const [refreshingRate, setRefreshingRate] = useState(false);
  const [rateLocked, setRateLocked] = useState(true);

  async function saveRate() {
    await store.updateExchangeRate(Number(rate));
    setRateLocked(true);
    toast.success('Exchange rate updated');
  }

  async function handleRefreshRate() {
    setRefreshingRate(true);
    try {
      const liveRate = await fetchUSDtoCOP();
      if (liveRate && liveRate > 0) {
        const rounded = Math.round(liveRate);
        setRate(String(rounded));
        await store.updateExchangeRate(rounded);
        setRateLocked(true);
        toast.success(`Exchange rate updated: ${rounded.toLocaleString()} COP`);
      } else {
        toast.error('Could not fetch live rate. Try again later.');
      }
    } catch (err) {
      toast.error(`Failed to fetch exchange rate: ${(err as Error).message}`);
    }
    setRefreshingRate(false);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-display)]">Settings</h1>

      {/* Exchange Rate */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Exchange Rate (USD → COP)</CardTitle>
          <span className="text-[10px] text-muted-foreground">Manual / On demand</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-secondary/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">1 USD =</p>
            <p className="text-2xl font-bold text-primary font-[family-name:var(--font-mono)]">
              {Number(rate).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">COP</span>
            </p>
            {settings?.exchangeRateUpdatedAt && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Set on {new Date(settings.exchangeRateUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {rateLocked ? (
            <div className="flex gap-2">
              <Button onClick={() => setRateLocked(false)} size="sm" variant="outline" className="flex-1">
                Edit Manually
              </Button>
              <Button onClick={handleRefreshRate} size="sm" variant="secondary" disabled={refreshingRate} className="flex-1">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshingRate ? 'animate-spin' : ''}`} />
                {refreshingRate ? 'Fetching...' : 'Fetch Live Rate'}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <Input type="number" value={rate} onChange={e => setRate(e.target.value)} className="bg-secondary border-border w-40" />
                <Button onClick={saveRate} size="sm">Save</Button>
                <Button onClick={() => { setRate(String(settings?.exchangeRate ?? 4000)); setRateLocked(true); }} size="sm" variant="ghost">Cancel</Button>
              </div>
              <Button onClick={handleRefreshRate} size="sm" variant="secondary" disabled={refreshingRate} className="w-full">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshingRate ? 'animate-spin' : ''}`} />
                {refreshingRate ? 'Fetching...' : 'Fetch Live Rate'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Theme */}
      <ThemeSettings />

      {/* Import from Excel */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Import from Excel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Upload a spreadsheet and let AI automatically map your financial data into the app.</p>
          <Button onClick={() => navigate('/import')} variant="secondary" className="w-full">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Spreadsheet
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Sign Out */}
      <Button variant="destructive" onClick={() => supabase.auth.signOut()} className="w-full">
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}
