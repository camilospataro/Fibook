import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useFinanceStore } from '@/store/useFinanceStore';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function AppLayout({ children }: { children: ReactNode }) {
  const fetchAll = useFinanceStore(s => s.fetchAll);
  const loading = useFinanceStore(s => s.loading);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) fetchAll(data.user.id);
    });
  }, [fetchAll]);

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
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
