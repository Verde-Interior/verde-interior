-- 033_ceasa_valor_fechamento.sql
-- Adiciona valor_venda e fechado_em em ceasa_prospects, para viabilizar as
-- metas mensais de "Valor Vendido" e "Negócios Fechados" no Ceasa/Holambra.
-- Sem fechado_em não dá pra saber se um prospect fechou neste mês ou há
-- meses atrás — mesmo problema já resolvido em leads com data_aprovacao.

ALTER TABLE public.ceasa_prospects
  ADD COLUMN IF NOT EXISTS valor_venda NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fechado_em DATE;

COMMENT ON COLUMN public.ceasa_prospects.valor_venda IS
  'Valor da venda fechada com a loja. Preenchido ao marcar etapa como "fechado". Usado na meta de valor vendido no mês.';
COMMENT ON COLUMN public.ceasa_prospects.fechado_em IS
  'Data em que o prospect entrou em etapa "fechado". Usado para calcular metas mensais (valor vendido / negócios fechados no mês).';
