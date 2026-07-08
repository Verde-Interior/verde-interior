-- ============================================================
-- 010_employee_bloqueios.sql
-- Bloqueios de dias por funcionário (férias, folga, feriado)
-- Aplicado em: 07/07/2026
-- ============================================================
-- Usado pela Escala para impedir agendamento em dias que o
-- funcionário está ausente. Aparece como badge na coluna e
-- bloqueia drag/drop/agendamento.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employee_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_bloq_func
  ON public.employee_bloqueios (funcionario_id, data_inicio, data_fim);

ALTER TABLE public.employee_bloqueios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloqueios_anon_all" ON public.employee_bloqueios;
CREATE POLICY "bloqueios_anon_all"
  ON public.employee_bloqueios FOR ALL TO anon
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "bloqueios_auth_all" ON public.employee_bloqueios;
CREATE POLICY "bloqueios_auth_all"
  ON public.employee_bloqueios FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);
