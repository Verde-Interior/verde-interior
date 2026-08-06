-- 035_clientes_regiao_ajustes.sql
-- Fecha os 2 bairros que sobraram sem região depois da 034:
--   "Centro Histórico de São Paulo" (Boa Vista Investimentos, Pacaembu
--   Serviços) — parte do Centro, só não estava na lista de nomes.
--   "Barcelona" (Tito) — bairro real, mas em São Caetano do Sul (ABC),
--   confirmado via geocodificação, não é bairro de São Paulo capital.
--
-- Uso: cole no Supabase SQL Editor e execute.

BEGIN;

UPDATE public.clientes SET regiao = 'Centro'
 WHERE regiao IS NULL
   AND lower(bairro) = 'centro histórico de são paulo';

UPDATE public.clientes SET regiao = 'Grande São Paulo'
 WHERE regiao IS NULL
   AND lower(bairro) = 'barcelona';

COMMIT;

-- Confirma que não sobrou mais nada sem região
SELECT bairro, count(*) AS clientes_sem_regiao
  FROM public.clientes
 WHERE ativo = TRUE AND bairro IS NOT NULL AND trim(bairro) <> '' AND regiao IS NULL
 GROUP BY bairro
 ORDER BY clientes_sem_regiao DESC;
