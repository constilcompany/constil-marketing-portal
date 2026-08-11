-- =========================================
-- SUPABASE RECONCILIATION MIGRATION
-- Purpose: Sync Database Schema with Frontend (Invoices, Estimates, Credits, Profile)
-- =========================================

-- 1. BASE TABLES
CREATE TABLE IF NOT EXISTS public.taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  type TEXT DEFAULT 'percentage',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT NOT NULL DEFAULT '',
  company_email TEXT,
  company_phone TEXT,
  company_address TEXT,
  company_website TEXT,
  registration_number TEXT,
  tax_number TEXT,
  logo_url TEXT,
  signature_url TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_sort_code TEXT,
  footer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. FIELD UPDATES
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- 3. JUNCTION TABLES
CREATE TABLE IF NOT EXISTS public.invoice_item_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id UUID REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  tax_id UUID REFERENCES public.taxes(id) ON DELETE CASCADE,
  UNIQUE(invoice_item_id, tax_id)
);

CREATE TABLE IF NOT EXISTS public.invoice_item_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id UUID REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  discount_id UUID REFERENCES public.discounts(id) ON DELETE CASCADE,
  UNIQUE(invoice_item_id, discount_id)
);

CREATE TABLE IF NOT EXISTS public.estimate_item_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_item_id UUID REFERENCES public.estimate_items(id) ON DELETE CASCADE,
  tax_id UUID REFERENCES public.taxes(id) ON DELETE CASCADE,
  UNIQUE(estimate_item_id, tax_id)
);

CREATE TABLE IF NOT EXISTS public.estimate_item_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_item_id UUID REFERENCES public.estimate_items(id) ON DELETE CASCADE,
  discount_id UUID REFERENCES public.discounts(id) ON DELETE CASCADE,
  UNIQUE(estimate_item_id, discount_id)
);

-- 4. VIEWS
CREATE OR REPLACE VIEW public.profiles_with_stats AS
SELECT 
    p.user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.created_at,
    w.invoice_remaining,
    w.estimate_remaining,
    w.ai_estimate_remaining,
    w.invoice_unlimited,
    w.estimate_unlimited,
    w.ai_estimate_unlimited,
    (SELECT COUNT(*) FROM public.invoices WHERE user_id = p.user_id) as total_invoices,
    (SELECT COUNT(*) FROM public.estimates WHERE user_id = p.user_id) as total_estimates,
    (SELECT COALESCE(SUM(total_amount), 0) FROM public.invoices WHERE user_id = p.user_id AND status = 'paid') as total_revenue
FROM public.profiles p
LEFT JOIN public.user_credit_wallets w ON p.user_id = w.user_id;

-- 5. RLS POLICIES
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_item_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_item_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_item_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_item_discounts ENABLE ROW LEVEL SECURITY;

-- Dynamic Policies
DO $$ BEGIN
  CREATE POLICY "Users manage own taxes" ON public.taxes FOR ALL USING (auth.uid() = user_id);
  CREATE POLICY "Users manage own discounts" ON public.discounts FOR ALL USING (auth.uid() = user_id);
  CREATE POLICY "Users manage own company profiles" ON public.company_profiles FOR ALL USING (auth.uid() = user_id);
  
  CREATE POLICY "Junction invoice taxes" ON public.invoice_item_taxes FOR ALL USING (EXISTS (SELECT 1 FROM public.invoice_items ii JOIN public.invoices i ON ii.invoice_id = i.id WHERE ii.id = invoice_item_id AND i.user_id = auth.uid()));
  CREATE POLICY "Junction invoice discounts" ON public.invoice_item_discounts FOR ALL USING (EXISTS (SELECT 1 FROM public.invoice_items ii JOIN public.invoices i ON ii.invoice_id = i.id WHERE ii.id = invoice_item_id AND i.user_id = auth.uid()));
  CREATE POLICY "Junction estimate taxes" ON public.estimate_item_taxes FOR ALL USING (EXISTS (SELECT 1 FROM public.estimate_items ei JOIN public.estimates e ON ei.estimate_id = e.id WHERE ei.id = estimate_item_id AND e.user_id = auth.uid()));
  CREATE POLICY "Junction estimate discounts" ON public.estimate_item_discounts FOR ALL USING (EXISTS (SELECT 1 FROM public.estimate_items ei JOIN public.estimates e ON ei.estimate_id = e.id WHERE ei.id = estimate_item_id AND e.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 6. TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user_company() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.company_profiles (user_id, company_name)
  VALUES (NEW.id, 'My Company');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_company ON auth.users;
CREATE TRIGGER on_auth_user_created_company AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_company();

NOTIFY pgrst, 'reload schema';
