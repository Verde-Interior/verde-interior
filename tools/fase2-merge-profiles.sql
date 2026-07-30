-- ============================================================
-- Fase 2 — Merge profiles → employees
-- Elimina a tabela profiles, movendo suas colunas para employees.
-- Aplicar SOMENTE no staging por enquanto.
-- ============================================================

-- ── 1. Adicionar colunas em employees ──────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id      uuid,
  ADD COLUMN IF NOT EXISTS username          text,
  ADD COLUMN IF NOT EXISTS role              text DEFAULT 'colab',
  ADD COLUMN IF NOT EXISTS email_recuperacao text;

-- ── 2. Backfill a partir de profiles ───────────────────────────────
UPDATE public.employees e
SET auth_user_id      = p.id,
    username          = p.username,
    role              = p.role,
    email_recuperacao = p.email_recuperacao
FROM public.profiles p
WHERE p.employee_id = e.id
  AND e.auth_user_id IS NULL;

-- ── 3. Constraints ────────────────────────────────────────────────
-- role sempre obrigatório
ALTER TABLE public.employees ALTER COLUMN role SET NOT NULL;

-- auth_user_id opcional (colabs cadastrados sem login ainda), mas UNIQUE quando presente
CREATE UNIQUE INDEX IF NOT EXISTS employees_auth_user_id_key
  ON public.employees (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- username também UNIQUE quando presente
CREATE UNIQUE INDEX IF NOT EXISTS employees_username_key
  ON public.employees (username)
  WHERE username IS NOT NULL;

-- FK opcional pra auth.users (soft — permite auth user ser deletado sem quebrar tudo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_auth_user_id_fkey') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 4. Reescrever funções pra usar employees ──────────────────────
CREATE OR REPLACE FUNCTION public.is_gestor() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid() AND role = 'gestor'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_employee_id() RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid();
$$;

-- ── 5. View de compatibilidade (pra código legado seguir funcionando) ─
-- Deixa profiles como uma view espelhando employees. Depois de refatorar todo o código,
-- basta rodar DROP VIEW public.profiles;
-- IMPORTANT: dropamos a tabela original ANTES de criar a view (mesmo nome).
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE VIEW public.profiles AS
SELECT
  auth_user_id       AS id,
  id                 AS employee_id,
  username,
  role,
  email_recuperacao
FROM public.employees
WHERE auth_user_id IS NOT NULL;

-- Grant básico pra API poder consultar
GRANT SELECT ON public.profiles TO anon, authenticated;
