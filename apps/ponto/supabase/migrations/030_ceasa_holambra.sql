-- ============================================================
-- 030_ceasa_holambra.sql
-- Prospecção Ceasa / Holambra
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ceasa_prospects (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_loja           TEXT         NOT NULL,
  responsavel         TEXT,
  telefone            TEXT,
  whatsapp            TEXT,
  tipo                TEXT         CHECK (tipo IN ('atacadista','varejista','floricultura','outros')),
  produtos_interesse  TEXT,
  observacoes         TEXT,
  endereco            TEXT,
  etapa               TEXT         NOT NULL DEFAULT 'prospecto'
                        CHECK (etapa IN ('prospecto','contato_feito','interesse','proposta_enviada','fechado','sem_interesse')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ceasa_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ceasa_auth_all"
  ON public.ceasa_prospects FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_ceasa_etapa ON public.ceasa_prospects(etapa);
