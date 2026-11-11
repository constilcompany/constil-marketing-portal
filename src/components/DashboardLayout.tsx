import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Zap, LayoutDashboard, Users, Settings, Ticket, DollarSign,
  BarChart3, Wallet, UserPlus, LogOut, ChevronLeft, ChevronRight, Package, SlidersHorizontal,
  CreditCard, CalendarCheck, MessageSquare, Bot, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Managers', path: '/dashboard/managers', icon: Users },
  { label: 'Influencers', path: '/dashboard/admin-influencers', icon: UserPlus },
  { label: 'Users', path: '/dashboard/users', icon: Users },
  { label: 'Packages', path: '/dashboard/packages', icon: Package },
  { label: 'Credit Config', path: '/dashboard/credit-config', icon: SlidersHorizontal },
  { label: 'Subscriptions', path: '/dashboard/subscriptions', icon: CalendarCheck },
  { label: 'Payment Logs', path: '/dashboard/payment-logs', icon: CreditCard },
  { label: 'Coupons', path: '/dashboard/coupons', icon: Ticket },
  { label: 'Payouts', path: '/dashboard/payouts', icon: DollarSign },
  { label: 'Chatbot Leads', path: '/dashboard/chatbot-leads', icon: Bot },
  { label: 'Newsleads', path: '/dashboard/newsleads', icon: Mail },
  { label: 'Support Queries', path: '/dashboard/support-queries', icon: MessageSquare },
  { label: 'Settings', path: '/dashboard/settings', icon: Settings },
];

const managerNav: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'My Subscription', path: '/dashboard/my-subscription', icon: CalendarCheck },
  { label: 'Influencers', path: '/dashboard/influencers', icon: Users },
  { label: 'Coupons', path: '/dashboard/coupons', icon: Ticket },
  { label: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Wallet', path: '/dashboard/wallet', icon: Wallet },
];

const influencerNav: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'My Subscription', path: '/dashboard/my-subscription', icon: CalendarCheck },
  { label: 'My Coupons', path: '/dashboard/coupons', icon: Ticket },
  { label: 'Ledger', path: '/dashboard/ledger', icon: BarChart3 },
  { label: 'Wallet', path: '/dashboard/wallet', icon: Wallet },
  { label: 'Profile', path: '/dashboard/profile', icon: Settings },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);

  const navItems = role === 'admin' ? adminNav : role === 'manager' ? managerNav : influencerNav;

  const roleLabel = role === 'admin' ? 'Super Admin' : role === 'manager' ? 'Manager' : 'Influencer';

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r border-border flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-foreground truncate">Viral Growth</p>
              <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-border space-y-2">
          {!collapsed && profile && (
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-foreground truncate">{profile.full_name || profile.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className={cn('flex-1 transition-all duration-300', collapsed ? 'ml-16' : 'ml-64')}>
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
