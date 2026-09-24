-- ============================================================
-- 055_ceasa_tipo_escritorio.sql
-- Adiciona "escritorio" aos tipos de loja do pipeline Ceasa/Holambra —
-- segmento novo de prospecção (contrato de paisagismo corporativo), não
-- coberto pelos tipos seedados em 052_ceasa_tipos_loja.sql.
-- ============================================================

INSERT INTO public.ceasa_tipos_loja (nome) VALUES
  ('escritorio')
ON CONFLICT (nome) DO NOTHING;
