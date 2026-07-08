-- ============================================================
-- 011_remove_anon_policies.sql
-- Remove políticas anon temporárias após implementar auth no CRM
-- Aplicado em: 07/07/2026
-- ============================================================
-- CRM agora exige login (AuthContext + Login.jsx). App Ponto sempre
-- usou authenticated. Todas as tabelas do sistema de campo têm
-- policies `_auth_all` para authenticated que cobrem CRUD completo.
-- ============================================================

DROP POLICY IF EXISTS "agendamentos_anon_all" ON public.agenda;
DROP POLICY IF EXISTS "servicos_anon_all"     ON public.cliente_servicos;
DROP POLICY IF EXISTS "clientes_anon_all"     ON public.clientes;
DROP POLICY IF EXISTS "bloqueios_anon_all"    ON public.employee_bloqueios;
DROP POLICY IF EXISTS "employees_anon_read"   ON public.employees;
DROP POLICY IF EXISTS "fotos_anon_all"        ON public.fotos_relatorio;
DROP POLICY IF EXISTS "relatorios_anon_all"   ON public.relatorios;
DROP POLICY IF EXISTS "field_photos_anon_read" ON storage.objects;

-- Referências:
--   005_anon_rls_temp.sql
--   006_anon_employees_read.sql
--   009_storage_anon_read.sql
-- foram usadas enquanto o CRM funcionava sem autenticação.
-- Podem ser mantidas no histórico, mas as policies agora estão removidas.
