import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import StatCard from '@/components/StatCard';
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { name: 'Mon', conversions: 5 },
  { name: 'Tue', conversions: 8 },
  { name: 'Wed', conversions: 12 },
  { name: 'Thu', conversions: 7 },
  { name: 'Fri', conversions: 15 },
  { name: 'Sat', conversions: 9 },
  { name: 'Sun', conversions: 11 },
];

const AnalyticsPage: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Performance breakdown for your team</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Conversions" value="67" change="+23% this week" changeType="positive" icon={BarChart3} />
          <StatCard title="Revenue" value="$4,280" icon={DollarSign} iconColor="text-warning" />
          <StatCard title="Top Performer" value="—" icon={TrendingUp} iconColor="text-info" />
          <StatCard title="Active Influencers" value="0" icon={Users} />
        </div>

        <div className="stat-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Conversions This Week</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockData}>
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
                <Line type="monotone" dataKey="conversions" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ fill: 'hsl(160, 84%, 39%)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
