-- ============================================================
-- 008_storage_paths.sql
-- Colunas de storage_path para gerenciar arquivos no Storage
-- Aplicado em: 06/07/2026
-- ============================================================
-- Fase 3 — Execução (funcionário no App Ponto):
-- - fotos_relatorio.storage_path: caminho no bucket para poder
--   deletar ou regerar signed URLs quando expirarem.
-- - relatorios.assinatura_storage_path: idem para o PNG da
--   assinatura do responsável.
-- ============================================================

ALTER TABLE public.fotos_relatorio
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE public.relatorios
  ADD COLUMN IF NOT EXISTS assinatura_storage_path TEXT;
