import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, ExternalLink, CheckCircle, Loader2, CreditCard, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ProfilePage: React.FC = () => {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    bank_name: profile?.bank_name ?? '',
    bank_account: profile?.bank_account ?? '',
    payment_method: profile?.payment_method ?? 'bank_transfer',
  });
  const [saving, setSaving] = useState(false);

  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboarding_complete: boolean;
  } | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(true);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    checkStripeStatus();
  }, []);

  const checkStripeStatus = async () => {
    setLoadingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect/status');
      if (error) throw error;
      setStripeStatus(data);
    } catch {
      setStripeStatus({ connected: false, onboarding_complete: false });
    } finally {
      setLoadingStripe(false);
    }
  };

  const startOnboarding = async () => {
    setOnboarding(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect/onboard');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('Stripe onboarding opened in a new tab');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start Stripe onboarding');
    } finally {
      setOnboarding(false);
    }
  };

  const openStripeDashboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect/dashboard');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open Stripe dashboard');
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update(form as any).eq('user_id', user.id);
    if (error) toast.error(error.message);
    else toast.success('Profile updated!');
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Update your personal and payment info</p>
        </div>

        {/* Personal Info */}
        <div className="stat-card rounded-xl border border-border p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="bg-secondary border-border" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input value={profile?.email ?? ''} disabled className="bg-secondary border-border opacity-60" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Phone</label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-secondary border-border" />
          </div>
        </div>

        {/* Stripe Connect Section */}
        <div className="stat-card rounded-xl border border-border p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Stripe Connect</h3>
            </div>
            {stripeStatus?.onboarding_complete && (
              <Badge variant="default" className="bg-success/20 text-success border-success/30">
                <CheckCircle className="h-3 w-3 mr-1" /> Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Connect your Stripe account to receive commission payouts directly to your bank account via Stripe.
          </p>

          {loadingStripe ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking Stripe status...
            </div>
          ) : stripeStatus?.onboarding_complete ? (
            <div className="space-y-3">
              <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-sm">
                <p className="text-success font-medium">✓ Your Stripe account is fully connected</p>
                <p className="text-muted-foreground text-xs mt-1">Commission payouts can be sent directly to your Stripe account.</p>
              </div>
              <Button variant="outline" size="sm" onClick={openStripeDashboard}>
                <ExternalLink className="h-4 w-4 mr-2" /> Open Stripe Dashboard
              </Button>
            </div>
          ) : stripeStatus?.connected ? (
            <div className="space-y-3">
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-sm">
                <p className="text-accent font-medium">⚠ Onboarding incomplete</p>
                <p className="text-muted-foreground text-xs mt-1">Please complete your Stripe account setup to receive payouts.</p>
              </div>
              <Button onClick={startOnboarding} disabled={onboarding}>
                {onboarding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Complete Stripe Setup
              </Button>
            </div>
          ) : (
            <Button onClick={startOnboarding} disabled={onboarding}>
              {onboarding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Connect Stripe Account
            </Button>
          )}
        </div>

        {/* Bank Transfer Section */}
        <div className="stat-card rounded-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Bank Transfer</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Alternative payout method via manual bank transfer (processed by admin).
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Bank Name</label>
            <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="bg-secondary border-border" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Bank Account</label>
            <Input value={form.bank_account} onChange={e => setForm({ ...form, bank_account: e.target.value })} className="bg-secondary border-border" />
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" /> Save Profile
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
