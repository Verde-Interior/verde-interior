-- ============================================================
-- 044_modelo_vaso.sql
-- Modelo de vaso (cônico / floreira / bowl / outro) para
-- filtrar opções de cor no editor de orçamento.
-- ============================================================

ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS modelo_vaso TEXT;

COMMENT ON COLUMN public.orcamento_itens.modelo_vaso IS
  '''Cônico'' | ''Floreira'' | ''Bowl/Bacia'' | ''Outro'' — define as cores disponíveis no editor de orçamento.';
