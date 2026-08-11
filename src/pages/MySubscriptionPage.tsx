import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CalendarCheck, Clock, Package, AlertTriangle, FileText, Calculator, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MySubscriptionPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [subRes, walletRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*, credit_packages(name, invoice_credits, estimate_credits, ai_estimate_credits, invoice_unlimited, estimate_unlimited, ai_estimate_unlimited, trial_invoice_credits, trial_estimate_credits, trial_ai_estimate_credits)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('user_credit_wallets')
          .select('*')
          .eq('user_id', user.id)
          .single(),
      ]);
      setSub(subRes.data);
      setWallet(walletRes.data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading subscription...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!sub) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Subscription</h1>
            <p className="text-sm text-muted-foreground mt-1">You don't have an active subscription</p>
          </div>
          <div className="stat-card rounded-xl border border-border p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
            <p className="text-muted-foreground">No active plan found. Browse available packages to get started.</p>
            <Button onClick={() => navigate('/pricing')}>View Plans</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const now = new Date();
  const expiryDate = new Date(sub.expiry_date);
  const startDate = new Date(sub.start_date);
  const totalDuration = expiryDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000));
  const isExpired = expiryDate <= now;

  const isTrial = sub.is_trial && sub.status === 'trial';
  const trialEnd = sub.trial_end_at ? new Date(sub.trial_end_at) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : 0;

  const pkg = sub.credit_packages;

  // Determine allocated credits based on trial vs paid
  const allocatedInvoice = isTrial ? (pkg?.trial_invoice_credits ?? 0) : (pkg?.invoice_credits ?? 0);
  const allocatedEstimate = isTrial ? (pkg?.trial_estimate_credits ?? 0) : (pkg?.estimate_credits ?? 0);
  const allocatedAi = isTrial ? (pkg?.trial_ai_estimate_credits ?? 0) : (pkg?.ai_estimate_credits ?? 0);

  const creditBuckets = [
    {
      label: 'Invoice Credits',
      icon: FileText,
      remaining: wallet?.invoice_remaining ?? 0,
      allocated: allocatedInvoice,
      unlimited: isTrial ? false : (pkg?.invoice_unlimited ?? false),
    },
    {
      label: 'Estimate Credits',
      icon: Calculator,
      remaining: wallet?.estimate_remaining ?? 0,
      allocated: allocatedEstimate,
      unlimited: isTrial ? false : (pkg?.estimate_unlimited ?? false),
    },
    {
      label: 'AI Estimate Credits',
      icon: Bot,
      remaining: wallet?.ai_estimate_remaining ?? 0,
      allocated: allocatedAi,
      unlimited: isTrial ? false : (pkg?.ai_estimate_unlimited ?? false),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1">Your current plan details and usage</p>
        </div>

        {/* Trial banner */}
        {isTrial && !isExpired && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Free Trial Active</p>
                <p className="text-xs text-muted-foreground">
                  Trial ends in <span className="font-bold text-primary">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</span>
                  {trialEnd && <> — {trialEnd.toLocaleDateString()}</>}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/pricing')}>Upgrade Now</Button>
          </div>
        )}

        {/* Expired banner */}
        {isExpired && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-foreground">Subscription Expired</p>
                <p className="text-xs text-muted-foreground">Your plan expired on {expiryDate.toLocaleDateString()}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/pricing')}>Renew Plan</Button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Current Plan"
            value={pkg?.name || '—'}
            icon={Package}
          />
          <StatCard
            title="Expires On"
            value={expiryDate.toLocaleDateString()}
            icon={CalendarCheck}
            iconColor={isExpired ? 'text-destructive' : daysLeft <= 7 ? 'text-warning' : 'text-success'}
          />
          <StatCard
            title="Days Remaining"
            value={isExpired ? 'Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
            icon={Clock}
            iconColor={isExpired ? 'text-destructive' : daysLeft <= 7 ? 'text-warning' : 'text-success'}
          />
        </div>

        {/* Subscription progress */}
        <div className="stat-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Plan Duration</h3>
            <Badge variant={isTrial ? 'outline' : isExpired ? 'secondary' : 'default'}>
              {isTrial ? 'Trial' : isExpired ? 'Expired' : 'Active'}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{startDate.toLocaleDateString()}</span>
              <span>{expiryDate.toLocaleDateString()}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {isExpired ? 'Plan has expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Billing Type</p>
              <p className="text-sm font-medium capitalize text-foreground">{sub.billing_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Template Tier</p>
              <p className="text-sm font-medium capitalize text-foreground">{sub.template_tier}</p>
            </div>
          </div>
        </div>

        {/* Credit usage */}
        <div className="stat-card rounded-xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Credit Usage {isTrial && <span className="text-primary font-normal">(Trial Limits)</span>}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creditBuckets.map((bucket) => {
              const used = Math.max(0, bucket.allocated - bucket.remaining);
              const pct = bucket.unlimited ? 0 : (bucket.allocated > 0 ? (used / bucket.allocated) * 100 : 0);
              return (
                <div key={bucket.label} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <bucket.icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">{bucket.label}</p>
                  </div>
                  {bucket.unlimited ? (
                    <p className="text-2xl font-bold text-primary">Unlimited</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-foreground">
                        {bucket.remaining} <span className="text-sm font-normal text-muted-foreground">/ {bucket.allocated}</span>
                      </p>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{used} used</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MySubscriptionPage;
