import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, CalendarCheck, TrendingUp, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/spending', icon: Wallet, label: 'Spending' },
  { to: '/monthly', icon: CalendarCheck, label: 'Monthly' },
  { to: '/projections', icon: TrendingUp, label: 'Projections' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-border z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
