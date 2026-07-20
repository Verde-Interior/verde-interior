-- ============================================================
-- 017_audit_log_ponto.sql
--
-- Auditoria de edições do gestor em batidas de ponto e
-- justificativas. Só registra o que MUDA (INSERT / UPDATE / DELETE)
-- e quem fez a mudança (auth.uid()).
--
-- Motivo: hoje o gestor pode adicionar batida "esquecida" pelo
-- colaborador (dbAddPunch no App Ponto) e aprovar/recusar
-- justificativas. Sem log, não há rastreabilidade — problema
-- pra dissídio, fiscalização e auditoria interna.
--
-- Aplicar em: 20/07/2026 (dashboard → SQL Editor)
-- ============================================================


-- ── Tabela genérica de auditoria ─────────────────────────────
-- Uma tabela só, discriminada por `entidade` (tabela) e `acao`.
-- payload_antes / payload_depois em JSONB pra permitir
-- inspecionar sem alterar schema quando as tabelas evoluírem.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             BIGSERIAL PRIMARY KEY,
  entidade       TEXT NOT NULL,   -- ex: 'punch_records', 'justifications'
  entidade_id    TEXT NOT NULL,   -- id do registro afetado (as PKs são de tipos diferentes)
  acao           TEXT NOT NULL CHECK (acao IN ('INSERT','UPDATE','DELETE')),
  usuario_id     UUID,            -- auth.uid() do gestor
  usuario_email  TEXT,            -- redundância pra facilitar leitura
  payload_antes  JSONB,           -- snapshot antes (NULL em INSERT)
  payload_depois JSONB,           -- snapshot depois (NULL em DELETE)
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entidade
  ON public.audit_log (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_usuario
  ON public.audit_log (usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_criado
  ON public.audit_log (criado_em DESC);


-- ── Função genérica de trigger ───────────────────────────────
-- Usa TG_TABLE_NAME e TG_OP pra ser reutilizada em qualquer tabela.
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_uid   UUID;
  v_email TEXT;
  v_id    TEXT;
BEGIN
  BEGIN
    v_uid := auth.uid();
    v_email := (SELECT email FROM auth.users WHERE id = v_uid);
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
    v_email := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_id := (OLD.id)::TEXT;
    INSERT INTO public.audit_log
      (entidade, entidade_id, acao, usuario_id, usuario_email, payload_antes, payload_depois)
    VALUES
      (TG_TABLE_NAME, v_id, 'DELETE', v_uid, v_email, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := (NEW.id)::TEXT;
    -- Não loga se nada mudou (raro, mas evita ruído)
    IF to_jsonb(OLD) = to_jsonb(NEW) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.audit_log
      (entidade, entidade_id, acao, usuario_id, usuario_email, payload_antes, payload_depois)
    VALUES
      (TG_TABLE_NAME, v_id, 'UPDATE', v_uid, v_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_id := (NEW.id)::TEXT;
    INSERT INTO public.audit_log
      (entidade, entidade_id, acao, usuario_id, usuario_email, payload_antes, payload_depois)
    VALUES
      (TG_TABLE_NAME, v_id, 'INSERT', v_uid, v_email, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.audit_trigger() IS
  'Grava INSERT/UPDATE/DELETE em public.audit_log. Anexar como trigger em qualquer tabela via CREATE TRIGGER ... EXECUTE FUNCTION audit_trigger().';


-- ── Anexar em punch_records ──────────────────────────────────
DROP TRIGGER IF EXISTS punch_records_audit ON public.punch_records;
CREATE TRIGGER punch_records_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.punch_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


-- ── Anexar em justifications ─────────────────────────────────
DROP TRIGGER IF EXISTS justifications_audit ON public.justifications;
CREATE TRIGGER justifications_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.justifications
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


-- ── RLS: só gestores leem o audit_log ────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_gestor_read" ON public.audit_log;
CREATE POLICY "audit_log_gestor_read"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_gestor());

-- INSERT vem dos triggers (SECURITY DEFINER) — nunca pelo client.
-- UPDATE/DELETE não são permitidos (log é imutável por design).


-- ── Verificação ──────────────────────────────────────────────
-- Após aplicar, testar com:
--
-- INSERT INTO punch_records (employee_id, date, type, time)
--   VALUES (1, '2026-07-20', 'entry', '09:00');
-- SELECT entidade, acao, usuario_email, criado_em
--   FROM public.audit_log
--   ORDER BY criado_em DESC LIMIT 5;
--
-- Deve mostrar a linha de INSERT registrada.
