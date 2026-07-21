-- 018_email_recuperacao.sql
-- Adiciona coluna de e-mail real para recuperação de senha.
-- Colaboradores fazem login com `{username}@vi.app` (não é e-mail real),
-- então precisamos guardar o e-mail real deles para o Supabase Auth mandar
-- o link de recuperação.
--
-- Pré-requisito para funcionar de verdade: SMTP customizado configurado
-- no Supabase Dashboard → Auth → Emails → SMTP Settings (o SMTP default
-- do Supabase tem quota baixíssima e não é confiável).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_recuperacao TEXT;

COMMENT ON COLUMN public.profiles.email_recuperacao
  IS 'E-mail real do colaborador (Gmail, corporativo, etc). Usado apenas para recuperação de senha via Supabase Auth. NULL se colaborador não tem e-mail próprio — nesse caso, só o gestor pode redefinir a senha (via Edge Function admin-reset-password).';

-- Índice opcional para futura busca reversa (usuário digita e-mail, sistema
-- descobre qual profile). Uso raro, mas barato.
CREATE INDEX IF NOT EXISTS idx_profiles_email_recuperacao
  ON public.profiles(email_recuperacao)
  WHERE email_recuperacao IS NOT NULL;
