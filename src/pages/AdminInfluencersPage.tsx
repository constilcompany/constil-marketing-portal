import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, Ticket } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface InfluencerRow {
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  manager_name: string | null;
  coupon_code: string | null;
  coupon_usage: number;
}

const AdminInfluencersPage: React.FC = () => {
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfluencers = async () => {
      // Get all influencer user_ids
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'influencer');

      if (!roleData?.length) {
        setInfluencers([]);
        setLoading(false);
        return;
      }

      const influencerIds = roleData.map(r => r.user_id);

      // Fetch profiles, manager links, and coupons in parallel
      const [profilesRes, linksRes, couponsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email, created_at').in('user_id', influencerIds),
        supabase.from('manager_influencers').select('influencer_id, manager_id').in('influencer_id', influencerIds),
        supabase.from('coupons').select('influencer_id, code, usage_count').in('influencer_id', influencerIds),
      ]);

      const profiles = profilesRes.data ?? [];
      const links = linksRes.data ?? [];
      const coupons = couponsRes.data ?? [];

      // Get manager names
      const managerIds = [...new Set(links.map(l => l.manager_id))];
      let managerMap: Record<string, string> = {};
      if (managerIds.length > 0) {
        const { data: managerProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', managerIds);
        managerMap = Object.fromEntries((managerProfiles ?? []).map(m => [m.user_id, m.full_name]));
      }

      const rows: InfluencerRow[] = profiles.map(p => {
        const link = links.find(l => l.influencer_id === p.user_id);
        const coupon = coupons.find(c => c.influencer_id === p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          created_at: p.created_at,
          manager_name: link ? (managerMap[link.manager_id] || '—') : null,
          coupon_code: coupon?.code ?? null,
          coupon_usage: coupon?.usage_count ?? 0,
        };
      });

      setInfluencers(rows);
      setLoading(false);
    };
    fetchInfluencers();
  }, []);

  const filtered = influencers.filter(i =>
    i.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.email?.toLowerCase().includes(search.toLowerCase()) ||
    i.coupon_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Influencer Management</h1>
          <p className="text-sm text-muted-foreground mt-1">View all influencers across all managers</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search influencers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>

        <div className="stat-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Manager</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Coupon</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Usage</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No influencers found</td></tr>
              ) : filtered.map(i => (
                <tr key={i.user_id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="p-4 text-sm text-foreground">{i.full_name || '—'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{i.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {i.manager_name ? (
                      <Badge variant="outline" className="text-xs">{i.manager_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground/50">Unassigned</span>
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {i.coupon_code ? (
                      <code className="text-xs font-mono bg-secondary px-2 py-1 rounded text-foreground">{i.coupon_code}</code>
                    ) : '—'}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{i.coupon_usage}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminInfluencersPage;