-- ============================================================
-- 036_agenda_status_faltou.sql
-- Adiciona status 'faltou' em agenda.status
-- ============================================================
-- Motivo:
--   Gestor precisa marcar manualmente quando um colaborador não
--   compareceu numa visita já publicada, distinguindo isso de
--   'cancelado' (visita cancelada pelo gestor, não é falta do
--   colaborador). Faz parte do fluxo de detecção de falta —
--   Dashboard/Escala sinalizam atraso/possível falta a partir de
--   hora_estimada_chegada sem check-in; este status é a
--   confirmação manual feita pelo gestor a partir desse sinal.
-- ============================================================

ALTER TABLE public.agenda
  DROP CONSTRAINT IF EXISTS agenda_status_check;

ALTER TABLE public.agenda
  ADD CONSTRAINT agenda_status_check
  CHECK (status IN (
    'rascunho',
    'publicado',
    'em_execucao',
    'concluido',
    'cancelado',
    'faltou'
  ));
