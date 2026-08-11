import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/StatCard';
import { Ticket, DollarSign, Lock, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

const InfluencerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    lockedEarnings: 0,
    availableEarnings: 0,
    conversions: 0,
    referredUsers: 0,
    totalCreditPurchases: 0,
    totalSalesRevenue: 0,
  });

  const fetchData = async () => {
    if (!user) return;
    const [couponsRes, commissionsRes, attributionsRes, transactionsRes, salesRes] = await Promise.all([
      supabase.from('coupons').select('*').eq('influencer_id', user.id),
      supabase.from('commissions').select('*').eq('influencer_id', user.id),
      supabase.from('user_attributions').select('id').eq('influencer_id', user.id),
      supabase.from('credit_transactions').select('amount_paid, coupon_id').in('transaction_type', ['purchase', 'topup']),
      supabase.from('sales').select('final_amount'),
    ]);

    setCoupons(couponsRes.data ?? []);

    const commissions = commissionsRes.data ?? [];
    const totalEarnings = commissions.reduce((s, c) => s + Number(c.influencer_amount), 0);
    const lockedEarnings = commissions.filter(c => c.status === 'locked').reduce((s, c) => s + Number(c.influencer_amount), 0);
    const availableEarnings = commissions.filter(c => c.status === 'unlocked').reduce((s, c) => s + Number(c.influencer_amount), 0);

    const myCouponIds = (couponsRes.data ?? []).map((c: any) => c.id);
    const myTransactions = (transactionsRes.data ?? []).filter((t: any) => myCouponIds.includes(t.coupon_id));
    const totalSalesRevenue = salesRes.data?.reduce((s, r) => s + Number(r.final_amount), 0) ?? 0;

    setStats({
      totalEarnings,
      lockedEarnings,
      availableEarnings,
      conversions: commissions.length,
      referredUsers: attributionsRes.data?.length ?? 0,
      totalCreditPurchases: myTransactions.reduce((s: number, t: any) => s + Number(t.amount_paid), 0),
      totalSalesRevenue,
    });
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    // Realtime listener for commissions changes
    const channel = supabase
      .channel('influencer-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commissions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => fetchData())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Coupon copied!');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketer Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your performance and earnings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Earnings" value={`$${stats.totalEarnings.toLocaleString()}`} icon={DollarSign} />
        <StatCard title="Locked Earnings" value={`$${stats.lockedEarnings.toLocaleString()}`} icon={Lock} iconColor="text-warning" />
        <StatCard title="Available" value={`$${stats.availableEarnings.toLocaleString()}`} icon={TrendingUp} iconColor="text-success" />
        <StatCard title="Referred Users" value={stats.referredUsers} icon={Users} iconColor="text-info" />
        <StatCard title="Subscription Revenue" value={`$${stats.totalSalesRevenue.toLocaleString()}`} icon={TrendingUp} iconColor="text-warning" />
        <StatCard title="Credit Purchases" value={`$${stats.totalCreditPurchases.toLocaleString()}`} icon={Ticket} iconColor="text-accent" />
        <StatCard title="Conversions" value={stats.conversions} icon={Ticket} iconColor="text-primary" />
      </div>

      {/* Coupons */}
      <div className="stat-card rounded-xl border border-border p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Your Coupons</h3>
        {coupons.length === 0 ? (
          <p className="text-muted-foreground text-sm">No coupons assigned yet.</p>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                <div>
                  <code className="text-sm font-mono text-foreground font-semibold">{coupon.code}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {coupon.discount_percent}% off • {coupon.usage_count}/{coupon.usage_limit ?? '∞'} used
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCoupon(coupon.code)}
                  className="text-primary hover:text-primary"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InfluencerDashboard;
