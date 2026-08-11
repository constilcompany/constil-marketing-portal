import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Check, Loader2, AlertCircle } from 'lucide-react';

const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  const flow = searchParams.get('flow');

  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID found');
      setVerifying(false);
      return;
    }

    const verify = async () => {
      try {
        if (flow === 'trial') {
          // Verify trial checkout session via user-api
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/user-api/verify-trial`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ session_id: sessionId }),
            }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Trial verification failed');
          setResult({ ...data, is_trial: true });
        } else {
          const { data, error: fnError } = await supabase.functions.invoke('verify-stripe-payment', {
            body: { session_id: sessionId },
          });
          if (fnError) throw fnError;
          if (data?.error) throw new Error(data.error);
          setResult(data);
        }
      } catch (err: any) {
        setError(err.message || 'Verification failed');
      } finally {
        setVerifying(false);
      }
    };
    verify();
  }, [sessionId, flow]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full stat-card rounded-2xl border border-border p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Payment Issue</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate('/dashboard')} className="w-full">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full stat-card rounded-2xl border border-border p-8 text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {result?.is_trial ? 'Trial Activated!' : 'Payment Successful!'}
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          {result?.package_name && <p>Package: <span className="text-foreground font-semibold">{result.package_name}</span></p>}
          {result?.is_trial && result?.trial_days && (
            <p>Free trial: <span className="text-foreground font-semibold">{result.trial_days} days</span></p>
          )}
          {result?.is_trial && (
            <p className="text-xs text-muted-foreground">Your card will be charged automatically after the trial ends.</p>
          )}
          {!result?.is_trial && result?.credits_added && <p>Credits Added: <span className="text-foreground font-semibold">+{result.credits_added}</span></p>}
          {!result?.is_trial && result?.final_price != null && <p>Amount Paid: <span className="text-foreground font-semibold">${Number(result.final_price).toFixed(2)}</span></p>}
          {result?.status === 'already_processed' && <p className="text-accent">This was already processed.</p>}
        </div>
        <Button onClick={() => navigate('/dashboard')} className="w-full">Go to Dashboard</Button>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
