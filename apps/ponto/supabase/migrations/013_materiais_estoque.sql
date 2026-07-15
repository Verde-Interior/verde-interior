-- ============================================================
-- 013_materiais_estoque.sql
-- Módulo 08 — Estoque e Contabilidade de Materiais
-- Aplicado em: 14/07/2026
-- ============================================================
-- Duas tabelas + uma view. Suporta materiais de consumo (giram
-- para o cliente) e ferramentas (ficam com colaboradores).
-- Ver plano completo em:
--   docs/Verde Interior/08 - Estoque e Materiais/
--   ARQUIVO 08 Estoque e Materiais — Roadmap.md
-- ============================================================

-- ── Catálogo de materiais ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'vaso','planta','cobertura','substrato','adubo','ferramenta','outro'
  )),
  unidade TEXT NOT NULL CHECK (unidade IN (
    'un','kg','L','m','saco','frasco','rolo'
  )),
  sku TEXT,
  descricao TEXT,
  foto_url TEXT,
  estoque_minimo NUMERIC(10,3) DEFAULT 0,
  controla_posse BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materiais_categoria
  ON public.materiais (categoria) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_materiais_nome_ativo
  ON public.materiais (nome) WHERE ativo;

-- ── Movimentações (livro razão) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'entrada','saida','ajuste','perda','transferencia'
  )),
  quantidade NUMERIC(10,3) NOT NULL CHECK (quantidade > 0),

  -- Titularidade (NULL = estoque)
  titular_id INTEGER REFERENCES public.employees(id),
  titular_destino_id INTEGER REFERENCES public.employees(id),

  motivo TEXT,
  agenda_id UUID REFERENCES public.agenda(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  criado_por TEXT,
  data TIMESTAMPTZ DEFAULT NOW(),
  observacao TEXT,

  -- Sanity check: transferência precisa ter destino
  CONSTRAINT ck_transferencia_destino CHECK (
    tipo <> 'transferencia' OR titular_destino_id IS NOT NULL
  ),
  -- Origem e destino não podem ser iguais numa transferência
  CONSTRAINT ck_transferencia_diff CHECK (
    tipo <> 'transferencia' OR titular_id IS DISTINCT FROM titular_destino_id
  )
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_material_data
  ON public.estoque_movimentacoes (material_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_agenda
  ON public.estoque_movimentacoes (agenda_id) WHERE agenda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estoque_mov_titular
  ON public.estoque_movimentacoes (titular_id) WHERE titular_id IS NOT NULL;

-- ── View de saldos por (material, titular) ────────────────────
CREATE OR REPLACE VIEW public.estoque_saldos_por_titular AS
WITH movs AS (
  SELECT material_id, titular_id AS titular,  quantidade  AS delta
  FROM public.estoque_movimentacoes WHERE tipo IN ('entrada','ajuste')
  UNION ALL
  SELECT material_id, titular_id AS titular, -quantidade
  FROM public.estoque_movimentacoes WHERE tipo IN ('saida','perda')
  UNION ALL
  SELECT material_id, titular_id AS titular, -quantidade
  FROM public.estoque_movimentacoes WHERE tipo = 'transferencia'
  UNION ALL
  SELECT material_id, titular_destino_id AS titular, quantidade
  FROM public.estoque_movimentacoes WHERE tipo = 'transferencia'
)
SELECT material_id, titular, SUM(delta) AS saldo
FROM movs
GROUP BY material_id, titular;

-- View simplificada: saldo TOTAL por material (soma todas as posses)
CREATE OR REPLACE VIEW public.estoque_saldos_totais AS
SELECT
  m.id AS material_id,
  m.nome, m.categoria, m.unidade, m.estoque_minimo, m.controla_posse,
  COALESCE(SUM(s.saldo), 0) AS saldo_total,
  COALESCE(SUM(CASE WHEN s.titular IS NULL THEN s.saldo ELSE 0 END), 0) AS saldo_estoque,
  COALESCE(SUM(CASE WHEN s.titular IS NOT NULL THEN s.saldo ELSE 0 END), 0) AS saldo_com_colabs,
  (SELECT MAX(data) FROM public.estoque_movimentacoes WHERE material_id = m.id) AS ultima_mov
FROM public.materiais m
LEFT JOIN public.estoque_saldos_por_titular s ON s.material_id = m.id
WHERE m.ativo
GROUP BY m.id;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materiais_auth_all" ON public.materiais;
CREATE POLICY "materiais_auth_all"
  ON public.materiais FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "mov_auth_all" ON public.estoque_movimentacoes;
CREATE POLICY "mov_auth_all"
  ON public.estoque_movimentacoes FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);
