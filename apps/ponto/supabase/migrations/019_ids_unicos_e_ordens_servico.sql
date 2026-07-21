-- 019_ids_unicos_e_ordens_servico.sql
-- Base da Plataforma Unificada:
--   1. IDs humanos sequenciais para clientes, orçamentos e ordens de serviço
--   2. Tabela ordens_servico
--   3. Trigger: quando um lead vira orcamento_aprovado, cria automaticamente uma OS

-- ── 1. Sequências ─────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_cliente_id START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_orcamento_id START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_os_id START 1;

-- ── 2. Coluna cli_id em clientes ──────────────────────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cli_id TEXT UNIQUE;

-- Backfill dos existentes (idempotente — só gera para quem ainda não tem)
UPDATE public.clientes
SET cli_id = 'CLI-' || LPAD(nextval('public.seq_cliente_id')::TEXT, 3, '0')
WHERE cli_id IS NULL;

-- Default para novos
ALTER TABLE public.clientes
  ALTER COLUMN cli_id
  SET DEFAULT 'CLI-' || LPAD(nextval('public.seq_cliente_id')::TEXT, 3, '0');

-- ── 3. Coluna orc_id em leads (o "orçamento" hoje é um lead com anexos) ──
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS orc_id TEXT;

-- Só leads que chegaram em pelo menos "orcamento_pendente" ganham orc_id.
-- Backfill: gera para os que já estão nesse estado ou além.
UPDATE public.leads
SET orc_id = 'ORC-' || LPAD(nextval('public.seq_orcamento_id')::TEXT, 3, '0')
WHERE orc_id IS NULL
  AND estagio_id IN ('orcamento_pendente','orcamento_enviado','orcamento_aprovado','orcamento_nao_aprovado');

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_orc_id ON public.leads(orc_id) WHERE orc_id IS NOT NULL;

-- ── 4. Tabela ordens_servico ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id         TEXT UNIQUE NOT NULL DEFAULT 'OS-' || LPAD(nextval('public.seq_os_id')::TEXT, 3, '0'),
  lead_id       UUID REFERENCES public.leads(id)     ON DELETE SET NULL,
  cliente_id    UUID REFERENCES public.clientes(id)  ON DELETE SET NULL,
  origem        TEXT CHECK (origem IN ('trigger_aprovacao','manual')) DEFAULT 'manual',
  status        TEXT CHECK (status IN ('rascunho','em_execucao','concluida','cancelada')) DEFAULT 'rascunho',
  observacoes   TEXT,
  criada_em     TIMESTAMPTZ DEFAULT NOW(),
  concluida_em  TIMESTAMPTZ,
  CONSTRAINT os_cliente_ou_lead CHECK (
    (cliente_id IS NOT NULL) OR (lead_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_os_lead    ON public.ordens_servico(lead_id)    WHERE lead_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_cliente ON public.ordens_servico(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_status  ON public.ordens_servico(status);

-- RLS: mesmo padrão do CRM — authenticated tem acesso total
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ordens_servico' AND policyname = 'ordens_servico_auth_all'
  ) THEN
    CREATE POLICY ordens_servico_auth_all ON public.ordens_servico
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. Trigger: lead → orcamento_aprovado gera OS automaticamente ─────────
CREATE OR REPLACE FUNCTION public.gerar_os_de_lead_aprovado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só age quando o estágio ACABOU de virar orcamento_aprovado
  IF NEW.estagio_id = 'orcamento_aprovado'
     AND (OLD.estagio_id IS DISTINCT FROM 'orcamento_aprovado') THEN

    -- Se já existe OS pra esse lead, não duplica (evita reentrada por edições)
    IF NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE lead_id = NEW.id) THEN
      INSERT INTO public.ordens_servico (lead_id, cliente_id, origem, status, observacoes)
      VALUES (
        NEW.id,
        NEW.cliente_id,  -- pode ser NULL se lead ainda não foi promovido
        'trigger_aprovacao',
        'rascunho',
        'OS gerada automaticamente ao aprovar o orçamento do lead.'
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerar_os_de_lead_aprovado ON public.leads;
CREATE TRIGGER trg_gerar_os_de_lead_aprovado
  AFTER UPDATE OF estagio_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_os_de_lead_aprovado();

-- ── 6. Trigger: gerar orc_id quando lead passa a ter proposta ────────────
CREATE OR REPLACE FUNCTION public.gerar_orc_id_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.orc_id IS NULL
     AND NEW.estagio_id IN ('orcamento_pendente','orcamento_enviado','orcamento_aprovado','orcamento_nao_aprovado') THEN
    NEW.orc_id := 'ORC-' || LPAD(nextval('public.seq_orcamento_id')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerar_orc_id ON public.leads;
CREATE TRIGGER trg_gerar_orc_id
  BEFORE INSERT OR UPDATE OF estagio_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_orc_id_lead();

-- ── 7. Comentários ────────────────────────────────────────────────────────
COMMENT ON TABLE  public.ordens_servico             IS 'Ordem de Serviço unificada. Criada manualmente ou via trigger quando um lead vira orcamento_aprovado.';
COMMENT ON COLUMN public.ordens_servico.os_id       IS 'ID humano sequencial (OS-001, OS-002...). Único.';
COMMENT ON COLUMN public.ordens_servico.origem      IS 'trigger_aprovacao = criada automaticamente pelo trigger; manual = criada por gestor via UI.';
COMMENT ON COLUMN public.clientes.cli_id            IS 'ID humano sequencial (CLI-001...). Único. Backfill automático.';
COMMENT ON COLUMN public.leads.orc_id               IS 'ID humano sequencial do orçamento (ORC-001...). Só gerado quando lead chega em orcamento_pendente ou além.';
