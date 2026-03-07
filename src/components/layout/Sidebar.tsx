import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, CalendarCheck, TrendingUp, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFinanceStore } from '@/store/useFinanceStore';
import { formatMonthLabel, getCurrentMonth } from '@/lib/formatters';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/spending', icon: Wallet, label: 'Spending' },
  { to: '/monthly', icon: CalendarCheck, label: 'Monthly' },
  { to: '/projections', icon: TrendingUp, label: 'Projections' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const settings = useFinanceStore(s => s.settings);

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-border h-screen sticky top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary font-[family-name:var(--font-display)]">
          FinanceOS
        </h1>
        <p className="text-xs text-sidebar-foreground mt-1">
          {formatMonthLabel(getCurrentMonth())}
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground hover:text-foreground hover:bg-secondary'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        {settings && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-income animate-pulse" />
            <p className="text-xs text-muted-foreground">
              USD/COP: ${settings.exchangeRate.toLocaleString()}
            </p>
          </div>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
