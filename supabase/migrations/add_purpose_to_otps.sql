-- ============================================
-- MIGRAÇÃO: password_reset_otps + purpose
-- Para User-API Proposta
-- ============================================

-- 1. Adicionar coluna purpose
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'password_reset_otps' 
    AND column_name = 'purpose'
  ) THEN
    ALTER TABLE public.password_reset_otps 
    ADD COLUMN purpose VARCHAR(50) DEFAULT 'generic';
  END IF;
END $$;

-- 2. Adicionar índices
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_purpose 
ON public.password_reset_otps (purpose);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_purpose 
ON public.password_reset_otps (email, purpose, used, expires_at);

-- 3. Atualizar registros existentes (opcional)
-- Marca os OTPs antigos como 'generic' se não tiverem purpose
UPDATE public.password_reset_otps 
SET purpose = 'generic' 
WHERE purpose IS NULL;

-- 4. Verificar migração
SELECT 
  '✅ Migração concluída!' as status,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN purpose = 'signup' THEN 1 END) as signup_otps,
  COUNT(CASE WHEN purpose = 'password_reset' THEN 1 END) as password_reset_otps,
  COUNT(CASE WHEN purpose = 'generic' THEN 1 END) as generic_otps
FROM public.password_reset_otps;