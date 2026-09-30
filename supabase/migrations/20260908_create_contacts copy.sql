-- ============================================================
-- 1. CREATE ENUM TYPES
-- ============================================================

-- Tipo de origem do lead
CREATE TYPE lead_source AS ENUM (
  'website_contact',
  'landing_page',
  'social_media',
  'linkedin',
  'instagram',
  'facebook',
  'google_ads',
  'email_campaign',
  'referral',
  'event',
  'webinar',
  'partner',
  'organic_search',
  'direct'
);

-- Tipo de interesse
CREATE TYPE interest_type AS ENUM (
  'construction',
  'renovation',
  'design',
  'consulting',
  'project_management',
  'budget_estimate',
  'general_inquiry',
  'partnership',
  'career'
);

-- Status do lead
CREATE TYPE lead_status AS ENUM (
  'new',
  'pending',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'lost',
  'nurturing'
);

-- Orçamento estimado
CREATE TYPE budget_range AS ENUM (
  'under_50k',
  '50k_100k',
  '100k_250k',
  '250k_500k',
  '500k_1m',
  'over_1m',
  'not_specified'
);

-- ============================================================
-- 2. CREATE MAIN TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  -- Identificação
  id BIGSERIAL PRIMARY KEY,
  contact_id UUID DEFAULT gen_random_uuid() UNIQUE,
  
  -- Dados pessoais
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email TEXT NOT NULL,
  phone TEXT,
  alternative_phone TEXT,
  company_name TEXT,
  job_title TEXT,
  department TEXT,
  
  -- Dados demográficos
  country TEXT,
  state TEXT,
  city TEXT,
  postal_code TEXT,
  timezone TEXT,
  language TEXT DEFAULT 'pt-BR',
  gender TEXT,
  age_range TEXT CHECK (age_range IN ('18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'not_specified')),
  
  -- Dados do projeto
  project_type TEXT,
  project_description TEXT,
  project_size TEXT,
  project_location TEXT,
  project_timeline TEXT,
  estimated_start_date DATE,
  estimated_completion_date DATE,
  budget_range budget_range DEFAULT 'not_specified',
  budget_amount DECIMAL(15,2),
  budget_currency TEXT DEFAULT 'BRL',
  number_of_employees INT,
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '500+', 'not_specified')),
  
  -- Dados de marketing
  lead_source lead_source DEFAULT 'website_contact',
  source_medium TEXT,
  source_campaign TEXT,
  source_content TEXT,
  source_term TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  referral_url TEXT,
  landing_page_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  browser_name TEXT,
  operating_system TEXT,
  
  -- Dados de interesse
  interest_type interest_type[] DEFAULT '{general_inquiry}',
  service_interest TEXT[],
  message TEXT,
  message_length INT GENERATED ALWAYS AS (LENGTH(message)) STORED,
  priority_level TEXT CHECK (priority_level IN ('low', 'medium', 'high', 'urgent')),
  
  -- Status e acompanhamento
  status lead_status DEFAULT 'new',
  lead_score INT DEFAULT 0,
  lead_quality TEXT CHECK (lead_quality IN ('hot', 'warm', 'cold', 'not_qualified')),
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  internal_notes TEXT,
  
  -- Consenso de marketing
  marketing_consent BOOLEAN DEFAULT TRUE,
  consent_given_at TIMESTAMPTZ DEFAULT NOW(),
  email_opt_in BOOLEAN DEFAULT TRUE,
  sms_opt_in BOOLEAN DEFAULT FALSE,
  phone_opt_in BOOLEAN DEFAULT FALSE,
  unsubscribe_token TEXT,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribed_reason TEXT,
  
  -- Métricas de engajamento
  opened_emails INT DEFAULT 0,
  clicked_links INT DEFAULT 0,
  email_opens_count INT DEFAULT 0,
  total_visits INT DEFAULT 0,
  first_visit_at TIMESTAMPTZ,
  last_visit_at TIMESTAMPTZ,
  pages_viewed TEXT[] DEFAULT '{}',
  time_spent_on_site INT DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'form',
  last_updated_by TEXT
);

-- ============================================================
-- 3. CREATE INDEXES
-- ============================================================

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_full_name ON contacts(full_name);
CREATE INDEX idx_contacts_company ON contacts(company_name);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_lead_source ON contacts(lead_source);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX idx_contacts_country ON contacts(country);
CREATE INDEX idx_contacts_city ON contacts(city);
CREATE INDEX idx_contacts_budget_range ON contacts(budget_range);
CREATE INDEX idx_contacts_interest_type ON contacts(interest_type);
CREATE INDEX idx_contacts_tags ON contacts(tags);
CREATE INDEX idx_contacts_status_created ON contacts(status, created_at DESC);
CREATE INDEX idx_contacts_source_status ON contacts(lead_source, status);
CREATE INDEX idx_contacts_country_status ON contacts(country, status);
CREATE INDEX idx_contacts_utm_campaign ON contacts(utm_campaign);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at 
  BEFORE UPDATE ON contacts 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Trigger para calcular lead_score
CREATE OR REPLACE FUNCTION calculate_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  score INT = 0;
BEGIN
  IF NEW.company_name IS NOT NULL AND NEW.job_title IS NOT NULL THEN
    score := score + 10;
  END IF;
  
  IF NEW.phone IS NOT NULL THEN
    score := score + 15;
  END IF;
  
  IF NEW.budget_range != 'not_specified' THEN
    score := score + 10;
  END IF;
  
  IF 'construction' = ANY(NEW.interest_type) THEN
    score := score + 20;
  END IF;
  
  score := score + (coalesce(array_length(NEW.interest_type, 1), 0) * 5);
  
  IF NEW.marketing_consent = TRUE THEN
    score := score + 10;
  END IF;
  
  IF NEW.utm_campaign IS NOT NULL THEN
    score := score + 15;
  END IF;
  
  NEW.lead_score := LEAST(score, 100);
  
  IF NEW.lead_score >= 70 THEN
    NEW.lead_quality := 'hot';
  ELSIF NEW.lead_score >= 40 THEN
    NEW.lead_quality := 'warm';
  ELSIF NEW.lead_score >= 20 THEN
    NEW.lead_quality := 'cold';
  ELSE
    NEW.lead_quality := 'not_qualified';
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_lead_score_trigger
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE PROCEDURE calculate_lead_score();

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contacts" ON contacts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read contacts" ON contacts
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update contacts" ON contacts
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 6. FUNÇÕES AUXILIARES
-- ============================================================

CREATE OR REPLACE FUNCTION get_contacts_by_campaign(campaign_name TEXT)
RETURNS TABLE (
  id BIGINT,
  full_name TEXT,
  email TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ,
  lead_score INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.email,
    c.company_name,
    c.created_at,
    c.lead_score
  FROM contacts c
  WHERE c.utm_campaign = campaign_name
    OR c.source_campaign = campaign_name
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_lead_summary()
RETURNS TABLE (
  source lead_source,
  total_count BIGINT,
  hot_count BIGINT,
  warm_count BIGINT,
  converted_count BIGINT,
  avg_score INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.lead_source,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE c.lead_quality = 'hot') AS hot_count,
    COUNT(*) FILTER (WHERE c.lead_quality = 'warm') AS warm_count,
    COUNT(*) FILTER (WHERE c.status = 'converted') AS converted_count,
    AVG(c.lead_score)::INT AS avg_score
  FROM contacts c
  GROUP BY c.lead_source
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. DADOS DE EXEMPLO (CORRIGIDOS)
-- ============================================================

INSERT INTO contacts (
  first_name, last_name, email, phone, company_name, job_title,
  country, state, city, lead_source, interest_type, message,
  status, lead_quality, lead_score, marketing_consent
) VALUES 
  (
    'João', 'Silva', 'joao@empresa.com', '(11) 99999-9999', 
    'Construtora ABC', 'Gerente de Projetos',
    'Brasil', 'SP', 'São Paulo', 'website_contact', 
    '{construction,budget_estimate}',
    'Projeto de construção de 5000m²', 
    'qualified', 'hot', 85, true
  ),
  (
    'Maria', 'Santos', 'maria@empresa.com', '(11) 88888-8888', 
    'Arquitetura Moderna', 'Arquiteta Sênior',
    'Brasil', 'RJ', 'Rio de Janeiro', 'instagram', 
    '{design,renovation}',
    'Renovação completa de escritório', 
    'contacted', 'warm', 65, true
  ),
  (
    'Pedro', 'Costa', 'pedro@email.com', NULL, 
    NULL, NULL,
    'Brasil', 'MG', 'Belo Horizonte', 'google_ads', 
    '{general_inquiry}',
    'Gostaria de saber mais sobre os serviços', 
    'new', 'cold', 25, true
  );