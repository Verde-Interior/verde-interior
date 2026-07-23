-- ============================================================
-- 029_estoque_em_evento.sql
-- Adiciona status 'em_evento' + eventos evento_inicio/evento_fim
-- Aplicado em: 23/07/2026
-- ============================================================
-- Motivo:
--   Plantas podem ir para eventos temporários (vão voltar).
--   Precisamos separar isso de 'em_cliente' (fixo/loc contínua)
--   e de 'em_manutencao' (recuperação/adubação).
-- ============================================================

-- 1. Ampliar CHECK de status em estoque_patrimonios
ALTER TABLE public.estoque_patrimonios
  DROP CONSTRAINT IF EXISTS estoque_patrimonios_status_check;

ALTER TABLE public.estoque_patrimonios
  ADD CONSTRAINT estoque_patrimonios_status_check
  CHECK (status IN (
    'disponivel',
    'em_cliente',
    'em_evento',
    'em_manutencao',
    'descartado'
  ));

-- 2. Ampliar CHECK de tipo em estoque_eventos
ALTER TABLE public.estoque_eventos
  DROP CONSTRAINT IF EXISTS estoque_eventos_tipo_check;

ALTER TABLE public.estoque_eventos
  ADD CONSTRAINT estoque_eventos_tipo_check
  CHECK (tipo IN (
    'cadastro',
    'entrada',
    'saida',
    'instalacao',
    'retirada',
    'evento_inicio',
    'evento_fim',
    'troca_especie',
    'manutencao_inicio',
    'manutencao_fim',
    'descarte',
    'transferencia',
    'observacao'
  ));

-- 3. Atualizar view estoque_especies_resumo para incluir em_evento
DROP VIEW IF EXISTS public.estoque_especies_resumo;
CREATE VIEW public.estoque_especies_resumo AS
SELECT
  e.id                                            AS especie_id,
  e.nome,
  e.nome_cientifico,
  e.categoria,
  COUNT(p.id) FILTER (WHERE p.status <> 'descartado')                AS total_ativos,
  COUNT(p.id) FILTER (WHERE p.status = 'disponivel')                 AS disponiveis,
  COUNT(p.id) FILTER (WHERE p.status = 'em_cliente')                 AS em_cliente,
  COUNT(p.id) FILTER (WHERE p.status = 'em_evento')                  AS em_evento,
  COUNT(p.id) FILTER (WHERE p.status = 'em_manutencao')              AS em_manutencao,
  COUNT(p.id) FILTER (WHERE p.status = 'descartado')                 AS descartados
FROM public.estoque_especies e
LEFT JOIN public.estoque_patrimonios p ON p.especie_id = e.id
WHERE e.ativo = TRUE
GROUP BY e.id, e.nome, e.nome_cientifico, e.categoria
ORDER BY e.nome;
