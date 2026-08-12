-- ============================================================
-- 039_clientes_dias_bloqueados.sql
-- Adiciona dias da semana NÃO autorizados por cliente
-- ============================================================
-- Diferente de dias_disponiveis (lista de dias em que o cliente
-- normalmente recebe visita — vazio = sem restrição de rotina),
-- este é um conjunto de dias PROIBIDOS (ex: condomínio não libera
-- entrada às segundas). A Escala bloqueia (com opção de forçar) o
-- agendamento de uma visita cuja data caia em um desses dias,
-- mesmo que dias_disponiveis esteja vazio.
-- ============================================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS dias_bloqueados TEXT[] DEFAULT '{}';
