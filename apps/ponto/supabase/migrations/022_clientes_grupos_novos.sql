-- 022_clientes_grupos_novos.sql
-- Renomeia grupo_servico dos clientes para nomenclatura nova:
--   Locação · Manutenção · Manutenção com troca · Somente orquídea
--
-- Adiciona coluna tem_orquidea BOOLEAN pra rastrear (independente do grupo)
-- quais clientes têm orquídea — usada tanto pro filtro na aba Clientes
-- quanto pro time de campo saber onde tem orquídea.

-- ── 1. Coluna tem_orquidea ─────────────────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tem_orquidea BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.clientes.tem_orquidea IS
  'Cliente possui orquídeas (independente do grupo de serviço). Usado para filtro na aba Clientes.';

-- ── 2. Migra valores antigos dos grupos ────────────────────────
-- 'Grupo 1 - troca + orquidea' → Manutenção com troca + orquídea
UPDATE public.clientes
   SET grupo_servico = 'Manutenção com troca',
       tem_orquidea  = TRUE
 WHERE grupo_servico = 'Grupo 1 - troca + orquidea';

-- 'Grupo 2 - troca' → Manutenção com troca
UPDATE public.clientes
   SET grupo_servico = 'Manutenção com troca'
 WHERE grupo_servico = 'Grupo 2 - troca';

-- 'Grupo 3 - sem troca' → Manutenção
UPDATE public.clientes
   SET grupo_servico = 'Manutenção'
 WHERE grupo_servico = 'Grupo 3 - sem troca';

-- 'Grupo 4 - Flores' fica como está (usuário não pediu renomeação).
