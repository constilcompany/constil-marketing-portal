import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CreditCard, Check, Tag, ShieldCheck, Loader2 } from 'lucide-react';

const MockCheckoutPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const packageId = searchParams.get('package_id');
  const billingType = searchParams.get('billing_type') || 'one_time';

  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<{
    valid: boolean;
    discount_percent: number;
    influencer_name: string | null;
  } | null>(null);
  const [validating, setValidating] = useState(false);

  // Mock flow state
  const [paymentIntent, setPaymentIntent] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  // Payment mode
  const [paymentMode, setPaymentMode] = useState<string>('mock');
  const [loadingMode, setLoadingMode] = useState(true);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  useEffect(() => {
    supabase.from('global_settings').select('payment_mode').single().then(({ data }) => {
      if (data) setPaymentMode(data.payment_mode);
      setLoadingMode(false);
    });
  }, []);

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidating(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mock-stripe/validate-coupon?code=${encodeURIComponent(couponCode)}`,
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
  };

  const handleStripeCheckout = async () => {
    if (!user || !packageId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          package_id: packageId,
          billing_type: billingType,
          coupon_code: couponCode.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Failed to start checkout');
    } finally {
      setCreating(false);
    }
  };

  const createPaymentIntent = async () => {
    if (!user || !packageId) return;
    setCreating(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mock-stripe/create-payment-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ package_id: packageId, billing_type: billingType, coupon_code: couponCode.trim() || undefined }),
        }
      );
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else setPaymentIntent(data);
    } catch {
      toast.error('Failed to create payment');
    } finally {
      setCreating(false);
    }
  };

  const confirmPayment = async () => {
    if (!paymentIntent?.payment_intent_id) return;
    setConfirming(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mock-stripe/confirm-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ payment_intent_id: paymentIntent.payment_intent_id }),
        }
      );
      const data = await res.json();
      if (data.status === 'succeeded') {
        setSuccess(true);
        toast.success('Payment successful! Credits added.');
      } else {
        toast.error('Payment failed');
      }
    } catch {
      toast.error('Payment confirmation failed');
    } finally {
      setConfirming(false);
    }
  };

  const handleProceed = () => {
    if (paymentMode === 'stripe_live') {
      handleStripeCheckout();
    } else {
      createPaymentIntent();
    }
  };

  if (loadingMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full stat-card rounded-2xl border border-border p-8 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Payment Successful!</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Credits: <span className="text-foreground font-semibold">+{paymentIntent?.credits_added || 'N/A'}</span></p>
            <p>Amount Paid: <span className="text-foreground font-semibold">${paymentIntent?.final_price?.toFixed(2)}</span></p>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="w-full">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
          <p className="text-sm text-muted-foreground">
            {paymentMode === 'stripe_live' ? 'Secure Stripe Payment' : 'Mock Stripe Payment'}
          </p>
        </div>

        {/* Coupon + Proceed (before payment intent / stripe redirect) */}
        {!paymentIntent && (
          <div className="stat-card rounded-xl border border-border p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Tag className="h-4 w-4 text-accent" /> Have a coupon code?
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value)}
                className="bg-secondary border-border font-mono uppercase"
              />
              <Button variant="outline" onClick={validateCoupon} disabled={validating || !couponCode.trim()}>
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
              </Button>
            </div>
            {couponValidation && (
              <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-sm">
                <p className="text-success font-medium">✓ Coupon applied: {couponValidation.discount_percent}% off</p>
                {couponValidation.influencer_name && (
                  <p className="text-muted-foreground text-xs mt-1">via {couponValidation.influencer_name}</p>
                )}
              </div>
            )}
            <Button onClick={handleProceed} disabled={creating} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {creating ? 'Preparing...' : paymentMode === 'stripe_live' ? 'Pay with Stripe' : 'Proceed to Payment'}
            </Button>
          </div>
        )}

        {/* Mock payment summary (only for mock mode) */}
        {paymentIntent && !success && paymentMode !== 'stripe_live' && (
          <div className="stat-card rounded-xl border border-border overflow-hidden animate-slide-up">
            <div className="bg-primary/10 border-b border-border p-6">
              <h3 className="text-lg font-bold text-foreground">{paymentIntent.package_name || 'Package'}</h3>
              <p className="text-xs text-muted-foreground mt-1">Mock Stripe Payment</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original Price</span>
                  <span className="text-foreground font-medium">${paymentIntent.original_price?.toFixed(2)}</span>
                </div>
                {paymentIntent.discount_amount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount ({paymentIntent.discount_percent}%)</span>
                      <span className="text-success font-medium">-${paymentIntent.discount_amount?.toFixed(2)}</span>
                    </div>
                    {paymentIntent.coupon_code && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Coupon</span>
                        <span className="font-mono text-accent">{paymentIntent.coupon_code}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="text-foreground font-semibold">Total</span>
                  <span className="text-xl font-bold text-foreground">${paymentIntent.final_price?.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4 border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Card Number</p>
                <p className="font-mono text-sm text-foreground">4242 4242 4242 4242</p>
                <div className="flex gap-4 mt-2">
                  <div><p className="text-xs text-muted-foreground">Exp</p><p className="font-mono text-sm text-foreground">12/28</p></div>
                  <div><p className="text-xs text-muted-foreground">CVC</p><p className="font-mono text-sm text-foreground">123</p></div>
                </div>
              </div>
              <Button onClick={confirmPayment} disabled={confirming} className="w-full h-12 text-base glow-primary">
                {confirming ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</> : <><ShieldCheck className="h-5 w-5 mr-2" /> Pay ${paymentIntent.final_price?.toFixed(2)}</>}
              </Button>
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Simulated payment — no real charges
              </p>
            </div>
          </div>
        )}

        <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-muted-foreground">← Back</Button>
      </div>
    </div>
  );
};

export default MockCheckoutPage;
