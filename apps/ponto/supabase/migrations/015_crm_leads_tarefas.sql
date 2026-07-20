-- ============================================================
-- 015_crm_leads_tarefas.sql
-- Migração das tabelas de leads e tarefas do CRM para o Supabase
-- + RPC atômica para reordenar agenda (elimina race condition
--   do drag & drop na Escala de Campo)
-- Aplicar em: 20/07/2026
-- ============================================================
-- Contexto: até 07/2026, leads e tarefas do CRM viviam apenas
-- em localStorage (crm-verde-leads, crm-verde-tarefas). Perda
-- de dados ao trocar de dispositivo ou limpar cache. Esta
-- migração leva o core comercial para o Supabase.
--
-- Decisões:
-- - Colunas core como TEXT/NUMERIC de primeira classe (usadas em
--   filtros/ordenação) + coluna dados JSONB para o estado aninhado
--   (fluxoOrcamento, funilExecucao, historico, orcamentoAnexos,
--   visitas). Permite evoluir o shape sem migration a cada campo.
-- - Sem migração de dados: reset combinado com o usuário — os
--   registros em localStorage eram apenas mocks/testes.
-- - RLS: authenticated_all (sem roles no CRM — só gestores usam).
-- ============================================================


-- ── Trigger genérico de updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── Tabela leads ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contato
  empresa              TEXT NOT NULL,
  contato              TEXT,
  cargo                TEXT,
  telefone             TEXT,
  email                TEXT,

  -- Endereço
  bairro               TEXT,
  endereco             TEXT,
  lat                  NUMERIC,
  lng                  NUMERIC,

  -- Funil
  estagio_id           TEXT NOT NULL DEFAULT 'contato_recebido'
    CHECK (estagio_id IN (
      'contato_recebido',
      'orcamento_pendente',
      'orcamento_enviado',
      'orcamento_aprovado',
      'orcamento_nao_aprovado'
    )),
  tipo_servico         TEXT
    CHECK (tipo_servico IS NULL OR tipo_servico IN (
      'venda','manutencao','reforma','locacao','locacao_evento'
    )),
  canal_origem         TEXT
    CHECK (canal_origem IS NULL OR canal_origem IN ('WhatsApp','E-mail','Telefone')),
  quantidade_vasos     INTEGER,
  valor_estimado       NUMERIC(12,2),
  frequencia_visita    TEXT
    CHECK (frequencia_visita IS NULL OR frequencia_visita IN (
      'Semanal','Quinzenal','Mensal','Pontual'
    )),

  -- Datas
  data_entrada         DATE DEFAULT CURRENT_DATE,
  ultimo_contato       DATE,
  proximo_follow_up    DATE,

  -- Meta
  responsavel          TEXT,
  observacoes          TEXT,
  motivo_perda         TEXT,
  cliente_supabase_id  UUID REFERENCES public.clientes(id) ON DELETE SET NULL,

  -- Estado aninhado: fluxoOrcamento, funilExecucao, historico,
  -- orcamentoAnexos, visitas, etc.
  dados                JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_estagio
  ON public.leads (estagio_id);
CREATE INDEX IF NOT EXISTS idx_leads_created
  ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up
  ON public.leads (proximo_follow_up)
  WHERE proximo_follow_up IS NOT NULL;

DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.leads.dados IS
  'Estado aninhado do lead: fluxoOrcamento, funilExecucao, historico, orcamentoAnexos, visitas. Evolui sem exigir migration a cada campo novo.';


-- ── Tabela tarefas ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarefas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  prioridade        TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('alta','media','baixa')),
  status            TEXT NOT NULL DEFAULT 'a_fazer'
    CHECK (status IN ('a_fazer','em_andamento','concluida')),
  categoria         TEXT NOT NULL DEFAULT 'geral',
  data_vencimento   DATE,
  data_criacao      DATE DEFAULT CURRENT_DATE,
  concluida_em      DATE,
  lead_id           UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_status
  ON public.tarefas (status);
CREATE INDEX IF NOT EXISTS idx_tarefas_vencimento
  ON public.tarefas (data_vencimento)
  WHERE status <> 'concluida';
CREATE INDEX IF NOT EXISTS idx_tarefas_lead
  ON public.tarefas (lead_id)
  WHERE lead_id IS NOT NULL;

DROP TRIGGER IF EXISTS tarefas_set_updated_at ON public.tarefas;
CREATE TRIGGER tarefas_set_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── RPC atômica: reordenar/mover visitas da agenda ────────────
-- Substitui o Promise.all([...UPDATE...]) da EscalaCampo, que era
-- suscetível a inconsistências quando dois usuários arrastavam
-- simultaneamente. Aqui todos os UPDATEs vivem numa mesma
-- transação — ou tudo passa, ou tudo reverte.
--
-- Aceita qualquer combinação de campos por item:
--   id (uuid, obrigatório), funcionario_id (text), ordem_rota (int),
--   hora_estimada_chegada (time, aceita "HH:MM").
-- Campos ausentes preservam o valor atual (COALESCE).
--
-- Uso do lado do cliente:
--   await supabase.rpc('reorder_agenda', { p_updates: [{id, funcionario_id, ordem_rota}, ...] })
CREATE OR REPLACE FUNCTION public.reorder_agenda(p_updates JSONB)
RETURNS INTEGER AS $$
DECLARE
  item        JSONB;
  atualizados INTEGER := 0;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates precisa ser um array JSON';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE public.agenda
       SET funcionario_id        = COALESCE((item->>'funcionario_id')::TEXT,        funcionario_id),
           ordem_rota            = COALESCE((item->>'ordem_rota')::INTEGER,         ordem_rota),
           hora_estimada_chegada = COALESCE((item->>'hora_estimada_chegada')::TIME, hora_estimada_chegada)
     WHERE id = (item->>'id')::UUID;
    atualizados := atualizados + 1;
  END LOOP;

  RETURN atualizados;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMENT ON FUNCTION public.reorder_agenda(JSONB) IS
  'Aplica múltiplas atualizações de funcionario_id/ordem_rota/hora_estimada_chegada na tabela agenda dentro de uma única transação. Elimina race conditions do drag & drop e otimizador de rota da Escala de Campo (CRM).';


-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.leads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_auth_all" ON public.leads;
CREATE POLICY "leads_auth_all"
  ON public.leads FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "tarefas_auth_all" ON public.tarefas;
CREATE POLICY "tarefas_auth_all"
  ON public.tarefas FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

GRANT EXECUTE ON FUNCTION public.reorder_agenda(JSONB) TO authenticated;
