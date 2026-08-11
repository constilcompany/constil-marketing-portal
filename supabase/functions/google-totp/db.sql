-- 1. Tabela para Google Authenticator (TOTP)
CREATE TABLE totp_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Tabela para OTP por Email
CREATE TABLE email_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'login', 'verification', 'password_reset', '2fa'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela para configurar método 2FA preferido
CREATE TABLE user_2fa_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  method TEXT DEFAULT 'email', -- 'email', 'totp', 'both'
  email_enabled BOOLEAN DEFAULT TRUE,
  totp_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índices
CREATE INDEX idx_email_otps_user_id ON email_otps(user_id);
CREATE INDEX idx_email_otps_email ON email_otps(email);
CREATE INDEX idx_email_otps_otp_code ON email_otps(otp_code);
CREATE INDEX idx_email_otps_expires_at ON email_otps(expires_at);
CREATE INDEX idx_totp_secrets_user_id ON totp_secrets(user_id);
CREATE INDEX idx_user_2fa_settings_user_id ON user_2fa_settings(user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_totp_secrets_updated_at
  BEFORE UPDATE ON totp_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_otps_updated_at
  BEFORE UPDATE ON email_otps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_2fa_settings_updated_at
  BEFORE UPDATE ON user_2fa_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  -- ============================================
-- TABELA PARA OTP DE REGISTRO
-- ============================================

CREATE TABLE IF NOT EXISTS public.registration_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  full_name TEXT,
  password TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_registration_otps_email ON public.registration_otps(email);
CREATE INDEX IF NOT EXISTS idx_registration_otps_otp_code ON public.registration_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_registration_otps_expires_at ON public.registration_otps(expires_at);

-- Trigger
DROP TRIGGER IF EXISTS update_registration_otps_updated_at ON public.registration_otps;
CREATE TRIGGER update_registration_otps_updated_at
  BEFORE UPDATE ON public.registration_otps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Permissões
GRANT ALL ON public.registration_otps TO anon, authenticated, service_role;

-- ============================================
-- 1. CRIAR A FUNÇÃO update_updated_at_column()
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. CRIAR A TABELA password_reset_otps
-- ============================================

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. CRIAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON public.password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_otp_code ON public.password_reset_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires_at ON public.password_reset_otps(expires_at);

-- ============================================
-- 4. CRIAR TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS update_password_reset_otps_updated_at ON public.password_reset_otps;
CREATE TRIGGER update_password_reset_otps_updated_at
  BEFORE UPDATE ON public.password_reset_otps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. PERMISSÕES
-- ============================================

GRANT ALL ON public.password_reset_otps TO anon, authenticated, service_role;

-- ============================================
-- 6. VERIFICAR SE TUDO FOI CRIADO CORRETAMENTE
-- ============================================

-- Verificar a função
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'update_updated_at_column';

-- Verificar a tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'password_reset_otps'
ORDER BY 
    ordinal_position;

-- Verificar o trigger
SELECT 
    tgname,
    tgrelid::regclass AS table_name,
    tgfoid::regproc AS function_name
FROM 
    pg_trigger 
WHERE 
    tgname = 'update_password_reset_otps_updated_at';

-- Verificar índices
SELECT 
    indexname,
    indexdef 
FROM 
    pg_indexes 
WHERE 
    tablename = 'password_reset_otps';

-- ============================================
-- CORRIGIR TABELA password_reset_otps
-- ============================================

-- 1. Criar a função se não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Adicionar a coluna 'attempts' (se não existir)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.password_reset_otps 
        ADD COLUMN attempts INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Coluna attempts adicionada';
    EXCEPTION
        WHEN duplicate_column THEN 
            RAISE NOTICE 'ℹ️ Coluna attempts já existe';
    END;
END $$;

-- 3. Adicionar a coluna 'used' (se não existir)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.password_reset_otps 
        ADD COLUMN used BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Coluna used adicionada';
    EXCEPTION
        WHEN duplicate_column THEN 
            RAISE NOTICE 'ℹ️ Coluna used já existe';
    END;
END $$;

-- 4. Adicionar a coluna 'updated_at' (se não existir)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.password_reset_otps 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ Coluna updated_at adicionada';
    EXCEPTION
        WHEN duplicate_column THEN 
            RAISE NOTICE 'ℹ️ Coluna updated_at já existe';
    END;
END $$;

-- 5. Criar índices
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON public.password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_otp_code ON public.password_reset_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires_at ON public.password_reset_otps(expires_at);

-- 6. Criar trigger
DROP TRIGGER IF EXISTS update_password_reset_otps_updated_at ON public.password_reset_otps;
CREATE TRIGGER update_password_reset_otps_updated_at
  BEFORE UPDATE ON public.password_reset_otps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Permissões
GRANT ALL ON public.password_reset_otps TO anon, authenticated, service_role;

-- 8. Verificar estrutura
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'password_reset_otps'
ORDER BY 
    ordinal_position;

-- Adicionar a coluna attempts
ALTER TABLE public.password_reset_otps 
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- Verificar se foi adicionada
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns 
WHERE 
    table_name = 'password_reset_otps' 
    AND column_name = 'attempts';