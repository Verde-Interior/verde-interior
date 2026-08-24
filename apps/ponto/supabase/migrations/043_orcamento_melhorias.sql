-- ============================================================
-- 043_orcamento_melhorias.sql
-- Melhorias no gerador de orçamentos (fase 2)
-- ============================================================

-- nome base da planta (extraído do catálogo) para reconstrução
-- de nome e busca de foto ao mudar cor/tamanho do vaso
ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS nome_planta TEXT;

-- tipo da seção: 'normal' (com preço) | 'sugestoes' (sem preço)
ALTER TABLE public.orcamento_opcoes
  ADD COLUMN IF NOT EXISTS tipo_secao TEXT NOT NULL DEFAULT 'normal';

-- overrides de texto editados manualmente na pré-visualização
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS preview_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.orcamento_itens.nome_planta IS
  'Nome base da planta (parte antes do " — " no nome do catálogo). Usado para buscar foto ao trocar cor/tamanho do vaso.';

COMMENT ON COLUMN public.orcamento_opcoes.tipo_secao IS
  '''normal'' = seção com preço e total; ''sugestoes'' = seção visual sem preço (apenas fotos e nomes).';

COMMENT ON COLUMN public.orcamentos.preview_overrides IS
  'Mapa de overrides de texto editados manualmente na pré-visualização. Chave = data-key do elemento, valor = texto substituído.';
