-- =========================================
-- 1. CLEAN UP (Optional but recommended for fresh start)
-- =========================================
DROP TABLE IF EXISTS public.pdf_jobs CASCADE;
DROP TABLE IF EXISTS public.ai_estimate_results CASCADE;
DROP TABLE IF EXISTS public.ai_estimates CASCADE;
DROP TABLE IF EXISTS public.ai_invoices CASCADE;
DROP TABLE IF EXISTS public.estimate_template_locks CASCADE;
DROP TABLE IF EXISTS public.invoice_template_locks CASCADE;
DROP TABLE IF EXISTS public.estimate_mails CASCADE;
DROP TABLE IF EXISTS public.invoice_mails CASCADE;
DROP TABLE IF EXISTS public.estimate_pdfs CASCADE;
DROP TABLE IF EXISTS public.invoice_pdfs CASCADE;
DROP TABLE IF EXISTS public.estimate_item_discounts CASCADE;
DROP TABLE IF EXISTS public.estimate_item_taxes CASCADE;
DROP TABLE IF EXISTS public.invoice_item_discounts CASCADE;
DROP TABLE IF EXISTS public.invoice_item_taxes CASCADE;
DROP TABLE IF EXISTS public.estimate_items CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.estimates CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.discounts CASCADE;
DROP TABLE IF EXISTS public.taxes CASCADE;
DROP TABLE IF EXISTS public.company_legal_info CASCADE;
DROP TABLE IF EXISTS public.company_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.user_credits CASCADE;
DROP TABLE IF EXISTS public.user_credit_wallets CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.credit_packages CASCADE;
DROP TABLE IF EXISTS public.global_settings CASCADE;
DROP TABLE IF EXISTS public.manager_influencers CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.user_attributions CASCADE;

-- =========================================
-- 2. ENUMS & EXTENSIONS
-- =========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'influencer', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.pdf_job_status AS ENUM ('pending', 'processing', 'done', 'fail');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =========================================
-- 3. CORE TABLES
-- =========================================

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'bank_transfer',
  company_name TEXT,
  address TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  country TEXT DEFAULT '',
  signup_method TEXT DEFAULT 'manual',
  stripe_account_id TEXT DEFAULT NULL,
  stripe_onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'influencer',
  UNIQUE(user_id, role)
);

-- Wallet and Credits
CREATE TABLE public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_credit_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  invoice_remaining INTEGER NOT NULL DEFAULT 0,
  estimate_remaining INTEGER NOT NULL DEFAULT 0,
  ai_estimate_remaining INTEGER NOT NULL DEFAULT 0,
  invoice_unlimited BOOLEAN NOT NULL DEFAULT false,
  estimate_unlimited BOOLEAN NOT NULL DEFAULT false,
  ai_estimate_unlimited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business Tables
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) DEFAULT 0.00,
  ref TEXT,
  extra_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_number TEXT,
  status TEXT DEFAULT 'draft',
  invoice_date DATE,
  payment_terms SMALLINT,
  template_number SMALLINT,
  total_amount NUMERIC(15,2) DEFAULT 0.00,
  logo_url TEXT,
  signature_url TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  estimate_number TEXT,
  status TEXT DEFAULT 'pending',
  estimate_date DATE,
  payment_terms SMALLINT,
  template_number SMALLINT,
  total_amount NUMERIC(15,2) DEFAULT 0.00,
  logo_url TEXT,
  signature_url TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  name TEXT,
  quantity INTEGER DEFAULT 1,
  price NUMERIC(10,2) DEFAULT 0.00,
  tax_key BOOLEAN DEFAULT false,
  discount_key BOOLEAN DEFAULT false,
  tax JSONB DEFAULT '[]'::jsonb,
  discount JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE public.estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE CASCADE,
  name TEXT,
  quantity INTEGER DEFAULT 1,
  price NUMERIC(10,2) DEFAULT 0.00,
  tax_key BOOLEAN DEFAULT false,
  discount_key BOOLEAN DEFAULT false,
  tax JSONB DEFAULT '[]'::jsonb,
  discount JSONB DEFAULT '[]'::jsonb
);

-- =========================================
-- 4. UTILITY FUNCTIONS & TRIGGERS
-- =========================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, signup_method)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'signup_source', 'manual'));
  
  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_credit_wallets (user_id) VALUES (NEW.id);
  
  IF COALESCE(NEW.raw_user_meta_data->>'signup_source', '') = 'portal' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'influencer');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- 5. RLS POLICIES (CORE)
-- =========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own clients" ON public.clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own products" ON public.products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own estimates" ON public.estimates FOR ALL USING (auth.uid() = user_id);

-- =========================================
-- 6. STORAGE
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('company-logos', 'company-logos', true),
  ('document-logos', 'document-logos', true),
  ('signatures', 'signatures', false),
  ('generated-pdfs', 'generated-pdfs', false),
  ('ai-inputs', 'ai-inputs', false),
  ('ai-outputs', 'ai-outputs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users upload own files" ON storage.objects FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own private files" ON storage.objects FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================
-- 7. REFRESH CACHE
-- =========================================
NOTIFY pgrst, 'reload schema';
