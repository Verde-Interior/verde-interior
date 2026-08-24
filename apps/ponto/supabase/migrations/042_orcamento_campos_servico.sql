-- ============================================================
-- 042_orcamento_campos_servico.sql
-- Campos específicos por tipo de serviço e detalhes de vaso
-- ============================================================

-- dados estruturados por tipo de serviço (frequência, vasos, reposição, evento, etc.)
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS dados_servico JSONB NOT NULL DEFAULT '{}'::jsonb;

-- cor e tamanho do vaso por item (independente da foto do catálogo)
ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS cor_vaso    TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_vaso TEXT;

-- flag para distinguir proposta principal de opções adicionais
ALTER TABLE public.orcamento_opcoes
  ADD COLUMN IF NOT EXISTS is_principal BOOLEAN NOT NULL DEFAULT false;

-- a primeira opção de cada orçamento existente é a principal
UPDATE public.orcamento_opcoes
SET is_principal = true
WHERE numero_opcao = 1;

COMMENT ON COLUMN public.orcamentos.dados_servico IS
  'Campos específicos por tipo de serviço. Ex: manut-rec → {frequencia, vasosContemplados, comReposicao, limiteMensalReposicao, descontoLocalizacao}; eventos → {dataEntrega, horaEntrega, dataRetirada, horaRetirada, estacionamento, trabalhoNoturno}';

COMMENT ON COLUMN public.orcamento_itens.cor_vaso IS
  'Cor do vaso escolhida (ex: Preto Texturizado, Branco Mármore). Independe da foto do catálogo.';

COMMENT ON COLUMN public.orcamento_itens.tamanho_vaso IS
  'Tamanho/modelo do vaso (ex: Médio, Grande, Floreira, Trapézio).';

COMMENT ON COLUMN public.orcamento_opcoes.is_principal IS
  'true = proposta principal (itens que o cliente quer); false = opção adicional/sugestão.';
