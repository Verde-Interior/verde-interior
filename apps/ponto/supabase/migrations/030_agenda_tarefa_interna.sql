  -- ============================================================
  -- 030_agenda_tarefa_interna.sql
  --
  -- Permite criar agendamentos sem cliente nem lead cadastrado
  -- ("tarefas internas" como eventos, treinamentos, etc).
  --
  -- Mudanças:
  -- 1) Relaxar CHECK agenda_cliente_xor_lead → permite ambos nulos
  -- 2) Adicionar nome_cliente TEXT — nome exibido quando não há cliente
  -- 3) Adicionar endereco_tarefa TEXT — endereço exibido no app ponto
  --
  -- Aplicar em: dashboard → SQL Editor → colar → rodar
  -- ============================================================

  -- 1. Remover constraint que exige exatamente um dos dois preenchido
  ALTER TABLE public.agenda
    DROP CONSTRAINT IF EXISTS agenda_cliente_xor_lead;

  -- 2. Nova constraint: no máximo um dos dois (ambos nulos é válido)
  ALTER TABLE public.agenda
    ADD CONSTRAINT agenda_cliente_ou_lead_nao_ambos
      CHECK (NOT (cliente_id IS NOT NULL AND lead_id IS NOT NULL));

  -- 3. Coluna para o nome do local/cliente quando não há cadastro
  ALTER TABLE public.agenda
    ADD COLUMN IF NOT EXISTS nome_cliente TEXT;

  -- 4. Coluna para o endereço a ser exibido no app ponto
  ALTER TABLE public.agenda
    ADD COLUMN IF NOT EXISTS endereco_tarefa TEXT;

  COMMENT ON COLUMN public.agenda.nome_cliente IS
    'Nome do local/cliente exibido no app quando não há cliente_id nem lead_id (tarefa interna).';

  COMMENT ON COLUMN public.agenda.endereco_tarefa IS
    'Endereço textual exibido no app ponto para tarefas internas sem cliente cadastrado.';


  -- ─────────────────────────────────────────────────────────────
  -- Verificação rápida
  -- ─────────────────────────────────────────────────────────────
  -- SELECT column_name, data_type, is_nullable
  --   FROM information_schema.columns
  --  WHERE table_schema='public' AND table_name='agenda'
  --    AND column_name IN ('cliente_id','lead_id','nome_cliente','endereco_tarefa')
  --  ORDER BY ordinal_position;
