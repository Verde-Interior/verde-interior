-- ============================================================
-- 014_agenda_tipos_tarefa.sql
-- Módulo Escala — tipos de tarefa multi-select por visita
-- Aplicado em: 15/07/2026
-- ============================================================
-- Adiciona coluna array para o gestor marcar 1..N tipos de
-- tarefa na visita (Manutenção, Troca, Reforma, Evento, Outro).
-- O texto de instrução em observacoes_gestor é gerado a partir
-- desses tipos mas permanece editável.
-- ============================================================

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS tipos_tarefa TEXT[] DEFAULT '{}'::TEXT[];

-- Restringe aos valores válidos (5 tipos previstos hoje)
ALTER TABLE public.agenda
  DROP CONSTRAINT IF EXISTS ck_agenda_tipos_tarefa_valores;

ALTER TABLE public.agenda
  ADD CONSTRAINT ck_agenda_tipos_tarefa_valores
  CHECK (
    tipos_tarefa IS NULL
    OR tipos_tarefa <@ ARRAY['manutencao','troca','reforma','evento','outro']::TEXT[]
  );

-- Comentário de documentação
COMMENT ON COLUMN public.agenda.tipos_tarefa IS
  'Tipos de tarefa selecionados pelo gestor (multi-select). Valores possíveis: manutencao, troca, reforma, evento, outro. O texto legível fica em observacoes_gestor.';
