-- ============================================================
-- 025_estoque_v2_schema.sql
-- Estoque v2 — 4 abas (Plantas, Insumos, Vasos, Materiais)
-- Aplicado em: 23/07/2026
-- ============================================================
-- Modelo:
--  1. Plantas       → rastreamento patrimonial individual (QR)
--     Tabelas: estoque_especies, estoque_patrimonios,
--              estoque_eventos, estoque_manutencoes
--  2. Insumos/Vasos/Materiais → contagem simples com posse
--     Tabelas: estoque_itens, estoque_itens_movs
--
--  Ferramentas do modelo antigo migram pra estoque_itens
--  (categoria='material') mantendo controla_posse=true.
--
--  Event sourcing em estoque_eventos: nada é apagado.
-- ============================================================

-- ── 1. Espécies de plantas ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.estoque_especies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  nome_cientifico TEXT,
  categoria TEXT CHECK (categoria IN ('interna','locacao','evento','outro')),
  ativo BOOLEAN DEFAULT TRUE,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_especies_ativo
  ON public.estoque_especies (nome) WHERE ativo;

-- ── 2. Patrimônios (etiqueta QR física permanente) ────────────
CREATE TABLE IF NOT EXISTS public.estoque_patrimonios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_codigo TEXT NOT NULL UNIQUE,   -- ex: VI-0001, imutável
  especie_id UUID NOT NULL REFERENCES public.estoque_especies(id) ON DELETE RESTRICT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN (
    'disponivel','em_cliente','em_manutencao','descartado'
  )),
  localizacao_interna TEXT,          -- ex: "Estufa A, Prateleira 3"
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patrimonios_status
  ON public.estoque_patrimonios (status);
CREATE INDEX IF NOT EXISTS idx_patrimonios_especie
  ON public.estoque_patrimonios (especie_id);
CREATE INDEX IF NOT EXISTS idx_patrimonios_cliente
  ON public.estoque_patrimonios (cliente_id) WHERE cliente_id IS NOT NULL;

-- Sequência pra gerar VI-0001, VI-0002, ...
CREATE SEQUENCE IF NOT EXISTS public.patrimonio_qr_seq START 1;

CREATE OR REPLACE FUNCTION public.gerar_qr_codigo_patrimonio()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  v_num := nextval('public.patrimonio_qr_seq');
  RETURN 'VI-' || LPAD(v_num::TEXT, 4, '0');
END;
$$;

-- ── 3. Eventos (event sourcing — nada se apaga) ───────────────
CREATE TABLE IF NOT EXISTS public.estoque_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio_id UUID NOT NULL REFERENCES public.estoque_patrimonios(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'cadastro','entrada','saida','instalacao','retirada',
    'troca_especie','manutencao_inicio','manutencao_fim',
    'descarte','transferencia','observacao'
  )),
  funcionario_id INTEGER REFERENCES public.employees(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  especie_anterior_id UUID REFERENCES public.estoque_especies(id) ON DELETE SET NULL,
  especie_nova_id UUID REFERENCES public.estoque_especies(id) ON DELETE SET NULL,
  observacoes TEXT,
  foto_url TEXT,
  dados_extra JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_patrimonio_data
  ON public.estoque_eventos (patrimonio_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo
  ON public.estoque_eventos (tipo, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_cliente
  ON public.estoque_eventos (cliente_id) WHERE cliente_id IS NOT NULL;

-- ── 4. Manutenções em andamento ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.estoque_manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio_id UUID NOT NULL REFERENCES public.estoque_patrimonios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'rega_especial','troca_substrato','poda','tratamento_pragas','outro'
  )),
  motivo TEXT,
  funcionario_responsavel_id INTEGER REFERENCES public.employees(id) ON DELETE SET NULL,
  iniciada_em TIMESTAMPTZ DEFAULT NOW(),
  prevista_conclusao DATE,
  concluida_em TIMESTAMPTZ,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','concluida'))
);

CREATE INDEX IF NOT EXISTS idx_manutencoes_abertas
  ON public.estoque_manutencoes (patrimonio_id) WHERE status = 'aberta';

-- ── 5. Itens simples (Insumos, Vasos, Materiais) ──────────────
CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL CHECK (categoria IN ('insumo','vaso','material')),
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL CHECK (unidade IN (
    'un','kg','L','m','saco','frasco','rolo'
  )),
  sku TEXT,
  descricao TEXT,
  foto_url TEXT,
  estoque_minimo NUMERIC(10,3) DEFAULT 0,
  controla_posse BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itens_cat_ativo
  ON public.estoque_itens (categoria, nome) WHERE ativo;

-- ── 6. Movimentações dos itens simples ────────────────────────
CREATE TABLE IF NOT EXISTS public.estoque_itens_movs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.estoque_itens(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'entrada','saida','ajuste','perda','transferencia'
  )),
  quantidade NUMERIC(10,3) NOT NULL CHECK (quantidade > 0),
  titular_id INTEGER REFERENCES public.employees(id),
  titular_destino_id INTEGER REFERENCES public.employees(id),
  motivo TEXT,
  agenda_id UUID REFERENCES public.agenda(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  criado_por TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ck_itens_transf_destino CHECK (
    tipo <> 'transferencia' OR titular_destino_id IS NOT NULL
  ),
  CONSTRAINT ck_itens_transf_diff CHECK (
    tipo <> 'transferencia' OR titular_id IS DISTINCT FROM titular_destino_id
  )
);

CREATE INDEX IF NOT EXISTS idx_itens_movs_item_data
  ON public.estoque_itens_movs (item_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_itens_movs_titular
  ON public.estoque_itens_movs (titular_id) WHERE titular_id IS NOT NULL;

-- ── 7. Views ──────────────────────────────────────────────────
-- Saldo por (item, titular)
CREATE OR REPLACE VIEW public.estoque_itens_saldo_titular AS
WITH movs AS (
  SELECT item_id, titular_id AS titular, quantidade AS delta
  FROM public.estoque_itens_movs WHERE tipo IN ('entrada','ajuste')
  UNION ALL
  SELECT item_id, titular_id, -quantidade
  FROM public.estoque_itens_movs WHERE tipo IN ('saida','perda')
  UNION ALL
  SELECT item_id, titular_id, -quantidade
  FROM public.estoque_itens_movs WHERE tipo = 'transferencia'
  UNION ALL
  SELECT item_id, titular_destino_id AS titular, quantidade
  FROM public.estoque_itens_movs WHERE tipo = 'transferencia'
)
SELECT item_id, titular, SUM(delta) AS saldo
FROM movs
GROUP BY item_id, titular;

-- Saldo total por item (com breakdown estoque × colaboradores)
CREATE OR REPLACE VIEW public.estoque_itens_saldo_total AS
SELECT
  i.id AS item_id,
  i.categoria, i.nome, i.unidade, i.sku, i.descricao, i.foto_url,
  i.estoque_minimo, i.controla_posse, i.ativo,
  COALESCE(SUM(s.saldo), 0) AS saldo_total,
  COALESCE(SUM(CASE WHEN s.titular IS NULL THEN s.saldo ELSE 0 END), 0) AS saldo_estoque,
  COALESCE(SUM(CASE WHEN s.titular IS NOT NULL THEN s.saldo ELSE 0 END), 0) AS saldo_com_colabs,
  (SELECT MAX(criado_em) FROM public.estoque_itens_movs WHERE item_id = i.id) AS ultima_mov
FROM public.estoque_itens i
LEFT JOIN public.estoque_itens_saldo_titular s ON s.item_id = i.id
WHERE i.ativo
GROUP BY i.id;

-- Patrimônios com contexto (última manutenção, dias no cliente, etc)
CREATE OR REPLACE VIEW public.estoque_patrimonios_view AS
SELECT
  p.id, p.qr_codigo, p.status, p.localizacao_interna, p.observacoes,
  p.criado_em, p.atualizado_em,
  p.especie_id, e.nome AS especie_nome, e.categoria AS especie_categoria,
  p.cliente_id, c.nome_empresa AS cliente_nome,
  (
    SELECT ev.criado_em FROM public.estoque_eventos ev
    WHERE ev.patrimonio_id = p.id AND ev.tipo = 'instalacao'
    ORDER BY ev.criado_em DESC LIMIT 1
  ) AS instalado_em,
  (
    SELECT m.id FROM public.estoque_manutencoes m
    WHERE m.patrimonio_id = p.id AND m.status = 'aberta'
    ORDER BY m.iniciada_em DESC LIMIT 1
  ) AS manutencao_aberta_id
FROM public.estoque_patrimonios p
JOIN public.estoque_especies e ON e.id = p.especie_id
LEFT JOIN public.clientes c ON c.id = p.cliente_id;

-- Resumo por espécie (KPI dashboard)
CREATE OR REPLACE VIEW public.estoque_especies_resumo AS
SELECT
  e.id AS especie_id, e.nome, e.categoria,
  COUNT(p.id) FILTER (WHERE p.status <> 'descartado') AS total_ativos,
  COUNT(p.id) FILTER (WHERE p.status = 'disponivel') AS disponiveis,
  COUNT(p.id) FILTER (WHERE p.status = 'em_cliente') AS em_cliente,
  COUNT(p.id) FILTER (WHERE p.status = 'em_manutencao') AS em_manutencao,
  COUNT(p.id) FILTER (WHERE p.status = 'descartado') AS descartados
FROM public.estoque_especies e
LEFT JOIN public.estoque_patrimonios p ON p.especie_id = e.id
WHERE e.ativo
GROUP BY e.id;

-- ── 8. Trigger: mantém atualizado_em em patrimonios ───────────
CREATE OR REPLACE FUNCTION public.trg_patrimonio_atualiza_ts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patrimonio_atualizado_em ON public.estoque_patrimonios;
CREATE TRIGGER trg_patrimonio_atualizado_em
  BEFORE UPDATE ON public.estoque_patrimonios
  FOR EACH ROW EXECUTE FUNCTION public.trg_patrimonio_atualiza_ts();

-- ── 9. RLS ────────────────────────────────────────────────────
ALTER TABLE public.estoque_especies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_patrimonios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_eventos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_manutencoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_itens_movs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "especies_auth_all"    ON public.estoque_especies;
DROP POLICY IF EXISTS "patrimonios_auth_all" ON public.estoque_patrimonios;
DROP POLICY IF EXISTS "eventos_auth_all"     ON public.estoque_eventos;
DROP POLICY IF EXISTS "manutencoes_auth_all" ON public.estoque_manutencoes;
DROP POLICY IF EXISTS "itens_auth_all"       ON public.estoque_itens;
DROP POLICY IF EXISTS "itens_movs_auth_all"  ON public.estoque_itens_movs;

CREATE POLICY "especies_auth_all"    ON public.estoque_especies    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "patrimonios_auth_all" ON public.estoque_patrimonios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "eventos_auth_all"     ON public.estoque_eventos     FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "manutencoes_auth_all" ON public.estoque_manutencoes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "itens_auth_all"       ON public.estoque_itens       FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "itens_movs_auth_all"  ON public.estoque_itens_movs  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
