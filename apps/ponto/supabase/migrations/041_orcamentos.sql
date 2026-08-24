-- ============================================================
-- 041_orcamentos.sql
-- Tabelas do gerador de orçamentos integrado ao CRM
-- ============================================================
-- Estrutura em 3 níveis:
--   orcamentos (cabeçalho)
--     └─ orcamento_opcoes (Opção 1, Opção 2...)
--          └─ orcamento_itens (linha de produto ou extra)
-- ============================================================

-- -----------------------------------------------------------
-- 1. orcamentos
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,

  -- identificação
  nome            TEXT    NOT NULL,  -- "1308.26 Orçamento de manutenção - Nexa"
  tipo_servico    TEXT    NOT NULL
                  CHECK (tipo_servico IN (
                    'venda', 'reforma', 'locacao',
                    'manut-rec', 'manut-pont', 'eventos', 'outros'
                  )),
  status          TEXT    NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado')),

  -- vínculo com o lead
  lead_id         UUID    REFERENCES public.leads(id) ON DELETE SET NULL,

  -- dados do cliente no momento da criação (snapshot independe de mudanças futuras no lead)
  dados_cliente   JSONB   NOT NULL DEFAULT '{}'::jsonb,

  -- condições comerciais
  forma_pagamento TEXT[]  NOT NULL DEFAULT ARRAY['boleto', 'pix'],
  validade_dias   INTEGER,
  observacoes     TEXT,

  -- controle
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orcamentos_lead_id_idx   ON public.orcamentos (lead_id);
CREATE INDEX IF NOT EXISTS orcamentos_status_idx    ON public.orcamentos (status);
CREATE INDEX IF NOT EXISTS orcamentos_criado_em_idx ON public.orcamentos (criado_em DESC);

-- -----------------------------------------------------------
-- 2. orcamento_opcoes
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_opcoes (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id   UUID    NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,

  numero_opcao   INTEGER NOT NULL DEFAULT 1,
  titulo         TEXT,
  descricao      TEXT,

  -- totais desnormalizados para relatórios rápidos (recalculados a cada save)
  total_unico    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_mensal   NUMERIC(10,2) NOT NULL DEFAULT 0,

  ordem          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS orcamento_opcoes_orcamento_id_idx ON public.orcamento_opcoes (orcamento_id);

-- -----------------------------------------------------------
-- 3. orcamento_itens
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  opcao_id          UUID    NOT NULL REFERENCES public.orcamento_opcoes(id) ON DELETE CASCADE,

  -- null = item digitado manualmente sem vínculo com catálogo
  catalogo_item_id  UUID    REFERENCES public.catalogo_itens(id) ON DELETE SET NULL,

  -- dados copiados do catálogo na inserção, editáveis depois
  nome              TEXT    NOT NULL,
  descricao         TEXT,
  foto_url          TEXT,

  -- 'produto' = planta/vaso | 'extra' = estacionamento, hora noturna etc.
  tipo              TEXT    NOT NULL DEFAULT 'produto'
                    CHECK (tipo IN ('produto', 'extra')),

  preco_unitario    NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantidade        INTEGER NOT NULL DEFAULT 1,
  unidade           TEXT    NOT NULL DEFAULT 'un',

  ordem             INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS orcamento_itens_opcao_id_idx ON public.orcamento_itens (opcao_id);

-- -----------------------------------------------------------
-- 4. trigger atualizado_em
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_orcamento_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orcamento_atualizado_em ON public.orcamentos;
CREATE TRIGGER trg_orcamento_atualizado_em
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_orcamento_atualizado_em();

-- -----------------------------------------------------------
-- 5. RLS — todos autenticados têm acesso total (Fase 2 refina permissões)
-- -----------------------------------------------------------
ALTER TABLE public.orcamentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_opcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamentos_acesso_autenticado"
  ON public.orcamentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "orcamento_opcoes_acesso_autenticado"
  ON public.orcamento_opcoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "orcamento_itens_acesso_autenticado"
  ON public.orcamento_itens FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.orcamentos       IS 'Cabeçalho de cada proposta comercial gerada pelo CRM.';
COMMENT ON TABLE public.orcamento_opcoes IS 'Opções dentro de um orçamento (Opção 1, Opção 2...).';
COMMENT ON TABLE public.orcamento_itens  IS 'Itens de linha de cada opção: produtos do catálogo ou extras avulsos.';
