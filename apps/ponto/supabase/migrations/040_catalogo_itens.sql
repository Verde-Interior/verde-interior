-- ============================================================
-- 040_catalogo_itens.sql
-- Catálogo de itens para o gerador de orçamentos
-- ============================================================
-- Contexto: o gerador de orçamentos passa a viver dentro do CRM.
-- Esta tabela armazena plantas, vasos e extras disponíveis para
-- seleção rápida no momento de montar um orçamento, eliminando
-- digitação manual e busca de fotos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.catalogo_itens (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo             TEXT    NOT NULL CHECK (tipo IN ('planta', 'vaso', 'extra')),
  categoria        TEXT    NOT NULL CHECK (categoria IN ('escritorio', 'eventos', 'geral')),
  nome             TEXT    NOT NULL,
  nome_cientifico  TEXT,
  foto_url         TEXT,
  preco_referencia NUMERIC(10,2),
  descricao        TEXT,
  -- campos específicos de plantas
  luz              TEXT,
  rega_frequencia  TEXT,
  rega_volume      TEXT,
  altura_cm        TEXT,
  -- controle
  ativo            BOOLEAN NOT NULL DEFAULT true,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- índices de uso frequente
CREATE INDEX IF NOT EXISTS catalogo_itens_tipo_idx      ON public.catalogo_itens (tipo);
CREATE INDEX IF NOT EXISTS catalogo_itens_categoria_idx ON public.catalogo_itens (categoria);
CREATE INDEX IF NOT EXISTS catalogo_itens_ativo_idx     ON public.catalogo_itens (ativo);

-- trigger para manter atualizado_em
CREATE OR REPLACE FUNCTION public.set_catalogo_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalogo_atualizado_em ON public.catalogo_itens;
CREATE TRIGGER trg_catalogo_atualizado_em
  BEFORE UPDATE ON public.catalogo_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_catalogo_atualizado_em();

-- RLS: todos os usuários autenticados leem; apenas service_role escreve via seed/admin
ALTER TABLE public.catalogo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_leitura_autenticado"
  ON public.catalogo_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "catalogo_escrita_autenticado"
  ON public.catalogo_itens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.catalogo_itens IS
  'Catálogo de plantas, vasos e extras disponíveis para seleção no gerador de orçamentos.';
