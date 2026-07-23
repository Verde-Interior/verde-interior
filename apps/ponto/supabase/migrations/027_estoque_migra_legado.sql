-- ============================================================
-- 027_estoque_migra_legado.sql
-- Migra materiais → estoque_itens e mantém histórico de movs
-- Aplicado em: 23/07/2026
-- ============================================================
-- Mapeamento de categorias:
--   vaso       → vaso
--   cobertura  → insumo
--   substrato  → insumo
--   adubo      → insumo
--   planta     → insumo (eram contagens genéricas, não patrimônios)
--   ferramenta → material  (controla_posse mantido)
--   outro      → material
-- ============================================================

-- ── 1. Migra catálogo de materiais ───────────────────────────
INSERT INTO public.estoque_itens (
  id, categoria, nome, unidade, sku, descricao, foto_url,
  estoque_minimo, controla_posse, ativo, criado_em
)
SELECT
  id,
  CASE categoria
    WHEN 'vaso'       THEN 'vaso'
    WHEN 'cobertura'  THEN 'insumo'
    WHEN 'substrato'  THEN 'insumo'
    WHEN 'adubo'      THEN 'insumo'
    WHEN 'planta'     THEN 'insumo'
    WHEN 'ferramenta' THEN 'material'
    ELSE                   'material'
  END,
  nome, unidade, sku, descricao, foto_url,
  estoque_minimo, controla_posse, ativo, created_at
FROM public.materiais
ON CONFLICT (id) DO NOTHING;

-- ── 2. Migra movimentações ────────────────────────────────────
INSERT INTO public.estoque_itens_movs (
  id, item_id, tipo, quantidade,
  titular_id, titular_destino_id,
  motivo, agenda_id, cliente_id,
  criado_por, observacao, criado_em
)
SELECT
  id, material_id, tipo, quantidade,
  titular_id, titular_destino_id,
  motivo, agenda_id, cliente_id,
  criado_por, observacao, data
FROM public.estoque_movimentacoes
ON CONFLICT (id) DO NOTHING;

-- ── 3. Depreca as views antigas (mantém tabelas intocadas) ───
-- As tabelas materiais e estoque_movimentacoes ficam como estão.
-- O Estoque.jsx v2 não as referencia mais.
-- Uma futura migration pode dropá-las após confirmar que nada depende.

DROP VIEW IF EXISTS public.estoque_saldos_totais;
DROP VIEW IF EXISTS public.estoque_saldos_por_titular;
