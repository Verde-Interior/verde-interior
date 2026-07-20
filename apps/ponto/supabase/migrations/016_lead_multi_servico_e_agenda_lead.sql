-- ============================================================
-- 016_lead_multi_servico_e_agenda_lead.sql
--
-- Duas mudanças combinadas nesta migration porque nascem
-- do mesmo pedido de negócio (Roberto, 20/07/2026):
--
-- 1) MULTI-TIPO DE SERVIÇO NO LEAD
--    Trocar `leads.tipo_servico TEXT` por `leads.tipos_servico TEXT[]`.
--    Motivo: um mesmo cliente pode ter combinações como
--    "reforma + manutenção" ou "locação + manutenção" — o funil
--    hoje forçava escolher um, o que distorce cards e filtros.
--
-- 2) AGENDA VINCULADA A LEAD *OU* CLIENTE
--    Tornar `agenda.cliente_id` nullable e adicionar
--    `agenda.lead_id UUID FK leads(id)` + check garantindo
--    exatamente um dos dois preenchido.
--    Motivo: hoje só clientes cadastrados podem receber visita
--    técnica na Escala. Roberto quer agendar visita direto do
--    lead (antes de virar cliente).
--
-- Aplicar em: dashboard → SQL Editor → colar → rodar
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- PARTE 1 — Multi-tipo de serviço
-- ─────────────────────────────────────────────────────────────

-- 1.1 Nova coluna array (com default vazio pra não quebrar leads existentes)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tipos_servico TEXT[] NOT NULL DEFAULT '{}';

-- 1.2 Backfill: copia o valor único atual para o array
UPDATE public.leads
   SET tipos_servico = ARRAY[tipo_servico]
 WHERE tipo_servico IS NOT NULL
   AND (tipos_servico IS NULL OR array_length(tipos_servico, 1) IS NULL);

-- 1.3 Constraint: todo elemento do array precisa ser um tipo válido
--     (mesmos valores da CHECK antiga de tipo_servico + validação por elemento)
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_tipos_servico_valid;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_tipos_servico_valid
    CHECK (
      tipos_servico <@ ARRAY['venda','manutencao','reforma','locacao','locacao_evento']::TEXT[]
    );

-- 1.4 Índice GIN para filtros do tipo "tipos_servico @> ARRAY['manutencao']"
CREATE INDEX IF NOT EXISTS idx_leads_tipos_servico
  ON public.leads USING GIN (tipos_servico);

COMMENT ON COLUMN public.leads.tipos_servico IS
  'Array de tipos de serviço do lead. Substitui tipo_servico (singular). Permite combinações como "reforma+manutencao" e "locacao+manutencao".';

-- 1.5 A coluna antiga `tipo_servico` fica por ora — não dropamos para dar
--     tempo do frontend rodar bem com backwards-compat. Marcar como deprecated:
COMMENT ON COLUMN public.leads.tipo_servico IS
  'DEPRECATED — usar tipos_servico (array). Mantido apenas pra compat durante transição.';


-- ─────────────────────────────────────────────────────────────
-- PARTE 2 — Agenda vinculada a lead OU cliente
-- ─────────────────────────────────────────────────────────────

-- 2.1 Adicionar coluna lead_id
ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE;

-- 2.2 cliente_id passa a ser opcional
ALTER TABLE public.agenda
  ALTER COLUMN cliente_id DROP NOT NULL;

-- 2.3 Check: exatamente um dos dois preenchido
ALTER TABLE public.agenda
  DROP CONSTRAINT IF EXISTS agenda_cliente_xor_lead;
ALTER TABLE public.agenda
  ADD CONSTRAINT agenda_cliente_xor_lead
    CHECK (
      (cliente_id IS NOT NULL AND lead_id IS NULL) OR
      (cliente_id IS NULL AND lead_id IS NOT NULL)
    );

-- 2.4 Índice para lookup por lead
CREATE INDEX IF NOT EXISTS idx_agenda_lead
  ON public.agenda (lead_id)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.agenda.lead_id IS
  'Quando a visita é agendada direto do lead (antes de virar cliente). Mutuamente exclusivo com cliente_id — CHECK agenda_cliente_xor_lead garante que exatamente um dos dois esteja preenchido.';


-- ─────────────────────────────────────────────────────────────
-- Verificação rápida (rodar depois do apply)
-- ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name IN ('leads','agenda')
--    AND column_name IN ('tipo_servico','tipos_servico','cliente_id','lead_id')
--  ORDER BY table_name, ordinal_position;
