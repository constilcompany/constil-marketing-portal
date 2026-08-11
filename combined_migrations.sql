
-- App role enum


-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'bank_transfer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'influencer',
  UNIQUE(user_id, role)
);

-- Manager-Influencer relationship
CREATE TABLE public.manager_influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  influencer_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(influencer_id)
);

-- Global settings (singleton)
CREATE TABLE public.global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_commission_fixed NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  manager_override_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  lock_period_days INTEGER NOT NULL DEFAULT 30,
  minimum_payout_threshold NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coupons
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  influencer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  manager_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  expiry_date TIMESTAMPTZ,
  usage_limit INTEGER DEFAULT 100,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commissions
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  influencer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  manager_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  influencer_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  manager_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'paid')),
  unlock_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payout requests
CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  -- Default role is influencer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'influencer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON public.global_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS POLICIES

-- Profiles: users see own, admins see all, managers see their influencers
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can view team profiles" ON public.profiles FOR SELECT USING (
  public.has_role(auth.uid(), 'manager') AND
  user_id IN (SELECT influencer_id FROM public.manager_influencers WHERE manager_id = auth.uid())
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- User roles: only admins manage, users can read own
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Manager-influencer: admins and managers
CREATE POLICY "Admins can manage relationships" ON public.manager_influencers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can view own team" ON public.manager_influencers FOR SELECT USING (manager_id = auth.uid());
CREATE POLICY "Managers can insert to own team" ON public.manager_influencers FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'manager') AND manager_id = auth.uid()
);

-- Global settings: admins manage, all authenticated read
CREATE POLICY "Anyone authenticated can read settings" ON public.global_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage settings" ON public.global_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Coupons: admins see all, managers see own, influencers see assigned
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can manage own coupons" ON public.coupons FOR ALL USING (
  public.has_role(auth.uid(), 'manager') AND manager_id = auth.uid()
);
CREATE POLICY "Influencers can view own coupons" ON public.coupons FOR SELECT USING (influencer_id = auth.uid());

-- Sales: admins see all, influencers see own via coupon
CREATE POLICY "Admins can view all sales" ON public.sales FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Influencers can view own sales" ON public.sales FOR SELECT USING (
  coupon_id IN (SELECT id FROM public.coupons WHERE influencer_id = auth.uid())
);
CREATE POLICY "Managers can view team sales" ON public.sales FOR SELECT USING (
  coupon_id IN (SELECT id FROM public.coupons WHERE manager_id = auth.uid())
);

-- Commissions: admins see all, users see own
CREATE POLICY "Admins can manage commissions" ON public.commissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Influencers can view own commissions" ON public.commissions FOR SELECT USING (influencer_id = auth.uid());
CREATE POLICY "Managers can view own commissions" ON public.commissions FOR SELECT USING (manager_id = auth.uid());

-- Payout requests: admins manage all, users manage own
CREATE POLICY "Admins can manage payouts" ON public.payout_requests FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own payouts" ON public.payout_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own payouts" ON public.payout_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- Insert default global settings
INSERT INTO public.global_settings (influencer_commission_fixed, manager_override_percent, lock_period_days, minimum_payout_threshold)
VALUES (10.00, 10.00, 30, 50.00);

-- Credit packages table (admin-managed)
CREATE TABLE public.credit_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  credit_amount INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON public.credit_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage packages"
  ON public.credit_packages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_credit_packages_updated_at
  BEFORE UPDATE ON public.credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- User credits table
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits"
  ON public.user_credits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage credits"
  ON public.user_credits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Credit transactions log
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_id UUID REFERENCES public.credit_packages(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'topup', 'consumption')),
  credits_change INTEGER NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  discount_applied NUMERIC DEFAULT 0,
  coupon_id UUID REFERENCES public.coupons(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage transactions"
  ON public.credit_transactions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Influencers can view referred user transactions"
  ON public.credit_transactions FOR SELECT
  USING (
    coupon_id IN (
      SELECT id FROM public.coupons WHERE influencer_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view team transactions"
  ON public.credit_transactions FOR SELECT
  USING (
    coupon_id IN (
      SELECT id FROM public.coupons WHERE manager_id = auth.uid()
    )
  );

-- User-influencer attribution table (permanent link)
CREATE TABLE public.user_attributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  influencer_id UUID NOT NULL,
  coupon_id UUID REFERENCES public.coupons(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage attributions"
  ON public.user_attributions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Influencers can view own attributions"
  ON public.user_attributions FOR SELECT
  USING (influencer_id = auth.uid());

CREATE POLICY "Managers can view team attributions"
  ON public.user_attributions FOR SELECT
  USING (
    influencer_id IN (
      SELECT influencer_id FROM public.manager_influencers WHERE manager_id = auth.uid()
    )
  );

-- Auto-create user_credits on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'influencer');
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create credit_action_config table for dynamic credit costs
CREATE TABLE public.credit_action_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL UNIQUE,
  credit_cost integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_action_config ENABLE ROW LEVEL SECURITY;

-- Only admins can modify
CREATE POLICY "Admins can manage credit config"
ON public.credit_action_config FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can read (needed for frontend to fetch costs)
CREATE POLICY "Authenticated users can read credit config"
ON public.credit_action_config FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_credit_action_config_updated_at
BEFORE UPDATE ON public.credit_action_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default action configs
INSERT INTO public.credit_action_config (action_type, credit_cost) VALUES
  ('invoice', 1),
  ('estimate', 2),
  ('ai_estimate', 50);

-- Add consumption tracking columns to credit_transactions
-- action_type already exists, add reference_id for audit trail
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS reference_id text;

-- 1. Add subscription-related columns to credit_packages
ALTER TABLE public.credit_packages
ADD COLUMN billing_type text NOT NULL DEFAULT 'one_time',
ADD COLUMN billing_interval text DEFAULT NULL,
ADD COLUMN template_tier text NOT NULL DEFAULT 'basic',
ADD COLUMN invoice_credits integer NOT NULL DEFAULT 0,
ADD COLUMN estimate_credits integer NOT NULL DEFAULT 0,
ADD COLUMN ai_estimate_credits integer NOT NULL DEFAULT 0,
ADD COLUMN invoice_unlimited boolean NOT NULL DEFAULT false,
ADD COLUMN estimate_unlimited boolean NOT NULL DEFAULT false,
ADD COLUMN ai_estimate_unlimited boolean NOT NULL DEFAULT false;

-- 2. Segmented credit wallet per user
CREATE TABLE public.user_credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  invoice_remaining integer NOT NULL DEFAULT 0,
  estimate_remaining integer NOT NULL DEFAULT 0,
  ai_estimate_remaining integer NOT NULL DEFAULT 0,
  invoice_unlimited boolean NOT NULL DEFAULT false,
  estimate_unlimited boolean NOT NULL DEFAULT false,
  ai_estimate_unlimited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wallets" ON public.user_credit_wallets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own wallet" ON public.user_credit_wallets FOR SELECT USING (auth.uid() = user_id);

-- 3. Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid NOT NULL REFERENCES public.credit_packages(id),
  billing_type text NOT NULL DEFAULT 'monthly',
  start_date timestamptz NOT NULL DEFAULT now(),
  expiry_date timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  template_tier text NOT NULL DEFAULT 'basic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 4. Payment transactions table
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid REFERENCES public.credit_packages(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  billing_type text NOT NULL DEFAULT 'one_time',
  stripe_payment_intent_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  payment_mode text NOT NULL DEFAULT 'mock',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment transactions" ON public.payment_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own payment transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = user_id);

-- 5. Mock stripe events log
CREATE TABLE public.mock_stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payment_intent_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mock_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mock events" ON public.mock_stripe_events FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Global setting for payment mode
ALTER TABLE public.global_settings
ADD COLUMN payment_mode text NOT NULL DEFAULT 'mock';

-- 7. Update handle_new_user to also create wallet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'influencer');
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 0);
  INSERT INTO public.user_credit_wallets (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- 8. Triggers for updated_at
CREATE TRIGGER update_user_credit_wallets_updated_at
BEFORE UPDATE ON public.user_credit_wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add auto_generated column to coupons
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

-- Add metadata columns to payment_transactions
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT 0;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS coupon_code text DEFAULT NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS coupon_id uuid DEFAULT NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS influencer_id uuid DEFAULT NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS manager_id uuid DEFAULT NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create function to auto-generate coupon when influencer is created
CREATE OR REPLACE FUNCTION public.auto_create_influencer_coupon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _influencer_name text;
  _coupon_code text;
  _default_discount numeric;
  _counter int := 0;
BEGIN
  -- Only for influencer role
  IF NEW.role != 'influencer' THEN
    RETURN NEW;
  END IF;

  -- Get influencer name from profiles
  SELECT full_name INTO _influencer_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  -- Get default discount from global settings
  SELECT COALESCE(influencer_commission_fixed, 10) INTO _default_discount
  FROM public.global_settings LIMIT 1;

  -- If no settings, default to 10
  IF _default_discount IS NULL THEN
    _default_discount := 10;
  END IF;

  -- Generate coupon code from name
  IF _influencer_name IS NOT NULL AND _influencer_name != '' THEN
    _coupon_code := UPPER(REGEXP_REPLACE(_influencer_name, '[^a-zA-Z0-9]', '', 'g')) || CAST(_default_discount AS int);
  ELSE
    _coupon_code := 'AUTO-' || UPPER(SUBSTRING(NEW.user_id::text FROM 1 FOR 8));
  END IF;

  -- Handle duplicates
  WHILE EXISTS (SELECT 1 FROM public.coupons WHERE code = _coupon_code) LOOP
    _counter := _counter + 1;
    IF _influencer_name IS NOT NULL AND _influencer_name != '' THEN
      _coupon_code := UPPER(REGEXP_REPLACE(_influencer_name, '[^a-zA-Z0-9]', '', 'g')) || CAST(_default_discount AS int) || _counter;
    ELSE
      _coupon_code := 'AUTO-' || UPPER(SUBSTRING(NEW.user_id::text FROM 1 FOR 8)) || _counter;
    END IF;
  END LOOP;

  INSERT INTO public.coupons (code, influencer_id, discount_percent, auto_generated, is_active, usage_limit)
  VALUES (_coupon_code, NEW.user_id, _default_discount, true, true, 1000);

  RETURN NEW;
END;
$$;

-- Create trigger on user_roles insert
DROP TRIGGER IF EXISTS trg_auto_coupon_for_influencer ON public.user_roles;
CREATE TRIGGER trg_auto_coupon_for_influencer
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_influencer_coupon();

-- Fix manager coupon RLS: managers can only view/edit coupons where the influencer is in their team
-- Drop existing manager policy
DROP POLICY IF EXISTS "Managers can manage own coupons" ON public.coupons;

-- Manager can SELECT coupons for influencers in their team
CREATE POLICY "Managers can view team influencer coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND influencer_id IN (
    SELECT influencer_id FROM public.manager_influencers WHERE manager_id = auth.uid()
  )
);

-- Manager can UPDATE coupons for influencers in their team (but not change influencer_id)
CREATE POLICY "Managers can update team influencer coupons"
ON public.coupons
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND influencer_id IN (
    SELECT influencer_id FROM public.manager_influencers WHERE manager_id = auth.uid()
  )
);

-- Rename influencer_commission_fixed to influencer_commission_percent
ALTER TABLE public.global_settings 
  RENAME COLUMN influencer_commission_fixed TO influencer_commission_percent;

-- Update the auto_create_influencer_coupon function to reference the new column name
CREATE OR REPLACE FUNCTION public.auto_create_influencer_coupon()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _influencer_name text;
  _coupon_code text;
  _default_discount numeric;
  _counter int := 0;
BEGIN
  IF NEW.role != 'influencer' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _influencer_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  SELECT COALESCE(influencer_commission_percent, 10) INTO _default_discount
  FROM public.global_settings LIMIT 1;

  IF _default_discount IS NULL THEN
    _default_discount := 10;
  END IF;

  IF _influencer_name IS NOT NULL AND _influencer_name != '' THEN
    _coupon_code := UPPER(REGEXP_REPLACE(_influencer_name, '[^a-zA-Z0-9]', '', 'g')) || CAST(_default_discount AS int);
  ELSE
    _coupon_code := 'AUTO-' || UPPER(SUBSTRING(NEW.user_id::text FROM 1 FOR 8));
  END IF;

  WHILE EXISTS (SELECT 1 FROM public.coupons WHERE code = _coupon_code) LOOP
    _counter := _counter + 1;
    IF _influencer_name IS NOT NULL AND _influencer_name != '' THEN
      _coupon_code := UPPER(REGEXP_REPLACE(_influencer_name, '[^a-zA-Z0-9]', '', 'g')) || CAST(_default_discount AS int) || _counter;
    ELSE
      _coupon_code := 'AUTO-' || UPPER(SUBSTRING(NEW.user_id::text FROM 1 FOR 8)) || _counter;
    END IF;
  END LOOP;

  INSERT INTO public.coupons (code, influencer_id, discount_percent, auto_generated, is_active, usage_limit)
  VALUES (_coupon_code, NEW.user_id, _default_discount, true, true, 1000);

  RETURN NEW;
END;
$function$;
-- Rename manager_override_percent to manager_commission_percent in global_settings
ALTER TABLE public.global_settings
  RENAME COLUMN manager_override_percent TO manager_commission_percent;ALTER TABLE public.profiles 
  ADD COLUMN stripe_account_id text DEFAULT NULL,
  ADD COLUMN stripe_onboarding_complete boolean DEFAULT false;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  -- Create credits record
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 0);
  -- Create wallet
  INSERT INTO public.user_credit_wallets (user_id)
  VALUES (NEW.id);
  -- Do NOT assign role or generate coupon here.
  -- Roles are assigned by admin/manager via edge functions only.
  RETURN NEW;
END;
$$;

-- Fix commissions RLS: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Admins can manage commissions" ON public.commissions;
DROP POLICY IF EXISTS "Influencers can view own commissions" ON public.commissions;
DROP POLICY IF EXISTS "Managers can view own commissions" ON public.commissions;

CREATE POLICY "Admins can manage commissions" ON public.commissions FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Influencers can view own commissions" ON public.commissions FOR SELECT TO public USING (influencer_id = auth.uid());
CREATE POLICY "Managers can view own commissions" ON public.commissions FOR SELECT TO public USING (manager_id = auth.uid());

-- Fix sales RLS
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Influencers can view own sales" ON public.sales;
DROP POLICY IF EXISTS "Managers can view team sales" ON public.sales;

CREATE POLICY "Admins can view all sales" ON public.sales FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Influencers can view own sales" ON public.sales FOR SELECT TO public USING (coupon_id IN (SELECT coupons.id FROM coupons WHERE coupons.influencer_id = auth.uid()));
CREATE POLICY "Managers can view team sales" ON public.sales FOR SELECT TO public USING (coupon_id IN (SELECT coupons.id FROM coupons WHERE coupons.manager_id = auth.uid()));

-- Fix coupons RLS
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Influencers can view own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Managers can view team influencer coupons" ON public.coupons;
DROP POLICY IF EXISTS "Managers can update team influencer coupons" ON public.coupons;

CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Influencers can view own coupons" ON public.coupons FOR SELECT TO public USING (influencer_id = auth.uid());
CREATE POLICY "Managers can view team influencer coupons" ON public.coupons FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role) AND influencer_id IN (SELECT manager_influencers.influencer_id FROM manager_influencers WHERE manager_influencers.manager_id = auth.uid()));
CREATE POLICY "Managers can update team influencer coupons" ON public.coupons FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'manager'::app_role) AND influencer_id IN (SELECT manager_influencers.influencer_id FROM manager_influencers WHERE manager_influencers.manager_id = auth.uid()));

-- Fix credit_transactions RLS
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Influencers can view referred user transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Managers can view team transactions" ON public.credit_transactions;

CREATE POLICY "Admins can manage transactions" ON public.credit_transactions FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Influencers can view referred user transactions" ON public.credit_transactions FOR SELECT TO public USING (coupon_id IN (SELECT coupons.id FROM coupons WHERE coupons.influencer_id = auth.uid()));
CREATE POLICY "Managers can view team transactions" ON public.credit_transactions FOR SELECT TO public USING (coupon_id IN (SELECT coupons.id FROM coupons WHERE coupons.manager_id = auth.uid()));

-- Fix user_attributions RLS
DROP POLICY IF EXISTS "Admins can manage attributions" ON public.user_attributions;
DROP POLICY IF EXISTS "Influencers can view own attributions" ON public.user_attributions;
DROP POLICY IF EXISTS "Managers can view team attributions" ON public.user_attributions;

CREATE POLICY "Admins can manage attributions" ON public.user_attributions FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Influencers can view own attributions" ON public.user_attributions FOR SELECT TO public USING (influencer_id = auth.uid());
CREATE POLICY "Managers can view team attributions" ON public.user_attributions FOR SELECT TO public USING (influencer_id IN (SELECT manager_influencers.influencer_id FROM manager_influencers WHERE manager_influencers.manager_id = auth.uid()));

-- Fix remaining tables
DROP POLICY IF EXISTS "Admins can manage settings" ON public.global_settings;
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.global_settings;
CREATE POLICY "Admins can manage settings" ON public.global_settings FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone authenticated can read settings" ON public.global_settings FOR SELECT TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage packages" ON public.credit_packages;
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.credit_packages;
CREATE POLICY "Admins can manage packages" ON public.credit_packages FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active packages" ON public.credit_packages FOR SELECT TO public USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage credit config" ON public.credit_action_config;
DROP POLICY IF EXISTS "Authenticated users can read credit config" ON public.credit_action_config;
CREATE POLICY "Admins can manage credit config" ON public.credit_action_config FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can read credit config" ON public.credit_action_config FOR SELECT TO public USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view team profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Managers can view team profiles" ON public.profiles FOR SELECT TO public USING (has_role(auth.uid(), 'manager'::app_role) AND user_id IN (SELECT manager_influencers.influencer_id FROM manager_influencers WHERE manager_influencers.manager_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage wallets" ON public.user_credit_wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.user_credit_wallets;
CREATE POLICY "Admins can manage wallets" ON public.user_credit_wallets FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own wallet" ON public.user_credit_wallets FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage credits" ON public.user_credits;
DROP POLICY IF EXISTS "Admins can view all credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Admins can manage credits" ON public.user_credits FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins can manage payment transactions" ON public.payment_transactions FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own payment transactions" ON public.payment_transactions FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage payouts" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can create own payouts" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can view own payouts" ON public.payout_requests;
CREATE POLICY "Admins can manage payouts" ON public.payout_requests FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own payouts" ON public.payout_requests FOR INSERT TO public WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can view own payouts" ON public.payout_requests FOR SELECT TO public USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage relationships" ON public.manager_influencers;
DROP POLICY IF EXISTS "Managers can view own team" ON public.manager_influencers;
DROP POLICY IF EXISTS "Managers can insert to own team" ON public.manager_influencers;
CREATE POLICY "Admins can manage relationships" ON public.manager_influencers FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can view own team" ON public.manager_influencers FOR SELECT TO public USING (manager_id = auth.uid());
CREATE POLICY "Managers can insert to own team" ON public.manager_influencers FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND manager_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage mock events" ON public.mock_stripe_events;
CREATE POLICY "Admins can manage mock events" ON public.mock_stripe_events FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT TO public USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.commissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;-- Add trial fields to credit_packages
ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS trial_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days integer;

-- Add trial fields to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Prevent duplicate trials: one trial per user per package
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_trial_per_user_package
  ON public.subscriptions (user_id, package_id)
  WHERE (is_trial = true);CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS trial_invoice_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_estimate_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_ai_estimate_credits integer NOT NULL DEFAULT 0;ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT NULL;
-- Sessions table for session management
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_active_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users can view own sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert own sessions
CREATE POLICY "Users can insert own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can manage all sessions
CREATE POLICY "Admins can manage sessions" ON public.sessions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Rate limiting table
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (identifier, endpoint, window_start);
CREATE INDEX idx_sessions_user_active ON public.sessions (user_id, is_active);

-- No RLS on rate_limits (only accessed by edge functions with service role)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Security definer function to validate session
CREATE OR REPLACE FUNCTION public.validate_session(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = _session_id
      AND user_id = _user_id
      AND is_active = true
  )
$$;

-- Security definer function to invalidate all user sessions
CREATE OR REPLACE FUNCTION public.invalidate_user_sessions(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sessions
  SET is_active = false
  WHERE user_id = _user_id AND is_active = true
$$;

-- Rate limits only accessed by service role in edge functions - add permissive policy for service role
CREATE POLICY "Service role manages rate limits" ON public.rate_limits
  FOR ALL USING (true);

-- Drop overly permissive policy and restrict to authenticated only (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limits;
-- No policies needed - service role bypasses RLS, anon/authenticated users should never access this table directly

CREATE TABLE public.support_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage support queries"
ON public.support_queries FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update support queries"
ON public.support_queries FOR UPDATE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps (email, used, expires_at);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS zip_code text DEFAULT '';

-- =========================================
-- 1. PROFILE EXTENSIONS
-- =========================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text DEFAULT '',
  ADD COLUMN IF NOT EXISTS state text DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text DEFAULT '',
  ADD COLUMN IF NOT EXISTS signup_method text DEFAULT 'manual';

-- =========================================
-- 2. COMPANY PROFILE + LEGAL INFO
-- =========================================
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_legal_name text NOT NULL,
  industry text,
  website text,
  company_email text NOT NULL,
  company_phone text,
  address text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company profile" ON public.company_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all company profiles" ON public.company_profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_company_profiles_updated
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.company_legal_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL UNIQUE REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  legal_business_name text NOT NULL,
  tax_id_number text,
  legal_address text,
  business_type smallint NOT NULL DEFAULT 1, -- 1=not_sure, 2=other, 3=none
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_legal_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own legal info" ON public.company_legal_info
  FOR ALL USING (
    company_profile_id IN (SELECT id FROM public.company_profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    company_profile_id IN (SELECT id FROM public.company_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage all legal info" ON public.company_legal_info
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_company_legal_info_updated
  BEFORE UPDATE ON public.company_legal_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================================
-- 3. TAX & DISCOUNT CATALOGS
-- =========================================
CREATE TABLE IF NOT EXISTS public.taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  rate numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own taxes" ON public.taxes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all taxes" ON public.taxes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  rate numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own discounts" ON public.discounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all discounts" ON public.discounts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- 4. PRODUCTS – add ref + extra_info
-- =========================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS extra_info text;

-- Auto-generate ref like PRD-XXXXXXXX
CREATE OR REPLACE FUNCTION public.set_product_ref()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ref IS NULL OR NEW.ref = '' THEN
    NEW.ref := 'PRD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_products_set_ref ON public.products;
CREATE TRIGGER trg_products_set_ref
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_ref();

-- Backfill refs for existing rows
UPDATE public.products SET ref = 'PRD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8))
  WHERE ref IS NULL OR ref = '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_ref_unique ON public.products(ref);

-- =========================================
-- 5. INVOICE / ESTIMATE EXTRAS
-- =========================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_terms smallint,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS template_number smallint;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS payment_terms smallint,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS estimate_date date,
  ADD COLUMN IF NOT EXISTS template_number smallint;

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS price numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_key boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_key boolean NOT NULL DEFAULT false;

ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS price numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_key boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_key boolean NOT NULL DEFAULT false;

-- =========================================
-- 6. ITEM ↔ TAX/DISCOUNT JUNCTION TABLES
-- =========================================
CREATE TABLE IF NOT EXISTS public.invoice_item_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id uuid NOT NULL REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  tax_id uuid NOT NULL REFERENCES public.taxes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_item_id, tax_id)
);
ALTER TABLE public.invoice_item_taxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoice item taxes" ON public.invoice_item_taxes
  FOR ALL USING (
    invoice_item_id IN (
      SELECT ii.id FROM public.invoice_items ii
      JOIN public.invoices i ON i.id = ii.invoice_id
      WHERE i.user_id = auth.uid()
    )
  ) WITH CHECK (
    invoice_item_id IN (
      SELECT ii.id FROM public.invoice_items ii
      JOIN public.invoices i ON i.id = ii.invoice_id
      WHERE i.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins manage all invoice item taxes" ON public.invoice_item_taxes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.invoice_item_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id uuid NOT NULL REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_item_id, discount_id)
);
ALTER TABLE public.invoice_item_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoice item discounts" ON public.invoice_item_discounts
  FOR ALL USING (
    invoice_item_id IN (
      SELECT ii.id FROM public.invoice_items ii
      JOIN public.invoices i ON i.id = ii.invoice_id
      WHERE i.user_id = auth.uid()
    )
  ) WITH CHECK (
    invoice_item_id IN (
      SELECT ii.id FROM public.invoice_items ii
      JOIN public.invoices i ON i.id = ii.invoice_id
      WHERE i.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins manage all invoice item discounts" ON public.invoice_item_discounts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.estimate_item_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_item_id uuid NOT NULL REFERENCES public.estimate_items(id) ON DELETE CASCADE,
  tax_id uuid NOT NULL REFERENCES public.taxes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estimate_item_id, tax_id)
);
ALTER TABLE public.estimate_item_taxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own estimate item taxes" ON public.estimate_item_taxes
  FOR ALL USING (
    estimate_item_id IN (
      SELECT ei.id FROM public.estimate_items ei
      JOIN public.estimates e ON e.id = ei.estimate_id
      WHERE e.user_id = auth.uid()
    )
  ) WITH CHECK (
    estimate_item_id IN (
      SELECT ei.id FROM public.estimate_items ei
      JOIN public.estimates e ON e.id = ei.estimate_id
      WHERE e.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins manage all estimate item taxes" ON public.estimate_item_taxes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.estimate_item_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_item_id uuid NOT NULL REFERENCES public.estimate_items(id) ON DELETE CASCADE,
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estimate_item_id, discount_id)
);
ALTER TABLE public.estimate_item_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own estimate item discounts" ON public.estimate_item_discounts
  FOR ALL USING (
    estimate_item_id IN (
      SELECT ei.id FROM public.estimate_items ei
      JOIN public.estimates e ON e.id = ei.estimate_id
      WHERE e.user_id = auth.uid()
    )
  ) WITH CHECK (
    estimate_item_id IN (
      SELECT ei.id FROM public.estimate_items ei
      JOIN public.estimates e ON e.id = ei.estimate_id
      WHERE e.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins manage all estimate item discounts" ON public.estimate_item_discounts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- 7. PDF + MAIL HISTORY
-- =========================================
CREATE TABLE IF NOT EXISTS public.invoice_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  pdf_url text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_pdfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoice pdfs" ON public.invoice_pdfs
  FOR ALL USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()))
  WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage all invoice pdfs" ON public.invoice_pdfs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.estimate_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  pdf_url text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_pdfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own estimate pdfs" ON public.estimate_pdfs
  FOR ALL USING (estimate_id IN (SELECT id FROM public.estimates WHERE user_id = auth.uid()))
  WITH CHECK (estimate_id IN (SELECT id FROM public.estimates WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage all estimate pdfs" ON public.estimate_pdfs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.invoice_mails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  client_ids uuid[] NOT NULL DEFAULT '{}',
  recipient_emails text[] NOT NULL DEFAULT '{}',
  file_url text,
  send_copy boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_mails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoice mails" ON public.invoice_mails
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all invoice mails" ON public.invoice_mails
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.estimate_mails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  client_ids uuid[] NOT NULL DEFAULT '{}',
  recipient_emails text[] NOT NULL DEFAULT '{}',
  file_url text,
  send_copy boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_mails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own estimate mails" ON public.estimate_mails
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all estimate mails" ON public.estimate_mails
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- 8. TEMPLATE LOCKS
-- =========================================
CREATE TABLE IF NOT EXISTS public.invoice_template_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  template_number smallint NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_template_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoice template locks" ON public.invoice_template_locks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all invoice template locks" ON public.invoice_template_locks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.estimate_template_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  estimate_id uuid NOT NULL UNIQUE REFERENCES public.estimates(id) ON DELETE CASCADE,
  template_number smallint NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_template_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own estimate template locks" ON public.estimate_template_locks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all estimate template locks" ON public.estimate_template_locks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- 9. AI INVOICES + AI ESTIMATES
-- =========================================
CREATE TABLE IF NOT EXISTS public.ai_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  address text,
  description text,
  input_pdf_url text,
  output_pdf_url text,
  output_json jsonb,
  output_markdown text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ai invoices" ON public.ai_invoices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all ai invoices" ON public.ai_invoices
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.ai_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  address text,
  description text,
  input_pdf_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ai estimates" ON public.ai_estimates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all ai estimates" ON public.ai_estimates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.ai_estimate_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_estimate_id uuid NOT NULL REFERENCES public.ai_estimates(id) ON DELETE CASCADE,
  page_number int NOT NULL,
  extracted_page_pdf_url text,
  output_pdf_url text,
  output_json jsonb,
  output_markdown text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_estimate_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ai estimate results" ON public.ai_estimate_results
  FOR ALL USING (
    ai_estimate_id IN (SELECT id FROM public.ai_estimates WHERE user_id = auth.uid())
  ) WITH CHECK (
    ai_estimate_id IN (SELECT id FROM public.ai_estimates WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage all ai estimate results" ON public.ai_estimate_results
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- 10. STORAGE BUCKETS
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('company-logos', 'company-logos', true),
  ('document-logos', 'document-logos', true),
  ('signatures', 'signatures', false),
  ('generated-pdfs', 'generated-pdfs', false),
  ('ai-inputs', 'ai-inputs', false),
  ('ai-outputs', 'ai-outputs', false)
ON CONFLICT (id) DO NOTHING;

-- Public read for the public buckets
CREATE POLICY "Public read company logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');
CREATE POLICY "Public read document logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'document-logos');

-- Per-user folder write/read for all 6 buckets (folder = user_id)
CREATE POLICY "Users upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('company-logos','document-logos','signatures','generated-pdfs','ai-inputs','ai-outputs')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users update own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('company-logos','document-logos','signatures','generated-pdfs','ai-inputs','ai-outputs')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('company-logos','document-logos','signatures','generated-pdfs','ai-inputs','ai-outputs')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users read own private files" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('signatures','generated-pdfs','ai-inputs','ai-outputs')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Drop the over-broad public SELECT policies that triggered the listing warning
DROP POLICY IF EXISTS "Public read company logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read document logos" ON storage.objects;

-- Restrict SELECT (listing) on public buckets to the owner's folder only.
-- Direct file URLs still work because the bucket is marked public,
-- which goes through the storage CDN and bypasses object-level RLS.
CREATE POLICY "Users list own files in public buckets" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('company-logos','document-logos')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
-- Add alias columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS logo text,
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS total_amount numeric;

-- Add alias columns to estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS logo text,
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS total_amount numeric;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';-- Add denormalized columns to invoice_items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount jsonb DEFAULT '[]'::jsonb;

-- Add denormalized columns to estimate_items
ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount jsonb DEFAULT '[]'::jsonb;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS document_url text;
NOTIFY pgrst, 'reload schema';-- Add 'user' role for the external customer portal
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';-- Update handle_new_user trigger so portal self-signups auto-get the 'user' role.
-- We detect "portal" signups via raw_user_meta_data->>'signup_source' = 'portal'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name, signup_method)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'signup_source', 'manual')
  );
  -- Create credits record
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 0);
  -- Create wallet
  INSERT INTO public.user_credit_wallets (user_id)
  VALUES (NEW.id);
  -- Auto-assign 'user' role for portal self-signups only.
  -- Admin/manager/influencer roles are still assigned by admins via edge functions.
  IF COALESCE(NEW.raw_user_meta_data->>'signup_source', '') = 'portal' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists on auth.users (it may already exist; CREATE OR REPLACE the function only).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;-- Wipe legacy-mapped data so we can re-import cleanly. Keeps auth, profiles, roles, subscriptions intact.
DELETE FROM ai_estimate_results;
DELETE FROM ai_estimates;
DELETE FROM ai_invoices;
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM estimate_items;
DELETE FROM estimates;
DELETE FROM clients;
DELETE FROM products;
DELETE FROM legacy_user_map;-- Reset wallet for admin@bethelstonecorp.com to match their active "Standard" subscription package
UPDATE public.user_credit_wallets
SET
  invoice_unlimited = false,
  estimate_unlimited = false,
  ai_estimate_unlimited = false,
  invoice_remaining = 40,
  estimate_remaining = 30,
  ai_estimate_remaining = 60,
  updated_at = now()
WHERE user_id = '445b1bb3-63bc-45d7-a08c-69067e482924';-- Create custom ENUM type for PDF job status
DO $$ BEGIN
  CREATE TYPE public.pdf_job_status AS ENUM ('pending', 'processing', 'done', 'fail');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create pdf_jobs table
CREATE TABLE IF NOT EXISTS public.pdf_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  userid UUID NOT NULL,
  pdf_key TEXT NOT NULL,
  status public.pdf_job_status NOT NULL DEFAULT 'pending',
  detail JSONB,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_userid ON public.pdf_jobs(userid);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status ON public.pdf_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_created_at ON public.pdf_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.pdf_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: Users can insert their own jobs
CREATE POLICY "Users can insert own pdf jobs"
ON public.pdf_jobs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = userid);

-- RLS: Users can view their own jobs
CREATE POLICY "Users can view own pdf jobs"
ON public.pdf_jobs
FOR SELECT
TO authenticated
USING (auth.uid() = userid);

-- RLS: Users can update their own jobs (so the frontend can also patch if needed; backend uses service role)
CREATE POLICY "Users can update own pdf jobs"
ON public.pdf_jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = userid)
WITH CHECK (auth.uid() = userid);

-- RLS: Admins can manage all pdf jobs
CREATE POLICY "Admins can manage all pdf jobs"
ON public.pdf_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));