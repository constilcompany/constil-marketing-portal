import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerStats } from '@/hooks/use-query-helpers';
import StatCard from '@/components/StatCard';
import { Users, DollarSign, TrendingUp, Ticket, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'Week 1', sales: 12 },
  { name: 'Week 2', sales: 19 },
  { name: 'Week 3', sales: 15 },
  { name: 'Week 4', sales: 22 },
];

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: stats, isLoading } = useManagerStats(user?.id);

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recruiter Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your influencer team</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Team Size" value={stats.teamSize} icon={Users} />
        <StatCard title="Override Earnings" value={`$${stats.overrideEarnings.toLocaleString()}`} icon={DollarSign} iconColor="text-warning" />
        <StatCard title="Team Coupons Active" value={stats.activeCoupons} icon={Ticket} iconColor="text-accent" />
        <StatCard title="Team Revenue" value={`$${stats.teamRevenue.toLocaleString()}`} icon={TrendingUp} iconColor="text-info" />
      </div>

      <div className="stat-card rounded-xl border border-border p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Weekly Sales</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
              <XAxis dataKey="name" stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 10%)',
                  border: '1px solid hsl(222, 30%, 16%)',
                  borderRadius: '8px',
                  color: 'hsl(210, 40%, 96%)',
                }}
              />
              <Bar dataKey="sales" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
