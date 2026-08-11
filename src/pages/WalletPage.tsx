import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useWalletData } from '@/hooks/use-query-helpers';
import StatCard from '@/components/StatCard';
import { DollarSign, Lock, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getSafeErrorMessage } from '@/lib/security';

const WalletPage: React.FC = () => {
  const { user, role } = useAuth();
  const { data, isLoading, refetch } = useWalletData(user?.id, role);
  const [requesting, setRequesting] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  React.useEffect(() => {
    if (!user) return;
    const fetchSub = async () => {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('expiry_date, is_active, status, is_trial, billing_type, credit_packages(name)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubscription(subData);
    };
    fetchSub();
  }, [user]);

  const requestPayout = async () => {
    if (!user || !data || data.earnings.available < data.threshold) {
      toast.error(`Minimum payout threshold is $${data?.threshold ?? 50}`);
      return;
    }
    setRequesting(true);
    try {
      const { error } = await supabase.from('payout_requests').insert({
        user_id: user.id,
        amount: data.earnings.available,
      });
      if (error) toast.error(getSafeErrorMessage(error));
      else {
        toast.success('Payout requested!');
        refetch();
      }
    } finally {
      setRequesting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>

        {subscription && (
          <div className="stat-card rounded-xl border border-border p-6">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Active Subscription</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="text-sm font-semibold text-foreground">{subscription.credit_packages?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Billing</p>
                <p className="text-sm font-medium capitalize text-foreground">{subscription.billing_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expires On</p>
                <p className={`text-sm font-semibold ${new Date(subscription.expiry_date) <= new Date() ? 'text-destructive' : 'text-success'}`}>
                  {new Date(subscription.expiry_date).toLocaleDateString()}
                  {new Date(subscription.expiry_date) > new Date() && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({Math.ceil((new Date(subscription.expiry_date).getTime() - Date.now()) / 86400000)} days left)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  const { earnings, payouts, threshold } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">Your earnings and payout history</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total Earnings" value={`$${earnings.total.toLocaleString()}`} icon={DollarSign} />
          <StatCard title="Locked" value={`$${earnings.locked.toLocaleString()}`} icon={Lock} iconColor="text-warning" />
          <StatCard title="Available" value={`$${earnings.available.toLocaleString()}`} icon={TrendingUp} iconColor="text-success" />
        </div>

        <div className="stat-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Payout History</h3>
            <Button onClick={requestPayout} disabled={requesting || earnings.available < threshold} size="sm">
              Request Payout
            </Button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-3">Amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-6 text-muted-foreground text-sm">No payouts yet</td></tr>
              ) : payouts.map((p: any) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="p-3 text-sm text-foreground font-semibold">${Number(p.amount).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'paid' ? 'bg-success/10 text-success' :
                      p.status === 'approved' ? 'bg-info/10 text-info' :
                      p.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WalletPage;
