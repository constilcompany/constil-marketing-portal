import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminStats } from '@/hooks/use-query-helpers';
import StatCard from '@/components/StatCard';
import {
  DollarSign, TrendingUp, Users, Ticket, CreditCard, Package, UserPlus, Zap, CalendarCheck,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import { Loader2 } from 'lucide-react';

const PIE_COLORS = ['hsl(160, 84%, 39%)', 'hsl(217, 91%, 60%)', 'hsl(280, 67%, 60%)', 'hsl(38, 92%, 50%)'];

const AdminDashboard: React.FC = () => {
  const { data, isLoading } = useAdminStats();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { stats, chartData, consumptionByType, creditAllocation } = data;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Master Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your affiliate ecosystem</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Gross Revenue" value={`$${stats.totalSales.toLocaleString()}`} icon={DollarSign} />
        <StatCard title="Monthly Revenue" value={`$${stats.monthlyRevenue.toLocaleString()}`} icon={TrendingUp} iconColor="text-info" />
        <StatCard title="Yearly Revenue" value={`$${stats.yearlyRevenue.toLocaleString()}`} icon={TrendingUp} iconColor="text-success" />
        <StatCard title="Active Subscriptions" value={stats.activeSubscriptions} icon={CalendarCheck} iconColor="text-primary" />
        <StatCard title="Total Payments" value={stats.totalPayments} change={`${stats.successPayments} succeeded / ${stats.failedPayments} failed`} changeType="neutral" icon={CreditCard} iconColor="text-warning" />
        <StatCard title="Credits Sold" value={stats.totalCreditsSold} icon={Package} iconColor="text-accent" />
        <StatCard title="Credits Consumed" value={stats.totalCreditsConsumed} icon={Zap} iconColor="text-primary" />
        <StatCard title="Total Users" value={stats.totalUsers} icon={UserPlus} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Revenue Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.length > 0 ? chartData : [{ name: 'No data', revenue: 0 }]}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
                <XAxis dataKey="name" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 47%, 10%)', border: '1px solid hsl(222, 30%, 16%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(160, 84%, 39%)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Credit Consumption by Type</h3>
          <div className="h-72">
            {consumptionByType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={consumptionByType} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                    {consumptionByType.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 47%, 10%)', border: '1px solid hsl(222, 30%, 16%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No consumption data yet</div>
            )}
          </div>
        </div>

        <div className="stat-card rounded-xl border border-border p-6 lg:col-span-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Credit Allocation Overview</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={creditAllocation}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
                <XAxis dataKey="name" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(222, 47%, 10%)', border: '1px solid hsl(222, 30%, 16%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }} />
                <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
