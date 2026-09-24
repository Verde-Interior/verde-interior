-- ============================================================
-- 052_ceasa_tipos_loja.sql
-- Tipos de loja do pipeline Ceasa/Holambra deixam de ser um CHECK fixo
-- e viram uma tabela de referência editável pela própria tela (permite
-- "+ Adicionar tipo" sem precisar de migration a cada novo segmento).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ceasa_tipos_loja (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT         NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ceasa_tipos_loja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ceasa_tipos_loja_auth_all"
  ON public.ceasa_tipos_loja FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

-- Nomes em minúsculo e sem acento, mesma convenção já usada nos valores
-- existentes de ceasa_prospects.tipo ('atacadista', 'floricultura'...).
-- A UI capitaliza para exibição (ex: 'atacadista' -> 'Atacadista').
INSERT INTO public.ceasa_tipos_loja (nome) VALUES
  ('atacadista'), ('varejista'), ('floricultura'), ('hospital'),
  ('clinica'), ('restaurante'), ('hotel'), ('escola'), ('outros')
ON CONFLICT (nome) DO NOTHING;

-- tipo passa a ser texto livre, validado pela UI contra ceasa_tipos_loja
ALTER TABLE public.ceasa_prospects DROP CONSTRAINT IF EXISTS ceasa_prospects_tipo_check;
