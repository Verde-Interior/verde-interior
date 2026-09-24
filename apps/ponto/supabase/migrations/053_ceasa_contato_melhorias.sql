-- ============================================================
-- 053_ceasa_contato_melhorias.sql
-- Contato flexível (telefones com rótulo, e-mail, preferência de canal)
-- + campos operacionais do pipeline (motivo de perda, follow-up, origem,
-- data da última mudança de etapa).
-- ============================================================

-- ── Telefones múltiplos com rótulo ──────────────────────────────────────
-- Substitui as colunas fixas telefone/whatsapp por uma lista:
-- [{ "numero": "(11) 9999-9999", "rotulo": "Principal", "whatsapp": true }]
ALTER TABLE public.ceasa_prospects
  ADD COLUMN IF NOT EXISTS telefones JSONB NOT NULL DEFAULT '[]';

-- Backfill a partir das colunas antigas, sem perder nenhum número já cadastrado.
UPDATE public.ceasa_prospects
SET telefones = (
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('numero', telefone, 'rotulo', 'Principal', 'whatsapp', FALSE) AS t
    WHERE telefone IS NOT NULL AND telefone <> ''
    UNION ALL
    SELECT jsonb_build_object('numero', whatsapp, 'rotulo', 'WhatsApp', 'whatsapp', TRUE) AS t
    WHERE whatsapp IS NOT NULL AND whatsapp <> ''
  ) sub
)
WHERE telefones = '[]';

ALTER TABLE public.ceasa_prospects
  DROP COLUMN IF EXISTS telefone,
  DROP COLUMN IF EXISTS whatsapp;

-- ── E-mail e preferência de contato ─────────────────────────────────────
ALTER TABLE public.ceasa_prospects
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS preferencia_contato TEXT
    CHECK (preferencia_contato IN ('telefone','whatsapp','email','presencial'));

-- ── Operacional: perda, follow-up, origem, última mudança de etapa ─────
ALTER TABLE public.ceasa_prospects
  ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
  ADD COLUMN IF NOT EXISTS proximo_followup_em DATE,
  ADD COLUMN IF NOT EXISTS proximo_followup_nota TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS etapa_atualizada_em TIMESTAMPTZ;

UPDATE public.ceasa_prospects
SET etapa_atualizada_em = created_at
WHERE etapa_atualizada_em IS NULL;

COMMENT ON COLUMN public.ceasa_prospects.telefones IS
  'Lista de contatos telefônicos: [{ numero, rotulo, whatsapp }]. Substitui as antigas colunas telefone/whatsapp.';
COMMENT ON COLUMN public.ceasa_prospects.motivo_perda IS
  'Preenchido quando etapa vira sem_interesse — para aprender por que o lead não avançou.';
COMMENT ON COLUMN public.ceasa_prospects.etapa_atualizada_em IS
  'Data/hora da última mudança de etapa. Usado para mostrar há quanto tempo o card está parado.';
