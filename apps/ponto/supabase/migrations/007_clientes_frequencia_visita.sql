-- ============================================================
-- 007_clientes_frequencia_visita.sql
-- Adiciona coluna frequencia_visita à tabela clientes
-- Aplicado em: 06/07/2026
-- ============================================================
-- Campo usado para rastrear com que frequência o cliente
-- deve ser visitado (semanal / quinzenal / mensal).
-- Utilizado futuramente na detecção de cotas mensais e
-- na lógica de prioridade quando um funcionário falta.
-- ============================================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS frequencia_visita TEXT
    CHECK (frequencia_visita IN ('semanal', 'quinzenal', 'mensal'));
