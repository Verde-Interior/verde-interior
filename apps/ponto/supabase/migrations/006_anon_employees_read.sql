-- ============================================================
-- 006_anon_employees_read.sql
-- Leitura de employees pelo CRM (sem auth ainda)
-- Aplicado em: 04/07/2026
-- ============================================================
-- Permite que o CRM (anon) leia a tabela employees
-- para montar as colunas de funcionários na tela Escala.
-- REMOVER quando auth for implementado no CRM.
-- ============================================================

CREATE POLICY "employees_anon_read"
  ON public.employees FOR SELECT TO anon USING (TRUE);
