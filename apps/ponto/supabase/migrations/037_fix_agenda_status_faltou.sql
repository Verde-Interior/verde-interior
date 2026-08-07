-- ============================================================
-- 037_fix_agenda_status_faltou.sql
-- Corrige 036: a constraint real em produção se chama
-- 'agendamentos_status_check' (não 'agenda_status_check' como a
-- migration 036 assumiu — provável sobra de quando a tabela tinha
-- outro nome). A 036 não conseguiu dropar a constraint antiga, só
-- adicionou uma nova; como as duas coexistiam, a antiga (sem
-- 'faltou') continuava barrando o INSERT/UPDATE.
-- ============================================================

ALTER TABLE public.agenda
  DROP CONSTRAINT IF EXISTS agendamentos_status_check;

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
