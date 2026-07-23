-- ============================================================
-- 028_patrimonio_especie_nullable.sql
-- Permite criar patrimônio (QR code) sem espécie definida.
-- A espécie é atribuída depois, via scan no celular.
-- Aplicado em: 23/07/2026
-- ============================================================

ALTER TABLE public.estoque_patrimonios
  ALTER COLUMN especie_id DROP NOT NULL;

-- Atualiza a view pra lidar com espécie nula
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
LEFT JOIN public.estoque_especies e ON e.id = p.especie_id
LEFT JOIN public.clientes c ON c.id = p.cliente_id;
