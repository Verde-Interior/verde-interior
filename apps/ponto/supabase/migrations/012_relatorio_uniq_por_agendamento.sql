-- ============================================================
-- 012_relatorio_uniq_por_agendamento.sql
-- Garante 1 relatório por agendamento (previne duplo-clique)
-- Aplicado em: 08/07/2026
-- ============================================================
-- Bug observado: duplo-clique em "Iniciar visita" no App Ponto
-- criava 2 relatórios com o mesmo agendamento_id em milissegundos
-- de diferença. Índice UNIQUE bloqueia isso no nível do banco.
-- Se o funcionário legitimamente precisar retomar uma visita, o
-- código no App Ponto agora detecta o relatório existente e reutiliza.
-- ============================================================

-- Limpa duplicatas antes de criar o índice
DELETE FROM public.relatorios r
WHERE r.status = 'em_andamento'
  AND EXISTS (
    SELECT 1 FROM public.relatorios r2
    WHERE r2.agendamento_id = r.agendamento_id
      AND r2.status = 'concluido'
      AND r2.id <> r.id
  );

DROP INDEX IF EXISTS uniq_relatorio_por_agendamento;
CREATE UNIQUE INDEX uniq_relatorio_por_agendamento
  ON public.relatorios (agendamento_id);
