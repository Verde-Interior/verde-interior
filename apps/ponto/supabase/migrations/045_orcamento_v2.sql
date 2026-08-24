-- ============================================================
-- 045_orcamento_v2.sql
-- Multi-modelo, numeração ORC-NNN, desconto, título auto,
-- origem, galeria de fotos, templates de serviço.
-- ============================================================

-- ── 1. Multi-modelo por orçamento ────────────────────────────
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS tipos_servico TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: cada orçamento existente vira array de 1 elemento
UPDATE public.orcamentos
SET tipos_servico = ARRAY[tipo_servico]
WHERE tipos_servico = ARRAY[]::TEXT[]
  AND tipo_servico IS NOT NULL;

-- Categoria por seção (decisão: categoria fica na seção, não por item)
ALTER TABLE public.orcamento_opcoes
  ADD COLUMN IF NOT EXISTS categoria_servico TEXT
  CHECK (categoria_servico IS NULL OR categoria_servico IN
    ('venda','reforma','locacao','manut-rec','manut-pont','eventos','outros'));

-- Backfill: seção existente herda tipo do orçamento pai
UPDATE public.orcamento_opcoes o
SET categoria_servico = orc.tipo_servico
FROM public.orcamentos orc
WHERE o.orcamento_id = orc.id
  AND o.categoria_servico IS NULL
  AND orc.tipo_servico IS NOT NULL;

-- ── 2. Numeração ORC-NNN (só ao enviar) ──────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_orc_numero START 1;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS numero_orc TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.gerar_numero_orc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'enviado'
     AND (OLD.status IS DISTINCT FROM 'enviado')
     AND NEW.numero_orc IS NULL THEN
    NEW.numero_orc := 'ORC-' || LPAD(nextval('public.seq_orc_numero')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_numero_orc ON public.orcamentos;
CREATE TRIGGER trg_gerar_numero_orc
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_orc();

-- ── 3. Desconto percentual global ───────────────────────────
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS desconto_pct NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (desconto_pct >= 0 AND desconto_pct <= 100);

-- ── 4. Origem do orçamento ───────────────────────────────────
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS origem_orcamento TEXT
  CHECK (origem_orcamento IS NULL OR origem_orcamento IN
    ('Indicação','Google Ads','LinkedIn','Instagram','Prospecção ativa','Site','Evento','Outro'));

-- ── 5. Título editável do documento ─────────────────────────
-- NULL = usar gerarTituloAutomatico(tiposServico) no front
-- string = customizado pelo usuário
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS titulo_documento TEXT;

-- ── 6. Galeria de fotos (página 2 no PDF) ───────────────────
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS galeria_fotos JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Formato: [{ foto_url: string, legenda: string, referencia: string }, ...]

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS galeria_config JSONB NOT NULL DEFAULT
    '{"colunas": 2, "altura": 200}'::jsonb;

-- ── 7. Templates de serviço editáveis pela UI ───────────────
CREATE TABLE IF NOT EXISTS public.orcamento_templates_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_servico TEXT NOT NULL UNIQUE
    CHECK (tipo_servico IN ('venda','reforma','locacao','manut-rec','manut-pont','eventos','outros')),
  descricoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed com descrições padrão (7 tipos)
INSERT INTO public.orcamento_templates_servico (tipo_servico, descricoes) VALUES
  ('venda', '[
    "Fornecimento e instalação das espécies ornamentais selecionadas",
    "Vasos com manta de bidim, argila expandida e casca de pinus polida",
    "Substratos, vitaminas e aminoácidos para desenvolvimento das espécies",
    "Prato coletor de água incluso em todos os vasos de chão",
    "Aplicação de fertilizantes e estabilizantes nas plantas",
    "Frete e instalação inclusos"
  ]'::jsonb),
  ('reforma', '[
    "Remoção das espécies antigas e do substrato",
    "Preenchimento interno com manta de bidim e argila expandida",
    "Instalação das novas espécies em potes individuais para cada muda",
    "Utilização do vaso do cliente como cachepô (não será plantado)",
    "Forração e acabamento com casca de pinus polida e tratada",
    "Frete e mão de obra inclusos"
  ]'::jsonb),
  ('locacao', '[
    "Locação de vasos e plantas ornamentais em regime mensal",
    "Manutenção recorrente inclusa (rega, poda, adubação, limpeza)",
    "Reposição ilimitada de espécies em caso de morte ou dano",
    "Retirada dos vasos ao final do contrato sem custo adicional",
    "Frete inclusos"
  ]'::jsonb),
  ('manut-rec', '[
    "Visitas técnicas recorrentes conforme frequência contratada",
    "Rega, poda e limpeza das folhagens",
    "Adubação e aplicação de fertilizantes",
    "Verificação de pragas e doenças, com tratamento fitossanitário",
    "Substituição do substrato quando necessário",
    "Aplicação de vitaminas e aminoácidos",
    "Relatório fotográfico das visitas",
    "Comunicação direta com responsável do cliente",
    "Frete e mão de obra inclusos"
  ]'::jsonb),
  ('manut-pont', '[
    "Visita técnica única para diagnóstico e cuidado das plantas",
    "Rega, poda, limpeza e adubação",
    "Aplicação de fertilizantes e vitaminas",
    "Verificação e tratamento fitossanitário",
    "Relatório fotográfico da visita",
    "Frete inclusos"
  ]'::jsonb),
  ('eventos', '[
    "Locação de vasos e plantas ornamentais para o período do evento",
    "Entrega, montagem no local e retirada ao final",
    "Frete de entrega e retirada inclusos",
    "Suporte durante o evento (mediante contratação)"
  ]'::jsonb),
  ('outros', '[]'::jsonb)
ON CONFLICT (tipo_servico) DO NOTHING;

-- ── 8. Trigger de atualização dos templates ─────────────────
CREATE OR REPLACE FUNCTION public.tocar_atualizado_em_templates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tocar_templates ON public.orcamento_templates_servico;
CREATE TRIGGER trg_tocar_templates
BEFORE UPDATE ON public.orcamento_templates_servico
FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em_templates();
