-- 032_leads_data_aprovacao.sql
-- Adiciona data_aprovacao em leads: grava quando o lead entra em
-- orcamento_aprovado, para métricas de "fechado no mês" (ex: Eventos
-- Confirmados, Ticket Médio) usarem a data de fechamento, não a de entrada.
--
-- Leads já aprovados antes desta migration ficam com data_aprovacao NULL —
-- não há como recuperar essa data com confiança dos dados atuais.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS data_aprovacao DATE;

COMMENT ON COLUMN public.leads.data_aprovacao IS
  'Data em que o lead entrou em orcamento_aprovado. Usado para métricas de "fechado no mês" (ex: Eventos Confirmados, Ticket Médio).';
