import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/StatCard';
import { Users, CalendarCheck, CalendarX } from 'lucide-react';

const SubscriptionsPage: React.FC = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0 });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*, credit_packages(name), profiles!subscriptions_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false });

      // If the join doesn't work due to missing FK, fetch profiles separately
      let enriched = (data as any[]) ?? [];
      
      // Try to get profile data manually if join fails
      if (enriched.length > 0 && !enriched[0].profiles) {
        const userIds = [...new Set(enriched.map(s => s.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
        const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
        enriched = enriched.map(s => ({ ...s, profile: profileMap.get(s.user_id) }));
      }

      setSubs(enriched);
      const now = new Date();
      setStats({
        total: enriched.length,
        active: enriched.filter(s => s.is_active && new Date(s.expiry_date) > now).length,
        expired: enriched.filter(s => !s.is_active || new Date(s.expiry_date) <= now).length,
      });
    };
    fetch();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">Active and past subscription records</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total Subscriptions" value={stats.total} icon={Users} />
          <StatCard title="Active" value={stats.active} icon={CalendarCheck} iconColor="text-success" />
          <StatCard title="Expired" value={stats.expired} icon={CalendarX} iconColor="text-destructive" />
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Trial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map(s => {
                const profile = s.profiles || s.profile;
                const isExpired = new Date(s.expiry_date) <= new Date();
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{profile?.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{s.credit_packages?.name || '—'}</TableCell>
                    <TableCell className="capitalize text-sm">{s.billing_type}</TableCell>
                    <TableCell className="capitalize text-sm">{s.template_tier}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'trial' ? 'outline' : (s.is_active && !isExpired ? 'default' : 'secondary')}>
                        {s.status === 'trial' ? 'Trial' : (s.is_active && !isExpired ? 'Active' : 'Expired')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(s.start_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(s.expiry_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {s.is_trial ? (
                        <Badge variant="outline" className="text-xs text-primary border-primary/30">
                          {s.trial_end_at ? `Ends ${new Date(s.trial_end_at).toLocaleDateString()}` : 'Yes'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {subs.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No subscriptions yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionsPage;
