-- 058_employees_ativo.sql
-- Desativar colaborador sem apagar o histórico de ponto.
-- DELETE em employees faz CASCADE em punch_records/justifications (histórico
-- trabalhista), então o CRM passa a desativar (ativo = false) em vez de apagar.
--
-- IMPORTANTE: aplicar esta migration ANTES de publicar o CRM/app Ponto que
-- filtra por `ativo`, senão as consultas falham por coluna inexistente.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.employees.ativo IS
  'false = colaborador desligado: some das listas e não consegue entrar no app Ponto, mas o histórico permanece.';
