import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, User, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';

type Mode = 'signin' | 'forgot' | 'signup-form' | 'signup-otp';

const AuthPage: React.FC = () => {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-api`;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setOtp('');
  };

  const switchMode = (next: Mode) => {
    if (next === 'signin') resetFields();
    setMode(next);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };




  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Please enter your email'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success('Reset code sent! Check your email.');
        navigate('/reset-password', { state: { email: email.trim() } });
      } else {
        toast.error(result.error || 'Failed to send reset code');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast.error('Please fill all fields (password min 8 chars)');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/send-signup-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success('Verification code sent! Check your email.');
        setMode('signup-otp');
      } else {
        toast.error(result.error || 'Failed to send code');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setSubmitting(true);
    try {
      // 1) Verify OTP
      const verifyRes = await fetch(`${apiBase}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        toast.error(verifyData.error || 'Invalid or expired code');
        return;
      }

      // 2) Create the account
      const regRes = await fetch(`${apiBase}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        toast.error(regData.error || 'Registration failed');
        return;
      }

      // 3) Sign in
      const { error: signInError } = await signIn(email.trim().toLowerCase(), password);
      if (signInError) {
        toast.success('Account created! Please sign in.');
        switchMode('signin');
      } else {
        toast.success('Welcome aboard!');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/send-signup-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.ok) {
        toast.success('New code sent!');
        setOtp('');
      } else {
        toast.error('Failed to resend code');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-info/5" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Viral Growth</span>
          </div>
          <p className="text-muted-foreground text-sm">Master Command Center</p>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-foreground leading-tight">
            Scale your affiliate <br />
            <span className="gradient-text">empire effortlessly</span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            Manage influencers, track commissions, and grow revenue with a powerful 3-tier performance marketing platform.
          </p>
        </div>
        <div className="relative z-10 text-xs text-muted-foreground">
          © 2026 Viral Growth. All rights reserved.
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Viral Growth</span>
          </div>

          {mode === 'forgot' && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Reset Password</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Enter your email and we'll send you a reset code
                </p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Send Reset Code<ArrowRight className="ml-2 h-4 w-4" /></>)}
                </Button>
              </form>
              <button onClick={() => switchMode('signin')} className="flex items-center gap-1 text-sm text-primary hover:underline font-medium">
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            </>
          )}

          {mode === 'signin' && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
                <p className="text-muted-foreground mt-1 text-sm">Sign in to your command center</p>
              </div>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground" required minLength={6} />
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => switchMode('forgot')} className="text-sm text-primary hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Sign In<ArrowRight className="ml-2 h-4 w-4" /></>)}
                </Button>
              </form>

            </>
          )}

          {mode === 'signup-form' && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
                <p className="text-muted-foreground mt-1 text-sm">We'll email you a 6-digit code to verify your address</p>
              </div>
              <form onSubmit={handleSendSignupOtp} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground" required />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground" required minLength={8} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Send verification code<ArrowRight className="ml-2 h-4 w-4" /></>)}
                </Button>
              </form>
              <button onClick={() => switchMode('signin')} className="flex items-center gap-1 text-sm text-primary hover:underline font-medium">
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            </>
          )}

          {mode === 'signup-otp' && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Enter verification code</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
              </div>
              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div className="flex justify-center py-2">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={submitting || otp.length !== 6}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Verify & Create Account<ArrowRight className="ml-2 h-4 w-4" /></>)}
                </Button>
              </form>
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => switchMode('signup-form')} className="flex items-center gap-1 text-primary hover:underline font-medium">
                  <ArrowLeft className="h-3 w-3" /> Change details
                </button>
                <button onClick={handleResendOtp} disabled={submitting} className="text-primary hover:underline font-medium">
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
