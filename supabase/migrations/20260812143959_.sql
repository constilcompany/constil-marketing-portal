-- ============================================
-- ADICIONAR CAMPO purpose NA TABELA password_reset_otps
-- ============================================

-- 1. Adicionar coluna purpose
ALTER TABLE public.password_reset_otps 
ADD COLUMN IF NOT EXISTS purpose VARCHAR(50) DEFAULT 'generic';

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_purpose 
ON public.password_reset_otps (purpose);

-- 3. Criar índice composto para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_purpose 
ON public.password_reset_otps (email, purpose, used, expires_at);

-- 4. Verificar se a coluna foi adicionada
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'password_reset_otps' 
AND column_name = 'purpose';