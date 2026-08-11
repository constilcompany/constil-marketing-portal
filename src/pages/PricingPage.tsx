import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePackages, useTrialUsage } from '@/hooks/use-query-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Tag, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSafeErrorMessage, getEdgeFunctionUrl, sanitizeInput } from '@/lib/security';

interface CreditPackage {
  id: string;
  name: string;
  credit_amount: number;
  price: number;
  is_active: boolean;
  billing_type: string;
  billing_interval: string | null;
  template_tier: string;
  invoice_credits: number;
  estimate_credits: number;
  ai_estimate_credits: number;
  invoice_unlimited: boolean;
  estimate_unlimited: boolean;
  ai_estimate_unlimited: boolean;
  trial_enabled: boolean;
  trial_days: number | null;
}

const tierTemplateCount: Record<string, string> = {
  basic: '3 Invoice & Estimate Templates',
  professional: '8 Invoice & Estimate Templates',
  enterprise: 'All Invoice & Estimate Templates',
};

const PricingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: packages = [], isLoading } = useActivePackages();
  const { data: trialUsed = {} } = useTrialUsage(user?.id);
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<{
    valid: boolean;
    discount_percent: number;
    influencer_name: string | null;
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const [proceeding, setProceeding] = useState(false);

  const filteredPackages = packages.filter(
    (pkg: CreditPackage) => pkg.billing_interval === (isYearly ? 'yearly' : 'monthly')
  );

  const validateCoupon = useCallback(async () => {
    const code = sanitizeInput(couponCode, 50);
    if (!code) return;
    setValidating(true);
    try {
      const res = await fetch(
        `${getEdgeFunctionUrl('mock-stripe/validate-coupon')}?code=${encodeURIComponent(code)}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      if (data.valid) {
        setCouponValidation(data);
        toast.success(`Coupon applied! ${data.discount_percent}% discount`);
      } else {
        setCouponValidation(null);
        toast.error(data.error || 'Invalid coupon');
      }
    } catch {
      toast.error('Failed to validate coupon');
    } finally {
      setValidating(false);
    }
  }, [couponCode]);

  const handleSelectPlan = useCallback(() => {
    if (!selectedPkg) {
      toast.error('Please select a plan');
      return;
    }
    const code = sanitizeInput(couponCode, 50);
    navigate(`/checkout?package_id=${selectedPkg}&billing_type=subscription${code ? `&coupon=${code}` : ''}`);
  }, [selectedPkg, couponCode, navigate]);

  const handleStartTrial = useCallback(async (pkgId: string) => {
    if (proceeding) return; // Prevent duplicate calls
    setProceeding(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { toast.error('Please log in'); return; }

      const res = await fetch(
        getEdgeFunctionUrl('user-api/start-trial'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ package_id: pkgId }),
        }
      );
      const data = await res.json();
      if (!res.ok) { toast.error(getSafeErrorMessage(new Error(data.error))); return; }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setProceeding(false);
    }
  }, [proceeding]);

  const getTotalCredits = (pkg: CreditPackage) => {
    let total = 0;
    if (!pkg.invoice_unlimited) total += pkg.invoice_credits;
    if (!pkg.estimate_unlimited) total += pkg.estimate_credits;
    if (!pkg.ai_estimate_unlimited) total += pkg.ai_estimate_credits;
    return total;
  };

  const popularIndex = filteredPackages.length >= 2 ? 1 : -1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-foreground">Subscription Plan (Upgrade to Pro)</h1>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:px-6 w-full">
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm text-muted-foreground">Save 20% when you choose the Yearly Plan.</p>
          <div className="flex items-center gap-3">
            <span className={cn('text-sm font-medium', !isYearly ? 'text-foreground' : 'text-muted-foreground')}>Monthly</span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={cn('text-sm font-medium', isYearly ? 'text-foreground' : 'text-muted-foreground')}>Yearly</span>
          </div>
        </div>

        {filteredPackages.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No {isYearly ? 'yearly' : 'monthly'} plans available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredPackages.map((pkg: CreditPackage, idx: number) => {
              const isPopular = idx === popularIndex;
              const isSelected = selectedPkg === pkg.id;
              const totalCredits = getTotalCredits(pkg);

              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg.id)}
                  className={cn(
                    'relative rounded-xl border-2 cursor-pointer transition-all duration-200 overflow-hidden',
                    isSelected ? 'border-primary glow-primary' : 'border-border hover:border-muted-foreground/30',
                    isPopular && !isSelected && 'border-accent/50'
                  )}
                >
                  <div className="bg-secondary p-6 pb-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{pkg.name}</h3>
                      {isPopular && (
                        <Badge className="bg-accent text-accent-foreground text-[10px] font-semibold">
                          <Sparkles className="h-3 w-3 mr-1" />Most Popular
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-primary">${Number(pkg.price).toFixed(0)} USD</span>
                      <span className="text-sm text-muted-foreground">/ {pkg.billing_interval || 'monthly'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">
                      {pkg.credit_amount > 0
                        ? `${pkg.credit_amount.toLocaleString()} Credits / ${isYearly ? 'YR' : 'MO'}`
                        : `${totalCredits.toLocaleString()} Credits / ${isYearly ? 'YR' : 'MO'}`}
                    </p>
                  </div>

                  <div className="p-6 space-y-4">
                    <FeatureRow label={pkg.invoice_unlimited ? 'Unlimited Invoices' : `${pkg.invoice_credits} Invoices`} />
                    <FeatureRow label={pkg.estimate_unlimited ? 'Unlimited Estimates' : `${pkg.estimate_credits} Estimates`} />
                    <FeatureRow label={pkg.ai_estimate_unlimited ? 'Unlimited AI Estimates' : `${pkg.ai_estimate_credits} AI Estimates`} />
                    <FeatureRow label={tierTemplateCount[pkg.template_tier] || `${pkg.template_tier} Templates`} />
                    <FeatureRow label="Buy 500 Token Top-Up for $35" />
                    {pkg.trial_enabled && pkg.trial_days && <FeatureRow label={`${pkg.trial_days}-Day Free Trial`} />}
                  </div>

                  <div className="px-6 pb-6 space-y-2">
                    {pkg.trial_enabled && pkg.trial_days && !trialUsed[pkg.id] ? (
                      <Button
                        variant="outline"
                        className="w-full font-semibold border-primary/50 text-primary hover:bg-primary/10"
                        disabled={proceeding}
                        onClick={(e) => { e.stopPropagation(); handleStartTrial(pkg.id); }}
                      >
                        {proceeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Start {pkg.trial_days}-Day Free Trial
                      </Button>
                    ) : null}
                    <Button
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn('w-full font-semibold', isSelected && 'glow-primary')}
                      onClick={(e) => { e.stopPropagation(); setSelectedPkg(pkg.id); }}
                    >
                      {isSelected ? '✓ Selected' : 'SELECT PLAN'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="max-w-md mx-auto stat-card rounded-xl border border-border p-6 space-y-4 mb-8">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Tag className="h-4 w-4 text-accent" /> Have a coupon code?
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="bg-secondary border-border font-mono uppercase"
              maxLength={50}
            />
            <Button variant="outline" onClick={validateCoupon} disabled={validating || !couponCode.trim()}>
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          {couponValidation && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
              <p className="text-primary font-medium">✓ Coupon applied: {couponValidation.discount_percent}% off</p>
              {couponValidation.influencer_name && (
                <p className="text-muted-foreground text-xs mt-1">via {couponValidation.influencer_name}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to home
          </Button>
          <Button onClick={handleSelectPlan} disabled={!selectedPkg || proceeding} className="px-8 glow-primary">
            {proceeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Continue my upgrade
          </Button>
        </div>
      </div>
    </div>
  );
};

const FeatureRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
    <span className="text-sm text-foreground">- {label}</span>
  </div>
);

export default PricingPage;
