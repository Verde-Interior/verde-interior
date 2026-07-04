-- ============================================================
-- 005_anon_rls_temp.sql
-- Políticas temporárias para acesso anon (CRM sem auth ainda)
-- Aplicado em: 04/07/2026
-- ============================================================
-- REMOVER quando auth for implementado no CRM.
-- Substituir por políticas granulares por role (gestor/funcionário).
-- ============================================================

DROP POLICY IF EXISTS "clientes_anon_all"     ON public.clientes;
DROP POLICY IF EXISTS "servicos_anon_all"     ON public.cliente_servicos;
DROP POLICY IF EXISTS "agendamentos_anon_all" ON public.agenda;
DROP POLICY IF EXISTS "relatorios_anon_all"   ON public.relatorios;
DROP POLICY IF EXISTS "fotos_anon_all"        ON public.fotos_relatorio;

CREATE POLICY "clientes_anon_all"
  ON public.clientes FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "servicos_anon_all"
  ON public.cliente_servicos FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "agendamentos_anon_all"
  ON public.agenda FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "relatorios_anon_all"
  ON public.relatorios FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "fotos_anon_all"
  ON public.fotos_relatorio FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
