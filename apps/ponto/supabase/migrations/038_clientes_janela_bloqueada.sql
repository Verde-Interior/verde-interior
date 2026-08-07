-- ============================================================
-- 038_clientes_janela_bloqueada.sql
-- Adiciona faixa de horário NÃO permitida por cliente
-- ============================================================
-- Diferente de janela_entrada_inicio/fim (que definem a janela
-- PERMITIDA de chegada), este é um intervalo PROIBIDO dentro do dia
-- (ex: horário de almoço do cliente, 12:00-13:00). A Escala bloqueia
-- (com opção de forçar) o agendamento de uma visita cuja hora
-- estimada de chegada caia dentro desse intervalo.
-- ============================================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS janela_bloqueada_inicio TIME,
  ADD COLUMN IF NOT EXISTS janela_bloqueada_fim    TIME;
