import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFinanceStore } from '@/store/useFinanceStore';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import UndoRedoButtons from './UndoRedoButtons';
import { initTheme } from './ThemeSwitcher';

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const fetchAll = useFinanceStore(s => s.fetchAll);
  const processScheduledPayments = useFinanceStore(s => s.processScheduledPayments);
  const userId = useFinanceStore(s => s.userId);
  const loading = useFinanceStore(s => s.loading);

  useEffect(() => { initTheme(); }, []);

  useEffect(() => {
    if (!userId) {
      supabase.auth.getUser().then(async ({ data }) => {
        if (data.user) {
          await fetchAll(data.user.id);
          await processScheduledPayments();
        }
      });
    }
  }, [fetchAll, processScheduledPayments, userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl font-[family-name:var(--font-display)]">
          Loading your data...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0 overflow-y-auto">
        <UndoRedoButtons />
        <button
          onClick={() => navigate('/help')}
          className="fixed top-3 left-3 md:left-auto md:right-14 z-50 p-2 bg-card/90 backdrop-blur border border-border rounded-full shadow-lg hover:bg-secondary transition-colors"
          title="Help"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </button>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
